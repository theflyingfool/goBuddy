import { test } from "node:test";
import assert from "node:assert/strict";

import { createInMemoryRepository, type PersonalState } from "../src/data/in-memory-store";
import type { ReferenceData } from "../src/db/reference-data";

const referenceData: ReferenceData = {
  regions: [{ slug: "kanto", name: "Kanto" }],
  types: [],
  backgrounds: [],
  species: [
    {
      slug: "bulbasaur",
      dexNumber: 1,
      name: "Bulbasaur",
      familySlug: "bulbasaur",
      gen: 1,
      rarity: "standard",
      regionSlug: "kanto",
      hasMale: true,
      hasFemale: true,
      canMegaEvolve: false,
      canGigantamax: false,
    },
  ],
  forms: [
    {
      slug: "bulbasaur-standard",
      speciesSlug: "bulbasaur",
      formName: "Standard",
      costumeName: null,
      gender: "male",
      evolves: true,
      shinyAvailable: true,
      shadowAvailable: false,
      dynamaxAvailable: false,
      regionalExclusive: false,
      imageRef: null,
    },
  ],
  formTypes: [],
  megaVariants: [],
};

function emptyState(): PersonalState {
  return { speciesPersonal: {}, formPersonal: {}, appSettings: {}, megaPersonal: {}, formBackgroundPersonal: [] };
}

const noopHooks = {
  onSpeciesPersonalChanged() {},
  onFormPersonalChanged() {},
  onAppSettingChanged() {},
  onMegaPersonalChanged() {},
  onPersonalDataCleared() {},
};

test("export/import round-trips species, form, and app-setting personal data", async () => {
  const sourceState = emptyState();
  const source = createInMemoryRepository(referenceData, sourceState, noopHooks);

  source.setSpeciesPersonalField("bulbasaur", "xxl", true);
  source.setFormPersonalField("bulbasaur-standard", "shiny", true);
  source.setAppSetting("grid_indicators", JSON.stringify(["shiny"]));

  const exported = source.exportPersonalData();

  const destState = emptyState();
  const dest = createInMemoryRepository(referenceData, destState, noopHooks);
  const result = await dest.importPersonalData(exported);

  assert.deepEqual(result, { skippedSpeciesSlugs: 0, skippedFormSlugs: 0 });

  const withForms = dest.getSpeciesWithForms("bulbasaur");
  // xxl implies registered (see applySpeciesPersonalField's cascade) — the
  // export/import path reuses this repo's setters, but importPersonalData
  // writes state directly rather than re-deriving cascades, so it's the
  // *exporting* side's cascade we're really confirming survived the trip.
  assert.equal(withForms.personal.xxl, true);
  assert.equal(withForms.personal.registered, true);
  assert.equal(withForms.forms[0].personal.shiny, true);
  assert.equal(dest.getAppSetting("grid_indicators"), JSON.stringify(["shiny"]));
});

test("import skips rows whose slug no longer resolves against the loaded reference data, and counts them", async () => {
  const destState = emptyState();
  const dest = createInMemoryRepository(referenceData, destState, noopHooks);

  const result = await dest.importPersonalData({
    exportedAt: new Date().toISOString(),
    schemaVersion: 1,
    speciesPersonal: {
      bulbasaur: { speciesSlug: "bulbasaur", registered: true, xxl: false, xxs: false, purified: false },
      "no-longer-exists": { speciesSlug: "no-longer-exists", registered: true, xxl: false, xxs: false, purified: false },
    },
    formPersonal: {},
    appSettings: {},
  });

  assert.equal(result.skippedSpeciesSlugs, 1);
  assert.equal(result.skippedFormSlugs, 0);
  assert.equal(dest.getSpeciesWithForms("bulbasaur").personal.registered, true);
});

test("import replaces the current collection instead of merging with it", async () => {
  const destState = emptyState();
  const dest = createInMemoryRepository(referenceData, destState, noopHooks);

  // Local data that the about-to-be-imported file knows nothing about.
  dest.setSpeciesPersonalField("bulbasaur", "xxl", true);
  dest.setFormPersonalField("bulbasaur-standard", "shiny", true);
  dest.setAppSetting("grid_indicators", JSON.stringify(["shiny"]));

  const result = await dest.importPersonalData({
    exportedAt: new Date().toISOString(),
    schemaVersion: 1,
    speciesPersonal: {},
    formPersonal: {},
    appSettings: {},
  });

  assert.deepEqual(result, { skippedSpeciesSlugs: 0, skippedFormSlugs: 0 });
  const withForms = dest.getSpeciesWithForms("bulbasaur");
  assert.equal(withForms.personal.xxl, false);
  assert.equal(withForms.personal.registered, false);
  assert.equal(withForms.forms[0].personal.shiny, false);
  // App settings/preferences are a separate table, untouched by the clear.
  assert.equal(dest.getAppSetting("grid_indicators"), JSON.stringify(["shiny"]));
});

test("import never overwrites reference_data_version from another device's export", async () => {
  const destState = emptyState();
  destState.appSettings.reference_data_version = "local-hash";
  const dest = createInMemoryRepository(referenceData, destState, noopHooks);

  await dest.importPersonalData({
    exportedAt: new Date().toISOString(),
    schemaVersion: 1,
    speciesPersonal: {},
    formPersonal: {},
    appSettings: { reference_data_version: "other-devices-hash", collapse_gender_forms: "1" },
  });

  assert.equal(dest.getAppSetting("reference_data_version"), "local-hash");
  assert.equal(dest.getAppSetting("collapse_gender_forms"), "1");
});
