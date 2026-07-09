// Dummy backend: pure-browser fallback (no Capacitor/SQLite dependency at
// all) seeded from the real ingested src/data/reference.json (reference
// tables) plus a small hand-written personal-demo-seed.ts overlay (personal
// tables — there's still no real progress data to migrate), persisted to
// localStorage. Kept around as a lightweight fallback/reference after
// src/data/sqlite-repository.ts became the app's real backend (see TODO.md
// milestone A) — main.ts no longer uses this one.

import type { ReferenceData } from "../db/reference-data";
import { DEFAULT_APP_SETTINGS, emptyFormPersonal, emptySpeciesPersonal } from "../db/defaults";
import type { FormPersonal, MegaPersonal, SpeciesPersonal } from "../db/types";
import referenceDataJson from "./reference.json";
import * as personalSeed from "./personal-demo-seed";
import { createInMemoryRepository, type PersonalState } from "./in-memory-store";
import type { Repository } from "./repository";

const referenceData = referenceDataJson as unknown as ReferenceData;

const STORAGE_KEY = "pogo-buddy-dummy-state-v2";

function loadInitialState(): PersonalState {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      return JSON.parse(raw) as PersonalState;
    } catch {
      // fall through to fresh seed on parse failure
    }
  }

  const speciesPersonal: Record<string, SpeciesPersonal> = {};
  for (const s of referenceData.species) speciesPersonal[s.slug] = emptySpeciesPersonal(s.slug);
  for (const sp of personalSeed.speciesPersonal) speciesPersonal[sp.speciesSlug] = sp;

  const formPersonal: Record<string, FormPersonal> = {};
  for (const f of referenceData.forms) formPersonal[f.slug] = emptyFormPersonal(f.slug);
  for (const fp of personalSeed.formPersonal) formPersonal[fp.formSlug] = fp;

  const megaPersonal: Record<string, MegaPersonal> = {};
  for (const mp of personalSeed.megaPersonal) megaPersonal[mp.megaVariantSlug] = mp;

  return {
    speciesPersonal,
    formPersonal,
    appSettings: { ...DEFAULT_APP_SETTINGS },
    megaPersonal,
    formBackgroundPersonal: [...personalSeed.formBackgroundPersonal],
  };
}

export function createDummyRepository(): Repository {
  const state = loadInitialState();

  function persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  return createInMemoryRepository(referenceData, state, {
    onSpeciesPersonalChanged: persist,
    onFormPersonalChanged: persist,
    onAppSettingChanged: persist,
    onMegaPersonalChanged: persist,
  });
}
