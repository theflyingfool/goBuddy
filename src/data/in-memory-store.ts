// Shared in-memory query/filter engine backing the SQLite repository
// implementation (src/data/sqlite-repository.ts). Reference data is
// read-only once loaded; personal data lives in a plain mutable object here,
// and every mutation calls a hook so the caller can write it through to real
// SQLite.
//
// Completion stats are deliberately NOT computed here — that's real
// parameterized SQL in completion-stats-sql.ts (CLAUDE.md asks for this, not
// an in-memory scan). This module used to also carry an equivalent
// plain-JS implementation for a since-deleted localStorage-backed dummy
// repository; see docs/v1-tasks/06-performance-and-quality-infra.md.

import { resolveFormFieldCascade } from "../db/cascades";
import { emptyFormPersonal, emptyMegaPersonal, emptySpeciesPersonal } from "../db/defaults";
import type { ReferenceData } from "../db/reference-data";
import { CURRENT_PERSONAL_SCHEMA_VERSION } from "../db/schema";
import { FORM_PERSONAL_BOOLEAN_FIELDS, type Form, type FormBackgroundPersonal, type FormPersonal, type FormPersonalBooleanField, type MegaPersonal, type MegaVariant, type PokemonType, type Region, type Species, type SpeciesPersonal } from "../db/types";
import {
  fuzzyMatches,
  MAX_GRID_INDICATORS,
  parseSearchQuery,
  type GridFilterField,
  type ImportResult,
  type PersonalDataExport,
  type Repository,
  type SearchKeyword,
  type SpeciesFilter,
  type SpeciesMegaVariant,
  type SpeciesSummary,
  type SpeciesWithForms,
} from "./repository";

const INDICATOR_SETTING_KEY = "grid_indicators";
// App-owned reference-sync bookkeeping (see reference-sync.ts) — deliberately
// NOT overwritten by a personal-data import; see importPersonalData below.
const IMPORT_SKIP_SETTING_KEY = "reference_data_version";

export interface PersonalState {
  speciesPersonal: Record<string, SpeciesPersonal>;
  formPersonal: Record<string, FormPersonal>;
  appSettings: Record<string, string>;
  megaPersonal: Record<string, MegaPersonal>;
  /** Read/exported for completeness — no UI writes this yet (see repository.ts). */
  formBackgroundPersonal: FormBackgroundPersonal[];
}

export interface InMemoryStoreHooks {
  onSpeciesPersonalChanged(speciesSlug: string, personal: SpeciesPersonal): void;
  onFormPersonalChanged(formSlug: string, personal: FormPersonal): void;
  onAppSettingChanged(key: string, value: string): void;
  onMegaPersonalChanged(megaVariantSlug: string, personal: MegaPersonal): void;
  /** Fires once, before an import applies any rows — the write-through backend wipes species_personal/form_personal/mega_personal/form_background_personal so import is a real restore (replace), not a merge. App settings/preferences are untouched. */
  onPersonalDataCleared(): void;
}

