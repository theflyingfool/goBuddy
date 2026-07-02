// Shared in-memory query/filter engine backing both repository
// implementations (src/data/dummy-repository.ts and
// src/data/sqlite-repository.ts). Reference data is read-only once loaded;
// personal data lives in a plain mutable object here, and every mutation
// calls a hook so the caller can write it through to wherever it actually
// persists (localStorage for the dummy backend, real SQLite for the other)
// without this module needing to know which.

import { resolveFormFieldCascade } from "../db/cascades";
import { emptyFormPersonal, emptySpeciesPersonal } from "../db/defaults";
import type { ReferenceData } from "../db/reference-data";
import { CURRENT_PERSONAL_SCHEMA_VERSION } from "../db/schema";
import { FORM_PERSONAL_BOOLEAN_FIELDS, type Form, type FormPersonal, type FormPersonalBooleanField, type Region, type Species, type SpeciesPersonal } from "../db/types";
import {
  MAX_GRID_INDICATORS,
  type CompletionLens,
  type CompletionLensResult,
  type CompletionMissingSpecies,
  type CompletionScope,
  type GridFilterField,
  type PersonalDataExport,
  type Repository,
  type SpeciesFilter,
  type SpeciesSummary,
  type SpeciesWithForms,
} from "./repository";

const INDICATOR_SETTING_KEY = "grid_indicators";

export interface PersonalState {
  speciesPersonal: Record<string, SpeciesPersonal>;
  formPersonal: Record<string, FormPersonal>;
  appSettings: Record<string, string>;
}

export interface InMemoryStoreHooks {
  onSpeciesPersonalChanged(speciesSlug: string, personal: SpeciesPersonal): void;
  onFormPersonalChanged(formSlug: string, personal: FormPersonal): void;
  onAppSettingChanged(key: string, value: string): void;
}

export function createInMemoryRepository(referenceData: ReferenceData, state: PersonalState, hooks: InMemoryStoreHooks): Repository {
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

  function matchesSearch(species: Species, search: string): boolean {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return species.name.toLowerCase().includes(q) || String(species.dexNumber).includes(q);
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
      case "dynamaxCapable":
        return (formsBySpecies.get(species.slug) ?? []).some((f) => f.dynamaxAvailable);
      case "gigantamaxCapable":
        return (formsBySpecies.get(species.slug) ?? []).some((f) => f.gigantamaxAvailable);
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

  function speciesInScope(scope: CompletionScope): Species[] {
    switch (scope.kind) {
      case "region":
        return referenceData.species.filter((s) => s.regionSlug === scope.regionSlug);
      case "species":
        return referenceData.species.filter((s) => s.slug === scope.speciesSlug);
      case "global":
        return referenceData.species;
    }
  }

  function toMissing(s: Species): CompletionMissingSpecies {
    return { slug: s.slug, name: s.name, dexNumber: s.dexNumber };
  }

  function formCaught(form: Form): boolean {
    return (state.formPersonal[form.slug] ?? emptyFormPersonal(form.slug)).caught;
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

  function computeLens(lens: CompletionLens, scoped: Species[]): CompletionLensResult {
    if (lens.kind === "registered") {
      const missing = scoped.filter((s) => !(state.speciesPersonal[s.slug] ?? emptySpeciesPersonal(s.slug)).registered);
      return { lens, total: scoped.length, complete: scoped.length - missing.length, missingSpecies: missing.map(toMissing) };
    }

    if (lens.kind === "formComplete") {
      const missing = scoped.filter((s) => (formsBySpecies.get(s.slug) ?? []).filter((f) => f.costumeName === null).some((f) => !formCaught(f)));
      return { lens, total: scoped.length, complete: scoped.length - missing.length, missingSpecies: missing.map(toMissing) };
    }

    if (lens.kind === "costumeComplete") {
      // Denominator is species that actually have a costume — most species
      // never got one, and counting them as trivially "complete" would make
      // this stat meaningless (inflated by species with nothing to catch).
      const withCostumes = scoped.filter((s) => (formsBySpecies.get(s.slug) ?? []).some((f) => f.costumeName !== null));
      const missing = withCostumes.filter((s) => (formsBySpecies.get(s.slug) ?? []).filter((f) => f.costumeName !== null).some((f) => !formCaught(f)));
      return { lens, total: withCostumes.length, complete: withCostumes.length - missing.length, missingSpecies: missing.map(toMissing) };
    }

    // achievement: a species "has" the lens if ANY of its forms has that boolean true.
    const missing = scoped.filter((s) => !(formsBySpecies.get(s.slug) ?? []).some((f) => (state.formPersonal[f.slug] ?? emptyFormPersonal(f.slug))[lens.field]));
    return { lens, total: scoped.length, complete: scoped.length - missing.length, missingSpecies: missing.map(toMissing) };
  }

  return {
    listRegions(): Region[] {
      return referenceData.regions;
    },

    listSpeciesByRegion(regionSlug: string): Species[] {
      return referenceData.species.filter((s) => s.regionSlug === regionSlug).sort((a, b) => a.dexNumber - b.dexNumber);
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

    setSpeciesPersonalField(speciesSlug, field, value) {
      const current = state.speciesPersonal[speciesSlug] ?? emptySpeciesPersonal(speciesSlug);
      // Catching an XXL/XXS/purified individual implies the species itself
      // is registered — same forward-only cascade rule as form fields, just
      // a one-off since there are only 3 species-level fields (no shared
      // group structure worth factoring like FORM_FIELD_CASCADES).
      const impliesRegistered = value && (field === "xxl" || field === "xxs" || field === "purified");
      const updated: SpeciesPersonal = { ...current, [field]: value, ...(impliesRegistered ? { registered: true } : {}) };
      state.speciesPersonal[speciesSlug] = updated;
      hooks.onSpeciesPersonalChanged(speciesSlug, updated);
    },

    setFormPersonalField(formSlug, field, value) {
      const current = state.formPersonal[formSlug] ?? emptyFormPersonal(formSlug);
      const updated = mergeFormPersonalCascade(current, field, value);
      state.formPersonal[formSlug] = updated;
      hooks.onFormPersonalChanged(formSlug, updated);
      cascadeSpeciesRegisteredForForm(formSlug, updated);
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

    async getCompletionStats(scope: CompletionScope, lenses: CompletionLens[]): Promise<CompletionLensResult[]> {
      const scoped = speciesInScope(scope);
      return lenses.map((lens) => computeLens(lens, scoped));
    },

    exportPersonalData(): PersonalDataExport {
      return {
        exportedAt: new Date().toISOString(),
        schemaVersion: CURRENT_PERSONAL_SCHEMA_VERSION,
        speciesPersonal: { ...state.speciesPersonal },
        formPersonal: { ...state.formPersonal },
        appSettings: { ...state.appSettings },
      };
    },

    async importPersonalData(data: PersonalDataExport): Promise<void> {
      for (const [slug, personal] of Object.entries(data.speciesPersonal)) {
        state.speciesPersonal[slug] = personal;
        hooks.onSpeciesPersonalChanged(slug, personal);
      }
      for (const [slug, personal] of Object.entries(data.formPersonal)) {
        state.formPersonal[slug] = personal;
        hooks.onFormPersonalChanged(slug, personal);
      }
      for (const [key, value] of Object.entries(data.appSettings)) {
        setAppSetting(key, value);
      }
      // Base implementation has nothing async to wait for (the dummy
      // backend's localStorage write is synchronous) — sqlite-repository.ts
      // overrides this to also await its pending write queue.
    },
  };
}
