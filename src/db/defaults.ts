import type { FormPersonal, SpeciesPersonal } from "./types";

// Real, sensible defaults for a brand-new install — not demo data (see
// personal-demo-seed.ts for that). sqlite-repository.ts seeds app_settings
// with these when none exist yet, so a fresh install isn't left with zero
// grid badges/filters until a user visits Settings.
export const DEFAULT_APP_SETTINGS: Record<string, string> = {
  collapse_gender_forms: "0",
  grid_indicators: JSON.stringify(["shiny", "lucky", "fourStar"]),
};

export function emptySpeciesPersonal(speciesSlug: string): SpeciesPersonal {
  return { speciesSlug, registered: false, xxl: false, xxs: false, purified: false };
}

export function emptyFormPersonal(formSlug: string, overrides: Partial<Omit<FormPersonal, "formSlug">> = {}): FormPersonal {
  return {
    formSlug,
    caught: false,
    shiny: false,
    floor: false,
    fourStar: false,
    shundo: false,
    lucky: false,
    luckyShiny: false,
    luckyFloor: false,
    luckyFourStar: false,
    luckyShundo: false,
    shadow: false,
    shadowShiny: false,
    shadowFloor: false,
    shadowFourStar: false,
    shadowShundo: false,
    dynamax: false,
    dynamaxFloor: false,
    dynamaxShiny: false,
    dynamaxFourStar: false,
    dynamaxShundo: false,
    luckyDynamax: false,
    luckyDynamaxFloor: false,
    luckyDynamaxShiny: false,
    luckyDynamaxFourStar: false,
    luckyDynamaxShundo: false,
    bestShiny: null,
    bestNonShiny: null,
    bestLucky: null,
    ...overrides,
  };
}
