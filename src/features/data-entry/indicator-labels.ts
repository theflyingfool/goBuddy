import { FORM_PERSONAL_BOOLEAN_FIELDS, type FormPersonalBooleanField } from "../../db/types";
import type { AvailabilityFilterField, GridFilterField, MegaAchievementFilterField, RarityFilterField, Repository, SpeciesBooleanField } from "../../data/repository";
import { el } from "../../ui/dom";

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

// Personal achievement (have I actually mega evolved this), not reference
// availability (can it ever be) — that's AVAILABILITY_FILTER_LABELS'
// megaCapable below. Grouped with the other personal achievement fields in
// MORE_FILTER_FIELDS, not with rarity/availability in CLASSIFICATION_FIELDS.
export const MEGA_ACHIEVEMENT_FILTER_LABELS: Record<MegaAchievementFilterField, { badge: string; full: string }> = {
  megaEvolved: { badge: "Mega✓", full: "Mega evolved" },
};

export const RARITY_FILTER_OPTIONS: RarityFilterField[] = ["legendary", "mythical", "ultraBeast"];
export const SPECIES_FILTER_OPTIONS: SpeciesBooleanField[] = ["xxl", "xxs", "purified"];
export const AVAILABILITY_FILTER_OPTIONS: AvailabilityFilterField[] = ["megaCapable", "dynamaxCapable", "gigantamaxCapable"];
export const MEGA_ACHIEVEMENT_FILTER_OPTIONS: MegaAchievementFilterField[] = ["megaEvolved"];

// Species classification — reference data (rarity + what a species/form can
// ever be), always visible on the grid rather than tucked into "More
// filters": per the user, this is a primary-ish dimension they expect to
// combine directly with Caught/Uncaught, not buried alongside personal
// achievement toggles like Shiny/Lucky/Shundo.
export const CLASSIFICATION_FIELDS: GridFilterField[] = [...RARITY_FILTER_OPTIONS, ...AVAILABILITY_FILTER_OPTIONS];

/** Fields shown in the grid's collapsed "More filters" section: every achievement field plus XXL/XXS/Purified/Mega evolved. Rarity/availability live in CLASSIFICATION_FIELDS instead. */
export const MORE_FILTER_FIELDS: GridFilterField[] = [...INDICATOR_OPTIONS, ...SPECIES_FILTER_OPTIONS, ...MEGA_ACHIEVEMENT_FILTER_OPTIONS];

// A tap-reachable legend for the chip glyphs — hover-only `title` tooltips
// (still there, for mouse users) were the only disambiguation on touch,
// which is no disambiguation at all. Covers every field passed in
// (de-duplicated), not just whatever's currently visible, so looking up a
// glyph doesn't first require expanding "More filters." Reuses the Help
// page's .help-row/.help-badge styling rather than inventing new CSS.
export function renderFilterLegend(fields: GridFilterField[]): HTMLElement {
  const details = el("details", { class: "settings-details filter-legend" }, [el("summary", {}, ["Legend"])]);
  const seen = new Set<string>();
  for (const field of fields) {
    if (seen.has(field)) continue;
    seen.add(field);
    const { badge, full } = gridFilterFieldLabel(field);
    details.append(
      el("div", { class: "help-row" }, [el("span", { class: "help-badge" }, [badge]), el("span", { class: "help-row-body" }, [full])]),
    );
  }
  return details;
}

export function gridFilterFieldLabel(field: GridFilterField): { badge: string; full: string } {
  if (field in RARITY_FILTER_LABELS) return RARITY_FILTER_LABELS[field as RarityFilterField];
  if (field in SPECIES_FILTER_LABELS) return SPECIES_FILTER_LABELS[field as SpeciesBooleanField];
  if (field in AVAILABILITY_FILTER_LABELS) return AVAILABILITY_FILTER_LABELS[field as AvailabilityFilterField];
  if (field in MEGA_ACHIEVEMENT_FILTER_LABELS) return MEGA_ACHIEVEMENT_FILTER_LABELS[field as MegaAchievementFilterField];
  return INDICATOR_LABELS[field as FormPersonalBooleanField];
}

// The species-detail form grid's second quick-toggle icon (Caught is always
// shown, unconditionally). Deliberately a small curated set rather than every
// achievement field — the owner specifically didn't want an open-ended
// picker here, just "pick the one thing you're actively chasing."
export const FORM_GRID_SECOND_FIELD_OPTIONS: FormPersonalBooleanField[] = ["shiny", "lucky", "shadow"];
const FORM_GRID_SECOND_FIELD_SETTING_KEY = "form_grid_second_field";
const DEFAULT_FORM_GRID_SECOND_FIELD: FormPersonalBooleanField = "shiny";

export function getFormGridSecondField(repo: Repository): FormPersonalBooleanField {
  const raw = repo.getAppSetting(FORM_GRID_SECOND_FIELD_SETTING_KEY);
  return FORM_GRID_SECOND_FIELD_OPTIONS.includes(raw as FormPersonalBooleanField) ? (raw as FormPersonalBooleanField) : DEFAULT_FORM_GRID_SECOND_FIELD;
}

export function setFormGridSecondField(repo: Repository, field: FormPersonalBooleanField): void {
  repo.setAppSetting(FORM_GRID_SECOND_FIELD_SETTING_KEY, field);
}
