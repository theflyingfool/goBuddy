// The interface the UI codes against. The real implementation (backed by
// capacitor-community/sqlite) will satisfy this same shape later — the UI
// layer shouldn't need to change when that swap happens.

import type { Form, FormPersonal, FormPersonalBooleanField, Region, Species, SpeciesPersonal } from "../db/types";

export interface SpeciesWithForms {
  species: Species;
  personal: SpeciesPersonal;
  forms: { form: Form; personal: FormPersonal }[];
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

// Species-level personal facts, same reasoning as the rarity fields above:
// real tracked data, just not part of the form-level indicator/badge system.
export type SpeciesBooleanField = "xxl" | "xxs" | "purified";

// Reference-data *availability* — "can this species/form ever be Mega
// Evolved/Dynamaxed/Gigantamaxed", derived from species.canMegaEvolve /
// form.dynamaxAvailable / form.gigantamaxAvailable. Distinct from the
// same-named personal achievement fields (e.g. form_personal.dynamax = "have
// I already caught one") — conflating the two is exactly what made
// "Uncaught + Dynamax" return nothing (a species you haven't caught can't
// have any personal achievement true). Grouped with rarity as "species
// classification" in the UI, not mixed into the achievement filter list.
export type AvailabilityFilterField = "megaCapable" | "dynamaxCapable" | "gigantamaxCapable";

export type GridFilterField = FormPersonalBooleanField | SpeciesBooleanField | RarityFilterField | AvailabilityFilterField;

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
}

export interface Repository {
  listRegions(): Region[];
  listSpeciesByRegion(regionSlug: string): Species[];
  getSpeciesWithForms(speciesSlug: string): SpeciesWithForms;

  /** Grid data: one summary per species, optionally filtered by region and/or a name/dex substring search. */
  listSpeciesSummaries(filter?: SpeciesFilter): SpeciesSummary[];
  /** Name/dex-number substring search across all species, for the detail-view quick-jump. */
  searchSpecies(query: string, limit?: number): Species[];
  /** Previous/next species by National Dex order, for detail-view navigation. */
  getAdjacentSpecies(speciesSlug: string): { prev?: Species; next?: Species };

  setSpeciesPersonalField(speciesSlug: string, field: keyof Omit<SpeciesPersonal, "speciesSlug">, value: boolean): void;
  setFormPersonalField(formSlug: string, field: keyof Omit<FormPersonal, "formSlug">, value: boolean): void;

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
   */
  importPersonalData(data: PersonalDataExport): Promise<void>;
}

export const MAX_GRID_INDICATORS = 4;
