import { FORM_PERSONAL_BOOLEAN_FIELDS, type FormPersonalBooleanField } from "../../db/types";
import type { AvailabilityFilterField, GridFilterField, RarityFilterField, SpeciesBooleanField } from "../../data/repository";

export const INDICATOR_LABELS: Record<FormPersonalBooleanField, { badge: string; full: string }> = {
  caught: { badge: "●", full: "Caught" },
  shiny: { badge: "✨", full: "Shiny" },
  floor: { badge: "0", full: "Floor IV" },
  fourStar: { badge: "★", full: "4★" },
  shundo: { badge: "💎", full: "Shundo" },
  lucky: { badge: "🍀", full: "Lucky" },
  luckyShiny: { badge: "🍀✨", full: "Lucky shiny" },
  luckyFloor: { badge: "🍀0", full: "Lucky floor IV" },
  luckyFourStar: { badge: "🍀★", full: "Lucky 4★" },
  luckyShundo: { badge: "🍀💎", full: "Lucky shundo" },
  shadow: { badge: "☾", full: "Shadow" },
  shadowShiny: { badge: "☾✨", full: "Shadow shiny" },
  shadowFloor: { badge: "☾0", full: "Shadow floor IV" },
  shadowFourStar: { badge: "☾★", full: "Shadow 4★" },
  shadowShundo: { badge: "☾💎", full: "Shadow shundo" },
  // "Dynamaxed" (achieved), not "Dynamax" — sits right next to the new
  // reference-availability "Can Dynamax" filter on the grid, and the two are
  // easy to conflate (that conflation is exactly what made "Uncaught +
  // Dynamax" return nothing before this fix).
  dynamax: { badge: "D", full: "Dynamaxed" },
  dynamaxFloor: { badge: "D0", full: "Dynamax floor IV" },
  dynamaxShiny: { badge: "D✨", full: "Dynamax shiny" },
  dynamaxFourStar: { badge: "D★", full: "Dynamax 4★" },
  dynamaxShundo: { badge: "D💎", full: "Dynamax shundo" },
  luckyDynamax: { badge: "🍀D", full: "Lucky Dynamax" },
  luckyDynamaxFloor: { badge: "🍀D0", full: "Lucky Dynamax floor IV" },
  luckyDynamaxShiny: { badge: "🍀D✨", full: "Lucky Dynamax shiny" },
  luckyDynamaxFourStar: { badge: "🍀D★", full: "Lucky Dynamax 4★" },
  luckyDynamaxShundo: { badge: "🍀D💎", full: "Lucky Dynamax shundo" },
};

// "caught" is communicated via grayscale-until-caught on the grid, not a
// badge, so it's excluded from the pickable indicator set in Settings.
export const INDICATOR_OPTIONS: FormPersonalBooleanField[] = FORM_PERSONAL_BOOLEAN_FIELDS.filter(
  (f) => f !== "caught",
);

// Rarity and species-level fields aren't part of the Settings-configurable
// badge system (they're not per-form achievement toggles), but they're real
// tracked/reference data worth quick-filtering the grid by — surfaced under
// the grid's "More filters" expansion instead.
export const RARITY_FILTER_LABELS: Record<RarityFilterField, { badge: string; full: string }> = {
  legendary: { badge: "L", full: "Legendary" },
  mythical: { badge: "M", full: "Mythical" },
  ultraBeast: { badge: "UB", full: "Ultra Beast" },
};

export const SPECIES_FILTER_LABELS: Record<SpeciesBooleanField, { badge: string; full: string }> = {
  xxl: { badge: "XXL", full: "XXL" },
  xxs: { badge: "XXS", full: "XXS" },
  purified: { badge: "P", full: "Purified" },
};

// Reference-data availability ("can this ever be Mega Evolved/Dynamaxed/
// Gigantamaxed") — grouped with rarity below as "species classification",
// not mixed into the achievement filter list it used to share a "Dynamax"
// label with.
export const AVAILABILITY_FILTER_LABELS: Record<AvailabilityFilterField, { badge: string; full: string }> = {
  megaCapable: { badge: "Mega", full: "Mega-capable" },
  dynamaxCapable: { badge: "D?", full: "Can Dynamax" },
  gigantamaxCapable: { badge: "G?", full: "Can Gigantamax" },
};

export const RARITY_FILTER_OPTIONS: RarityFilterField[] = ["legendary", "mythical", "ultraBeast"];
export const SPECIES_FILTER_OPTIONS: SpeciesBooleanField[] = ["xxl", "xxs", "purified"];
export const AVAILABILITY_FILTER_OPTIONS: AvailabilityFilterField[] = ["megaCapable", "dynamaxCapable", "gigantamaxCapable"];

// Species classification — reference data (rarity + what a species/form can
// ever be), always visible on the grid rather than tucked into "More
// filters": per the user, this is a primary-ish dimension they expect to
// combine directly with Caught/Uncaught, not buried alongside personal
// achievement toggles like Shiny/Lucky/Shundo.
export const CLASSIFICATION_FIELDS: GridFilterField[] = [...RARITY_FILTER_OPTIONS, ...AVAILABILITY_FILTER_OPTIONS];

/** Fields shown in the grid's collapsed "More filters" section: every achievement field plus XXL/XXS/Purified. Rarity/availability live in CLASSIFICATION_FIELDS instead. */
export const MORE_FILTER_FIELDS: GridFilterField[] = [...INDICATOR_OPTIONS, ...SPECIES_FILTER_OPTIONS];

export function gridFilterFieldLabel(field: GridFilterField): { badge: string; full: string } {
  if (field in RARITY_FILTER_LABELS) return RARITY_FILTER_LABELS[field as RarityFilterField];
  if (field in SPECIES_FILTER_LABELS) return SPECIES_FILTER_LABELS[field as SpeciesBooleanField];
  if (field in AVAILABILITY_FILTER_LABELS) return AVAILABILITY_FILTER_LABELS[field as AvailabilityFilterField];
  return INDICATOR_LABELS[field as FormPersonalBooleanField];
}
