// Hand-written personal-table demo overlay — there's still no real personal
// progress data anywhere (confirmed: the source CSVs are blank trackers).
// This just seeds a handful of toggles on real species/forms (now sourced
// from the real ingested src/data/reference.json) so the UI has something
// to demonstrate against on first load.

import { emptyFormPersonal } from "../db/defaults";
import type { FormBackgroundPersonal, FormPersonal, MegaPersonal, SpeciesPersonal } from "../db/types";

export const speciesPersonal: SpeciesPersonal[] = [
  { speciesSlug: "bulbasaur", registered: true, xxl: false, xxs: false, purified: false },
  { speciesSlug: "charizard", registered: true, xxl: true, xxs: false, purified: false },
  { speciesSlug: "snorlax", registered: true, xxl: true, xxs: false, purified: false },
  { speciesSlug: "eevee", registered: true, xxl: false, xxs: true, purified: false },
];

export const formPersonal: FormPersonal[] = [
  emptyFormPersonal("bulbasaur-standard-male", { caught: true, floor: true, lucky: true }),
  emptyFormPersonal("charizard-standard-male", { caught: true, fourStar: true, shiny: true }),
  emptyFormPersonal("snorlax-standard-male", { caught: true, shundo: true, shiny: true }),
  emptyFormPersonal("eevee-standard-female", { caught: true, lucky: true }),
  emptyFormPersonal("growlithe-standard-male", { caught: true }),
];

export const formBackgroundPersonal: FormBackgroundPersonal[] = [
  { formSlug: "bulbasaur-standard-male", achievementField: "caught", backgroundSlug: "spring-2024" },
  { formSlug: "bulbasaur-standard-male", achievementField: "lucky", backgroundSlug: "anniversary-2016" },
];

export const megaPersonal: MegaPersonal[] = [
  { megaVariantSlug: "charizard-mega-x", evolved: true, shinyEvolved: false },
];

export const defaultAppSettings: Record<string, string> = {
  collapse_gender_forms: "0",
  grid_indicators: JSON.stringify(["shiny", "lucky", "fourStar"]),
};
