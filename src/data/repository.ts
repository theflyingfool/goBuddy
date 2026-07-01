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

export type GridFilterField = FormPersonalBooleanField | SpeciesBooleanField | RarityFilterField;

export interface SpeciesFilter {
  region?: string;
  search?: string;
  caught?: "all" | "caught" | "uncaught";
  /** Tri-state quick filters beyond All/Caught/Uncaught — omitted fields apply no filter. */
  fieldFilters?: Partial<Record<GridFilterField, "include" | "exclude">>;
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

  getAppSetting(key: string): string | undefined;
  setAppSetting(key: string, value: string): void;

  /** Which achievement fields show as grid badges, capped at MAX_GRID_INDICATORS. */
  getIndicatorSelection(): FormPersonalBooleanField[];
  setIndicatorSelection(fields: FormPersonalBooleanField[]): void;
}

export const MAX_GRID_INDICATORS = 4;
