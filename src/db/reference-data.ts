// The shape of the bundled src/data/reference.json asset — every reference
// table as a flat array, keyed by slug per CLAUDE.md's schema design.
// Personal tables are never part of this file.

import type { Background, Form, FormType, MegaVariant, PokemonType, Region, Species } from "./types";

export interface ReferenceData {
  regions: Region[];
  types: PokemonType[];
  backgrounds: Background[];
  species: Species[];
  forms: Form[];
  formTypes: FormType[];
  megaVariants: MegaVariant[];
}

// Side file (reference-gaps.json) the Coverage Report reads — things worth
// a human double-checking, not hard ingestion failures.
export interface ReferenceGap {
  kind: "mega-discrepancy" | "unverified-gender" | "missing-types" | "inherited-availability" | "possible-bogus-form" | "guessed-costume-name";
  speciesSlug: string;
  formSlug?: string;
  note: string;
}
