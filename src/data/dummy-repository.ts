// Dummy backend: in-memory store seeded from the real ingested
// src/data/reference.json (reference tables) plus a small hand-written
// personal-demo-seed.ts overlay (personal tables — there's still no real
// progress data to migrate), persisted to localStorage purely so toggles
// survive a page reload during development. This entire file is throwaway
// scaffolding — it exists only to unblock building the UI before the real
// capacitor-community/sqlite-backed client exists. It satisfies the same
// Repository interface the real client will, so swapping it out later is a
// one-line change in main.ts, not a UI rewrite.

import { emptyFormPersonal, emptySpeciesPersonal } from "../db/defaults";
import type { ReferenceData } from "../db/reference-data";
import { FORM_PERSONAL_BOOLEAN_FIELDS, type Form, type FormPersonal, type FormPersonalBooleanField, type Region, type Species, type SpeciesPersonal } from "../db/types";
import referenceDataJson from "./reference.json";
import * as personalSeed from "./personal-demo-seed";
import { MAX_GRID_INDICATORS, type Repository, type SpeciesFilter, type SpeciesSummary, type SpeciesWithForms } from "./repository";

const referenceData = referenceDataJson as unknown as ReferenceData;

const STORAGE_KEY = "pogo-buddy-dummy-state-v2";
const INDICATOR_SETTING_KEY = "grid_indicators";

interface PersistedState {
  speciesPersonal: Record<string, SpeciesPersonal>;
  formPersonal: Record<string, FormPersonal>;
  appSettings: Record<string, string>;
}

function loadInitialState(): PersistedState {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      return JSON.parse(raw) as PersistedState;
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

  return {
    speciesPersonal,
    formPersonal,
    appSettings: { ...personalSeed.defaultAppSettings },
  };
}

export function createDummyRepository(): Repository {
  const state = loadInitialState();

  const speciesBySlug = new Map<string, Species>(referenceData.species.map((s) => [s.slug, s]));
  const speciesByDexOrder = [...referenceData.species].sort((a, b) => a.dexNumber - b.dexNumber);
  const formsBySpecies = new Map<string, Form[]>();
  for (const f of referenceData.forms) {
    const list = formsBySpecies.get(f.speciesSlug) ?? [];
    list.push(f);
    formsBySpecies.set(f.speciesSlug, list);
  }

  function persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function matchesSearch(species: Species, search: string): boolean {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return species.name.toLowerCase().includes(q) || String(species.dexNumber).includes(q);
  }

  return {
    listRegions(): Region[] {
      return referenceData.regions;
    },

    listSpeciesByRegion(regionSlug: string): Species[] {
      return referenceData.species
        .filter((s) => s.regionSlug === regionSlug)
        .sort((a, b) => a.dexNumber - b.dexNumber);
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
          return { species, caught: personal.registered, indicators };
        })
        .filter((s) => {
          if (!filter.caught || filter.caught === "all") return true;
          return filter.caught === "caught" ? s.caught : !s.caught;
        });
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
      state.speciesPersonal[speciesSlug] = { ...current, [field]: value };
      persist();
    },

    setFormPersonalField(formSlug, field, value) {
      const current = state.formPersonal[formSlug] ?? emptyFormPersonal(formSlug);
      state.formPersonal[formSlug] = { ...current, [field]: value };
      persist();
    },

    getAppSetting(key) {
      return state.appSettings[key];
    },

    setAppSetting(key, value) {
      state.appSettings[key] = value;
      persist();
    },

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
      state.appSettings[INDICATOR_SETTING_KEY] = JSON.stringify(fields.slice(0, MAX_GRID_INDICATORS));
      persist();
    },
  };
}
