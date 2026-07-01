import { FORM_PERSONAL_BOOLEAN_FIELDS, type FormPersonalBooleanField } from "../../db/types";
import type { GridFilterField, RarityFilterField, SpeciesBooleanField } from "../../data/repository";

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
  dynamax: { badge: "D", full: "Dynamax" },
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

export const RARITY_FILTER_OPTIONS: RarityFilterField[] = ["legendary", "mythical", "ultraBeast"];
export const SPECIES_FILTER_OPTIONS: SpeciesBooleanField[] = ["xxl", "xxs", "purified"];

/** Every filterable grid field, in a stable display order: form achievements, then rarity, then species facts. */
export const ALL_GRID_FILTER_FIELDS: GridFilterField[] = [...INDICATOR_OPTIONS, ...RARITY_FILTER_OPTIONS, ...SPECIES_FILTER_OPTIONS];

export function gridFilterFieldLabel(field: GridFilterField): { badge: string; full: string } {
  if (field in RARITY_FILTER_LABELS) return RARITY_FILTER_LABELS[field as RarityFilterField];
  if (field in SPECIES_FILTER_LABELS) return SPECIES_FILTER_LABELS[field as SpeciesBooleanField];
  return INDICATOR_LABELS[field as FormPersonalBooleanField];
}