export function createInMemoryRepository(
  referenceData: ReferenceData,
  state: PersonalState,
  hooks: InMemoryStoreHooks,
): Omit<Repository, "getCompletionStats"> {
  const speciesBySlug = new Map<string, Species>(referenceData.species.map((s) => [s.slug, s]));
  const speciesByDexOrder = [...referenceData.species].sort((a, b) => a.dexNumber - b.dexNumber);
  const formsBySpecies = new Map<string, Form[]>();
  const speciesSlugByFormSlug = new Map<string, string>();
  for (const f of referenceData.forms) {
    const list = formsBySpecies.get(f.speciesSlug) ?? [];
    list.push(f);
    formsBySpecies.set(f.speciesSlug, list);
    speciesSlugByFormSlug.set(f.slug, f.speciesSlug);
  }

  const typesBySlug = new Map<string, PokemonType>(referenceData.types.map((t) => [t.slug, t]));
  const formTypesByFormSlug = new Map<string, PokemonType[]>();
  for (const ft of referenceData.formTypes) {
    const list = formTypesByFormSlug.get(ft.formSlug) ?? [];
    const type = typesBySlug.get(ft.typeSlug);
    if (type) list.push(type);
    formTypesByFormSlug.set(ft.formSlug, list);
  }

  const megaVariantsBySpecies = new Map<string, MegaVariant[]>();
  const speciesSlugByMegaVariantSlug = new Map<string, string>();
  for (const mv of referenceData.megaVariants) {
    const list = megaVariantsBySpecies.get(mv.speciesSlug) ?? [];
    list.push(mv);
    megaVariantsBySpecies.set(mv.speciesSlug, list);
    speciesSlugByMegaVariantSlug.set(mv.slug, mv.speciesSlug);
  }

  function matchesSearchKeyword(species: Species, keyword: SearchKeyword): boolean {
    switch (keyword) {
      case "legendary":
        return species.rarity === "legendary";
      case "mythical":
        return species.rarity === "mythical";
      case "ultraBeast":
        return species.rarity === "ultra_beast";
      case "costume":
        // "Has this species ever had a costume" — species-level, matching
        // what the Dex grid's search box means by the keyword. Bulk Edit
        // additionally filters at the individual form/tile level (see
        // bulk-form-edit.ts) since a species can mix costume and non-costume
        // forms and its tiles are per-form, not per-species.
        return (formsBySpecies.get(species.slug) ?? []).some((f) => f.costumeName !== null);
    }
  }

  function matchesSearch(species: Species, search: string): boolean {
    const parsed = parseSearchQuery(search);
    if (parsed.keyword) {
      const matches = matchesSearchKeyword(species, parsed.keyword);
      return parsed.negate ? !matches : matches;
    }
    const q = parsed.text.trim();
    if (!q) return true;
    // All-digit query = dex-number intent, exact only — a substring match on
    // the number ("25" also matching #125/#225/#250-259/...) was real search
    // noise for something meant to jump to one species. Anything else is a
    // name, fuzzy-matched (see fuzzyMatches in repository.ts).
    if (/^\d+$/.test(q)) return species.dexNumber === Number(q);
    return fuzzyMatches(species.name, q);
  }

  function resolveFieldValue(
    field: GridFilterField,
    species: Species,
    personal: SpeciesPersonal,
    indicators: Record<FormPersonalBooleanField, boolean>,
  ): boolean {
    switch (field) {
      case "legendary":
        return species.rarity === "legendary";
      case "mythical":
        return species.rarity === "mythical";
      case "ultraBeast":
        return species.rarity === "ultra_beast";
      case "xxl":
      case "xxs":
      case "purified":
        return personal[field];
      case "megaCapable":
        return species.canMegaEvolve;
      case "megaEvolved":
        // Any-variant OR, same convention as the form-achievement indicators
        // above (e.g. Charizard counts as "mega evolved" once you've done
        // either X or Y, not only once you've done both — that stricter
        // all-variants bar is what the megaComplete *stats lens* tracks).
        return (megaVariantsBySpecies.get(species.slug) ?? []).some((mv) => (state.megaPersonal[mv.slug] ?? emptyMegaPersonal(mv.slug)).evolved);
      case "dynamaxCapable":
        return (formsBySpecies.get(species.slug) ?? []).some((f) => f.dynamaxAvailable);
      case "gigantamaxCapable":
        return species.canGigantamax;
      default:
        return indicators[field];
    }
  }

  function matchesFieldFilters(
    species: Species,
    personal: SpeciesPersonal,
    indicators: Record<FormPersonalBooleanField, boolean>,
    fieldFilters: SpeciesFilter["fieldFilters"],
  ): boolean {
    if (!fieldFilters) return true;
    return Object.entries(fieldFilters).every(([field, want]) => {
      const value = resolveFieldValue(field as GridFilterField, species, personal, indicators);
      return want === "include" ? value : !value;
    });
  }

  function setAppSetting(key: string, value: string) {
    state.appSettings[key] = value;
    hooks.onAppSettingChanged(key, value);
  }

  function isFormPersonalBooleanField(field: keyof Omit<FormPersonal, "formSlug">): field is FormPersonalBooleanField {
    return (FORM_PERSONAL_BOOLEAN_FIELDS as readonly string[]).includes(field);
  }

  // Reusable merge step: given the current record and one field being set,
  // returns the record with that field applied PLUS every field its cascade
  // implies (transitively — see resolveFormFieldCascade), all merged into a
  // single object. Pure/no side effects, so a future bulk-edit feature can
  // call this once per row and batch the writes, rather than duplicating the
  // cascade-resolution logic. Only `true`-valued boolean fields cascade —
  // unchecking (false) and non-boolean fields (bestShiny/etc.) pass through
  // unchanged, per the forward-only cascade rule.
  function mergeFormPersonalCascade(base: FormPersonal, field: keyof Omit<FormPersonal, "formSlug">, value: boolean): FormPersonal {
    const updated: FormPersonal = { ...base, [field]: value };
    if (value && isFormPersonalBooleanField(field)) {
      for (const implied of resolveFormFieldCascade(field)) {
        updated[implied] = true;
      }
    }
    return updated;
  }

  // Cross-cutting species-level cascade: if the merged form-personal record
  // has any boolean field true, that form's species must be "registered"
  // (you can't own an achievement on a form of a species you haven't caught
  // at all). Skips the write entirely if already registered, so toggling
  // further fields within an already-registered species doesn't produce a
  // redundant species_personal write on every keystroke.
  function cascadeSpeciesRegisteredForForm(formSlug: string, updated: FormPersonal): void {
    const anyTrue = FORM_PERSONAL_BOOLEAN_FIELDS.some((field) => updated[field]);
    if (!anyTrue) return;
    const speciesSlug = speciesSlugByFormSlug.get(formSlug);
    if (!speciesSlug) return;
    const currentSpecies = state.speciesPersonal[speciesSlug] ?? emptySpeciesPersonal(speciesSlug);
    if (currentSpecies.registered) return;
    const updatedSpecies: SpeciesPersonal = { ...currentSpecies, registered: true };
    state.speciesPersonal[speciesSlug] = updatedSpecies;
    hooks.onSpeciesPersonalChanged(speciesSlug, updatedSpecies);
  }

  // Single apply-step for one form field, factored out of setFormPersonalField
  // so the batched bulkSetFormPersonalField can reuse the EXACT same
  // cascade+persist path (mergeFormPersonalCascade for the forward-only field
  // cascade, then cascadeSpeciesRegisteredForForm for the species side) rather
  // than duplicating it and risking drift from the single-edit behavior.
  function applyFormPersonalField(formSlug: string, field: keyof Omit<FormPersonal, "formSlug">, value: boolean): void {
    const current = state.formPersonal[formSlug] ?? emptyFormPersonal(formSlug);
    const updated = mergeFormPersonalCascade(current, field, value);
    state.formPersonal[formSlug] = updated;
    hooks.onFormPersonalChanged(formSlug, updated);
    cascadeSpeciesRegisteredForForm(formSlug, updated);
  }

  // Species counterpart to applyFormPersonalField — same reason: shared by the
  // single setter and the batched bulkSetSpeciesPersonalField so the
  // xxl/xxs/purified → registered cascade stays identical between them.
  function applySpeciesPersonalField(speciesSlug: string, field: keyof Omit<SpeciesPersonal, "speciesSlug">, value: boolean): void {
    const current = state.speciesPersonal[speciesSlug] ?? emptySpeciesPersonal(speciesSlug);
    const impliesRegistered = value && (field === "xxl" || field === "xxs" || field === "purified");
    const updated: SpeciesPersonal = { ...current, [field]: value, ...(impliesRegistered ? { registered: true } : {}) };
    state.speciesPersonal[speciesSlug] = updated;
    hooks.onSpeciesPersonalChanged(speciesSlug, updated);
  }

  // Mega is species-wide (not per-form, see repository.ts), so its only
  // cascade is straight to species_personal.registered — no form-field
  // cascade machinery needed. shinyEvolved implies evolved (forward-only,
  // same rule as every other cascade: unchecking never cascades) since you
  // can't have shiny-mega-evolved something without having mega-evolved it
  // at all.
  function applyMegaPersonalField(megaVariantSlug: string, field: keyof Omit<MegaPersonal, "megaVariantSlug">, value: boolean): void {
    const current = state.megaPersonal[megaVariantSlug] ?? emptyMegaPersonal(megaVariantSlug);
    const updated: MegaPersonal = { ...current, [field]: value };
    if (value && field === "shinyEvolved") updated.evolved = true;
    state.megaPersonal[megaVariantSlug] = updated;
    hooks.onMegaPersonalChanged(megaVariantSlug, updated);

    if (!updated.evolved) return;
    const speciesSlug = speciesSlugByMegaVariantSlug.get(megaVariantSlug);
    if (!speciesSlug) return;
    const currentSpecies = state.speciesPersonal[speciesSlug] ?? emptySpeciesPersonal(speciesSlug);
    if (currentSpecies.registered) return;
    const updatedSpecies: SpeciesPersonal = { ...currentSpecies, registered: true };
    state.speciesPersonal[speciesSlug] = updatedSpecies;
    hooks.onSpeciesPersonalChanged(speciesSlug, updatedSpecies);
  }

  return {
    listRegions(): Region[] {
      return referenceData.regions;
    },

    listSpeciesByRegion(regionSlug: string): Species[] {
      return referenceData.species.filter((s) => s.regionSlug === regionSlug).sort((a, b) => a.dexNumber - b.dexNumber);
    },

    getFormTypes(formSlug: string): PokemonType[] {
      return formTypesByFormSlug.get(formSlug) ?? [];
    },

    getSpeciesWithForms(speciesSlug: string): SpeciesWithForms {
      const species = speciesBySlug.get(speciesSlug);
      if (!species) throw new Error(`Unknown species: ${speciesSlug}`);
      const forms = formsBySpecies.get(speciesSlug) ?? [];
      return {
        species,
        personal: state.speciesPersonal[speciesSlug] ?? emptySpeciesPersonal(speciesSlug),
        forms: forms.map((form) => ({
          form,
          personal: state.formPersonal[form.slug] ?? emptyFormPersonal(form.slug),
        })),
      };
    },

    listSpeciesSummaries(filter: SpeciesFilter = {}): SpeciesSummary[] {
      return speciesByDexOrder
        .filter((s) => (filter.region ? s.regionSlug === filter.region : true))
        .filter((s) => (filter.search ? matchesSearch(s, filter.search) : true))
        .map((species) => {
          const personal = state.speciesPersonal[species.slug] ?? emptySpeciesPersonal(species.slug);
          const forms = formsBySpecies.get(species.slug) ?? [];
          const formPersonals = forms.map((f) => state.formPersonal[f.slug] ?? emptyFormPersonal(f.slug));
          const indicators = {} as Record<FormPersonalBooleanField, boolean>;
          for (const field of FORM_PERSONAL_BOOLEAN_FIELDS) {
            indicators[field] = formPersonals.some((fp) => fp[field]);
          }
          return { species, personal, caught: personal.registered, indicators };
        })
        .filter((s) => {
          if (!filter.caught || filter.caught === "all") return true;
          return filter.caught === "caught" ? s.caught : !s.caught;
        })
        .filter((s) => matchesFieldFilters(s.species, s.personal, s.indicators, filter.fieldFilters))
        .map(({ personal: _personal, ...summary }) => summary);
    },

    searchSpecies(query: string, limit = 8): Species[] {
      const q = query.trim();
      if (!q) return [];
      return speciesByDexOrder.filter((s) => matchesSearch(s, q)).slice(0, limit);
    },

    getAdjacentSpecies(speciesSlug: string) {
      const index = speciesByDexOrder.findIndex((s) => s.slug === speciesSlug);
      if (index === -1) return {};
      return {
        prev: index > 0 ? speciesByDexOrder[index - 1] : undefined,
        next: index < speciesByDexOrder.length - 1 ? speciesByDexOrder[index + 1] : undefined,
      };
    },

    // Catching an XXL/XXS/purified individual implies the species itself is
    // registered — that cascade (and the single-vs-bulk-shared apply step)
    // lives in applySpeciesPersonalField above.
    setSpeciesPersonalField(speciesSlug, field, value) {
      applySpeciesPersonalField(speciesSlug, field, value);
    },

    setFormPersonalField(formSlug, field, value) {
      applyFormPersonalField(formSlug, field, value);
    },

    getMegaVariantsForSpecies(speciesSlug: string): SpeciesMegaVariant[] {
      const variants = megaVariantsBySpecies.get(speciesSlug) ?? [];
      return variants.map((variant) => ({
        variant,
        personal: state.megaPersonal[variant.slug] ?? emptyMegaPersonal(variant.slug),
      }));
    },

    setMegaPersonalField(megaVariantSlug, field, value) {
      applyMegaPersonalField(megaVariantSlug, field, value);
    },

    // Bulk variants: loop the slugs applying the same per-row cascade path as
    // the single setters. Each row still fires its hook (that's what persists);
    // sqlite-repository.ts overrides these to batch those N writes into one
    // transaction + one flush instead of persisting per row.
    async bulkSetFormPersonalField(formSlugs, field, value) {
      for (const formSlug of formSlugs) applyFormPersonalField(formSlug, field, value);
    },

    async bulkSetSpeciesPersonalField(speciesSlugs, field, value) {
      for (const speciesSlug of speciesSlugs) applySpeciesPersonalField(speciesSlug, field, value);
    },

    getAppSetting(key) {
      return state.appSettings[key];
    },

    setAppSetting,

    getIndicatorSelection(): FormPersonalBooleanField[] {
      const raw = state.appSettings[INDICATOR_SETTING_KEY];
      if (!raw) return [];
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? (parsed as FormPersonalBooleanField[]).slice(0, MAX_GRID_INDICATORS) : [];
      } catch {
        return [];
      }
    },

    setIndicatorSelection(fields: FormPersonalBooleanField[]) {
      setAppSetting(INDICATOR_SETTING_KEY, JSON.stringify(fields.slice(0, MAX_GRID_INDICATORS)));
    },

    exportPersonalData(): PersonalDataExport {
      return {
        exportedAt: new Date().toISOString(),
        schemaVersion: CURRENT_PERSONAL_SCHEMA_VERSION,
        speciesPersonal: { ...state.speciesPersonal },
        formPersonal: { ...state.formPersonal },
        appSettings: { ...state.appSettings },
        megaPersonal: { ...state.megaPersonal },
        formBackgroundPersonal: [...state.formBackgroundPersonal],
      };
    },

    async importPersonalData(data: PersonalDataExport): Promise<ImportResult> {
      // Import is a restore, not a merge: wipe the current collection first
      // so a row that exists locally but isn't in the imported file actually
      // goes away, instead of silently surviving underneath the imported
      // data. App settings/preferences are a separate table and untouched
      // here (see the appSettings loop below).
      state.speciesPersonal = {};
      state.formPersonal = {};
      state.megaPersonal = {};
      state.formBackgroundPersonal = [];
      hooks.onPersonalDataCleared();

      let skippedSpeciesSlugs = 0;
      let skippedFormSlugs = 0;
      for (const [slug, personal] of Object.entries(data.speciesPersonal)) {
        // Slug no longer resolves against the currently-loaded reference data
        // (e.g. imported from an older/newer reference.json) — writing it
        // anyway would violate the species_personal FK (silently, via the
        // swallowed write-queue error). Skip and count instead.
        if (!speciesBySlug.has(slug)) {
          skippedSpeciesSlugs++;
          continue;
        }
        state.speciesPersonal[slug] = personal;
        hooks.onSpeciesPersonalChanged(slug, personal);
      }
      for (const [slug, personal] of Object.entries(data.formPersonal)) {
        if (!speciesSlugByFormSlug.has(slug)) {
          skippedFormSlugs++;
          continue;
        }
        state.formPersonal[slug] = personal;
        hooks.onFormPersonalChanged(slug, personal);
      }
      // Optional: absent entirely on an export file from before this field
      // existed. Not counted in ImportResult's skip counts (that's about
      // rows that resolve to a stale/unknown slug, not a whole-field gap in
      // an older export) — silently skipped is correct here, since "not
      // present" just means the exporting device had never used mega yet.
      for (const [slug, personal] of Object.entries(data.megaPersonal ?? {})) {
        if (!speciesSlugByMegaVariantSlug.has(slug)) continue;
        state.megaPersonal[slug] = personal;
        hooks.onMegaPersonalChanged(slug, personal);
      }
      for (const [key, value] of Object.entries(data.appSettings)) {
        // reference_data_version is reference-sync bookkeeping (a content
        // hash of the app's bundled reference.json), not user data. Importing
        // another device's value overwrites the local marker and forces a
        // spurious reference-table re-sync on the next load — skip it so an
        // import only touches the user's own settings.
        if (key === IMPORT_SKIP_SETTING_KEY) continue;
        setAppSetting(key, value);
      }
      // Base implementation has nothing async to wait for — sqlite-repository.ts
      // overrides this to also await its pending write queue.
      return { skippedSpeciesSlugs, skippedFormSlugs };
    },
  };
}
