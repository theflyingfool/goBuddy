// The interface the UI codes against. The real implementation (backed by
// capacitor-community/sqlite) will satisfy this same shape later — the UI
// layer shouldn't need to change when that swap happens.

import type { Form, FormBackgroundPersonal, FormPersonal, FormPersonalBooleanField, MegaPersonal, MegaVariant, PokemonType, Region, Species, SpeciesPersonal } from "../db/types";

export interface SpeciesWithForms {
  species: Species;
  personal: SpeciesPersonal;
  forms: { form: Form; personal: FormPersonal }[];
}

export interface SpeciesMegaVariant {
  variant: MegaVariant;
  personal: MegaPersonal;
}

export interface SpeciesSummary {
  species: Species;
  /** = personal.registered — drives grayscale-until-caught on the grid. */
  caught: boolean;
  /** OR-aggregated across every form of this species, for every achievement field. */
  indicators: Record<FormPersonalBooleanField, boolean>;
}

// Derived from Species.rarity, not a stored boolean — but worth filtering by
// on the grid same as any tracked achievement field, and (per the user)
// deliberately *not* one of the Settings-configurable indicator badges.
export type RarityFilterField = "legendary" | "mythical" | "ultraBeast";

export type SearchKeyword = RarityFilterField | "costume";

export interface ParsedSearch {
  keyword: SearchKeyword | null;
  negate: boolean;
  /** Plain substring to match against name/dex number — empty when `keyword` is set. */
  text: string;
}

const SEARCH_KEYWORD_ALIASES: Record<string, SearchKeyword> = {
  costume: "costume",
  legendary: "legendary",
  mythical: "mythical",
  ultrabeast: "ultraBeast",
  ultrabeasts: "ultraBeast",
};

// Minimal keyword search: recognizes a handful of PoGo-style search tokens
// (costume/legendary/mythical/ultrabeast, optionally negated with a leading
// "!") when the ENTIRE trimmed query is exactly one such token — anything
// else falls through to plain substring matching. Deliberately not the full
// AND-of-OR search-string builder specced in docs/features/planned.md
// (post-V1) — just enough to answer "show me only X" in the box that's
// already there. Shared by the grid and bulk-edit's search inputs, both of
// which route through Repository.listSpeciesSummaries.
export function parseSearchQuery(raw: string): ParsedSearch {
  const trimmed = raw.trim();
  const negate = trimmed.startsWith("!");
  const body = negate ? trimmed.slice(1) : trimmed;
  const keyword = SEARCH_KEYWORD_ALIASES[body.toLowerCase()];
  // "!" only means anything in front of a recognized keyword — a name has no
  // negated form, so "!raichu" falls back to a plain search for "raichu"
  // rather than silently matching nothing (no species name contains "!").
  return keyword ? { keyword, negate, text: "" } : { keyword: null, negate: false, text: body };
}

// Species-level personal facts, same reasoning as the rarity fields above:
// real tracked data, just not part of the form-level indicator/badge system.
export type SpeciesBooleanField = "xxl" | "xxs" | "purified";

// Reference-data *availability* — "can this species/form ever be Mega
// Evolved/Dynamaxed/Gigantamaxed", derived from species.canMegaEvolve /
// form.dynamaxAvailable / species.canGigantamax. Distinct from the
// same-named personal achievement fields (e.g. form_personal.dynamax = "have
// I already caught one") — conflating the two is exactly what made
// "Uncaught + Dynamax" return nothing (a species you haven't caught can't
// have any personal achievement true). Grouped with rarity as "species
// classification" in the UI, not mixed into the achievement filter list.
export type AvailabilityFilterField = "megaCapable" | "dynamaxCapable" | "gigantamaxCapable";

// Personal achievement, species-wide like registered/xxl/xxs/purified — but
// tracked in mega_personal (see SpeciesMegaVariant below), not
// species_personal, so it needs its own filter-field type rather than
// folding into SpeciesBooleanField.
export type MegaAchievementFilterField = "megaEvolved";

export type GridFilterField = FormPersonalBooleanField | SpeciesBooleanField | RarityFilterField | AvailabilityFilterField | MegaAchievementFilterField;

export interface SpeciesFilter {
  region?: string;
  search?: string;
  caught?: "all" | "caught" | "uncaught";
  /** Tri-state quick filters beyond All/Caught/Uncaught — omitted fields apply no filter. */
  fieldFilters?: Partial<Record<GridFilterField, "include" | "exclude">>;
}

// CLAUDE.md's completion-stats feature: scope (what set of species) and lens
// (what "complete" means) are independent axes, so a single parameterized
// query handles every region/species-column combination rather than
// hand-rolled one-offs per region or per achievement field.
export type CompletionScope = { kind: "region"; regionSlug: string } | { kind: "species"; speciesSlug: string } | { kind: "global" };

export type CompletionLens =
  | { kind: "registered" }
  | { kind: "formComplete" }
  | { kind: "costumeComplete" }
  | { kind: "gigantamaxComplete" }
  | { kind: "megaComplete" }
  | { kind: "megaShinyComplete" }
  | { kind: "achievement"; field: FormPersonalBooleanField };

export interface CompletionMissingSpecies {
  slug: string;
  name: string;
  dexNumber: number;
}

export interface CompletionLensResult {
  lens: CompletionLens;
  complete: number;
  total: number;
  /** Species in scope that don't satisfy this lens — drill-down list. */
  missingSpecies: CompletionMissingSpecies[];
}

