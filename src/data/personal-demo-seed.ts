// Hand-written personal-table demo overlay — there's still no real personal
// progress data anywhere (confirmed: the source CSVs are blank trackers).
// This just seeds a handful of toggles on real species/forms (now sourced
// from the real ingested src/data/reference.json) so a generated dummy.sqlite
// (scripts/build-dummy-db.ts, for manual DB inspection) has something to look
// at. A fresh real on-device install never sees any of this — sqlite-repository.ts
// doesn't import it (it seeds fresh installs from DEFAULT_APP_SETTINGS in
// db/defaults.ts instead, which is real config, not demo data).

import { emptyFormPersonal } from "../db/defaults";
import type { FormBackgroundPersonal, FormPersonal, MegaPersonal, SpeciesPersonal } from "../db/types";

// Any fixed value works for demo data — real rows get a real
// updatedAt from applyXPersonalField, this is only for dummy.sqlite.
const DEMO_UPDATED_AT = "2024-01-01T00:00:00.000Z";

export const speciesPersonal: SpeciesPersonal[] = [
  { speciesSlug: "bulbasaur", registered: true, xxl: false, xxs: false, purified: false, updatedAt: DEMO_UPDATED_AT },
  { speciesSlug: "charizard", registered: true, xxl: true, xxs: false, purified: false, updatedAt: DEMO_UPDATED_AT },
  { speciesSlug: "snorlax", registered: true, xxl: true, xxs: false, purified: false, updatedAt: DEMO_UPDATED_AT },
  { speciesSlug: "eevee", registered: true, xxl: false, xxs: true, purified: false, updatedAt: DEMO_UPDATED_AT },
];

export const formPersonal: FormPersonal[] = [
  emptyFormPersonal("bulbasaur-standard-male", { caught: true, floor: true, lucky: true, updatedAt: DEMO_UPDATED_AT }),
  emptyFormPersonal("charizard-standard-male", { caught: true, fourStar: true, shiny: true, updatedAt: DEMO_UPDATED_AT }),
  emptyFormPersonal("snorlax-standard-male", { caught: true, shundo: true, shiny: true, updatedAt: DEMO_UPDATED_AT }),
  emptyFormPersonal("eevee-standard-female", { caught: true, lucky: true, updatedAt: DEMO_UPDATED_AT }),
  emptyFormPersonal("growlithe-standard-male", { caught: true, updatedAt: DEMO_UPDATED_AT }),
];

export const formBackgroundPersonal: FormBackgroundPersonal[] = [
  { formSlug: "bulbasaur-standard-male", achievementField: "caught", backgroundSlug: "spring-2024", updatedAt: DEMO_UPDATED_AT },
  { formSlug: "bulbasaur-standard-male", achievementField: "lucky", backgroundSlug: "anniversary-2016", updatedAt: DEMO_UPDATED_AT },
];

export const megaPersonal: MegaPersonal[] = [
  { megaVariantSlug: "charizard-mega-x", evolved: true, shinyEvolved: false, currentMegaLevel: 1, updatedAt: DEMO_UPDATED_AT },
];
