import type { FormPersonal, SpeciesPersonal } from "./types";

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