// Manual cross-device transfer of personal data — export a file, move it
// wherever (Drive, email, USB), import it on another install. Reference
// data (species/forms/etc.) is deliberately excluded: it's already
// wholesale-replaceable from the bundled reference.json, so exporting it
// would be redundant and risks a version mismatch if an old export gets
// loaded into a newer app build.
export interface PersonalDataExport {
  exportedAt: string;
  /** CURRENT_PERSONAL_SCHEMA_VERSION at export time — compared on import so a version drift is surfaced, not silently applied. */
  schemaVersion: number;
  speciesPersonal: Record<string, SpeciesPersonal>;
  formPersonal: Record<string, FormPersonal>;
  appSettings: Record<string, string>;
  /** Keyed by mega_variant slug. Optional only for reading older export files that predate this field — always populated on export going forward. */
  megaPersonal?: Record<string, MegaPersonal>;
  /** No single natural slug key (composite PK: form + achievement field + background) — a flat array, same as the DB row shape. Same backward-compat note as megaPersonal. */
  formBackgroundPersonal?: FormBackgroundPersonal[];
}

export interface Repository {
  listRegions(): Region[];
  listSpeciesByRegion(regionSlug: string): Species[];
  getSpeciesWithForms(speciesSlug: string): SpeciesWithForms;
  /** Types for one form, in reference-data order (primary first). Species-detail uses its first form as the species' representative typing. */
  getFormTypes(formSlug: string): PokemonType[];

  /** Grid data: one summary per species, optionally filtered by region and/or a name/dex substring search. */
  listSpeciesSummaries(filter?: SpeciesFilter): SpeciesSummary[];
  /** Name/dex-number substring search across all species, for the detail-view quick-jump. */
  searchSpecies(query: string, limit?: number): Species[];
  /** Previous/next species by National Dex order, for detail-view navigation. */
  getAdjacentSpecies(speciesSlug: string): { prev?: Species; next?: Species };

  setSpeciesPersonalField(speciesSlug: string, field: keyof Omit<SpeciesPersonal, "speciesSlug">, value: boolean): void;
  setFormPersonalField(formSlug: string, field: keyof Omit<FormPersonal, "formSlug">, value: boolean): void;

  /**
   * Mega is species-wide, not per-form — any non-Shadow individual of the
   * species can be temporarily Mega Evolved regardless of which costume it
   * is, so (unlike forms) this isn't gated by anything on the Form row.
   * Returns the variant rows paired with their personal state (0 rows for
   * most species, 1 for single-variant megas, 2 for Charizard).
   */
  getMegaVariantsForSpecies(speciesSlug: string): SpeciesMegaVariant[];
  setMegaPersonalField(megaVariantSlug: string, field: keyof Omit<MegaPersonal, "megaVariantSlug">, value: boolean): void;

  /**
   * Batched equivalents of the two single setters above, for the bulk-edit
   * features. Each applies the SAME cascade behavior as its single counterpart
   * to every slug in the list — the form version reuses mergeFormPersonalCascade
   * plus the species-registered cascade (so bulk-setting e.g. fourStar also
   * marks each form caught and its species registered), the species version
   * reuses the xxl/xxs/purified → registered cascade. Async because the real
   * SQLite backend overrides these to collapse the N per-row writes into a
   * single transaction + a single IndexedDB persist flush (vs. one flush per
   * row the naive path would produce).
   */
  bulkSetFormPersonalField(formSlugs: string[], field: FormPersonalBooleanField, value: boolean): Promise<void>;
  bulkSetSpeciesPersonalField(speciesSlugs: string[], field: keyof Omit<SpeciesPersonal, "speciesSlug">, value: boolean): Promise<void>;

  getAppSetting(key: string): string | undefined;
  setAppSetting(key: string, value: string): void;

  /** Which achievement fields show as grid badges, capped at MAX_GRID_INDICATORS. */
  getIndicatorSelection(): FormPersonalBooleanField[];
  setIndicatorSelection(fields: FormPersonalBooleanField[]): void;

  /** %-complete (+ missing-species drill-down) for each requested lens, within one scope. */
  getCompletionStats(scope: CompletionScope, lenses: CompletionLens[]): Promise<CompletionLensResult[]>;

  /** Snapshot of all personal data (not reference data) for manual cross-device transfer. */
  exportPersonalData(): PersonalDataExport;
  /**
   * Writes every entry in the export through the same paths setSpeciesPersonalField/etc. use —
   * overwrites matching entries, leaves anything not present in the file untouched. Resolves only
   * once the write-through to the real backing store has actually completed — callers that reload
   * the page right after importing (as Settings does) need that guarantee, not just that the
   * in-memory cache was updated.
   *
   * Rows whose slug doesn't resolve against the currently-loaded reference
   * data (e.g. an export from an older/newer reference.json) are skipped
   * rather than written — the returned counts let the caller report that
   * instead of it happening invisibly.
   */
  importPersonalData(data: PersonalDataExport): Promise<ImportResult>;
}

export interface ImportResult {
  skippedSpeciesSlugs: number;
  skippedFormSlugs: number;
}

export const MAX_GRID_INDICATORS = 4;

// Read by both backends' getCompletionStats (in-memory-store.ts directly,
// sqlite-repository.ts to pass through to the SQL lens) and written by
// Settings — public since it's a real cross-layer contract, not an
// implementation detail of either backend.
export const EXCLUDE_REGIONAL_SETTING_KEY = "exclude_regional_form_complete";
