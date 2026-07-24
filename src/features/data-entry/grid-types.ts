// Shared Dex-grid types + the filter-sheet renderer, relocated verbatim out
// of the now-deleted species-grid.ts (Task 7, see docs/vue-migration-plan.md).
// main.ts still needs GridState/GridCallbacks/countActiveFilters and
// renderFilterSheetContent for the vanilla filter-sheet overlay, which stays
// vanilla per the migration plan's Global Constraints — everything else that
// used to live in species-grid.ts (the select-mode/bulk-apply grid render
// itself) is now DexGridPage.vue.
import type { GridFilterField, Repository, SpeciesFilter } from "../../data/repository";
import { clear, el } from "../../ui/dom";
import { SPECIES_FIELDS } from "./field-groups";
import { CLASSIFICATION_FIELDS, MORE_FILTER_FIELDS, gridFilterFieldLabel, renderFilterLegend } from "./indicator-labels";

export type FieldFilterState = "include" | "exclude";

// The species-level personal booleans bulk-editable from grid select-mode —
// exactly SPECIES_FIELDS (registered/xxl/xxs/purified), the same set the
// single-species detail page toggles.
export type SpeciesBulkField = (typeof SPECIES_FIELDS)[number]["field"];

export interface GridState {
  filterText: string;
  caughtFilter: NonNullable<SpeciesFilter["caught"]>;
  collapsedRegions: Set<string>;
  /** Tri-state quick filters beyond All/Caught/Uncaught, keyed by field. */
  fieldFilters: Partial<Record<GridFilterField, FieldFilterState>>;
  /** Whether the "More filters" section (every field beyond the user's 4 chosen indicators) is expanded. */
  moreFiltersOpen: boolean;
  /** Select mode: tapping a tile toggles selection (for a bulk edit) instead of navigating. */
  selectMode: boolean;
  /** Slugs of species currently selected while in select mode. */
  selectedSpecies: Set<string>;
  /** Which species-level boolean the bulk-action bar will set. */
  bulkField: SpeciesBulkField;
  /** Whether the bulk action turns the field on (true) or off (false). */
  bulkValue: boolean;
  /**
   * Bulk Edit merged into the Dex grid's select-mode rather than staying a
   * separate page (owner call — see docs/vue-migration-plan.md): "species"
   * bulk-edits the species-level fields below via this grid's own tiles;
   * "form" hands the whole content area to BulkFormEditPanel.vue's per-form
   * tile/filter/apply logic instead, since form-level bulk edit needs a
   * different tile granularity (gender-collapsed forms, not species).
   */
  bulkGranularity: "species" | "form";
}

export interface GridCallbacks {
  onSelectSpecies: (speciesSlug: string) => void;
  onCaughtFilterChange: (value: GridState["caughtFilter"]) => void;
  onToggleRegion: (regionSlug: string) => void;
  /** Cycles a field's filter state: off → include → exclude → off. */
  onCycleFieldFilter: (field: GridFilterField) => void;
  onToggleMoreFilters: () => void;
  onToggleSelectMode: () => void;
  onGranularityChange: (granularity: GridState["bulkGranularity"]) => void;
  onBulkFieldChange: (field: SpeciesBulkField) => void;
  onBulkValueChange: (value: boolean) => void;
  /** Apply the chosen field/value to every selected species (bulkSetSpeciesPersonalField), then clear + refresh. */
  onApplyBulk: () => void;
  onClearSelection: () => void;
}

const CAUGHT_FILTER_OPTIONS: { value: GridState["caughtFilter"]; label: string }[] = [
  { value: "all", label: "All" },
  { value: "caught", label: "Caught" },
  { value: "uncaught", label: "Uncaught" },
];

function fieldFilterChip(field: GridFilterField, state: GridState, callbacks: GridCallbacks): HTMLElement {
  const current = state.fieldFilters[field];
  const label = gridFilterFieldLabel(field);
  const stateClass = current === "include" ? " filter-chip-include" : current === "exclude" ? " filter-chip-exclude" : "";
  const suffix = current === "include" ? " ✓" : current === "exclude" ? " ✕" : "";
  const stateWord = current === "include" ? "included" : current === "exclude" ? "excluded" : "off";
  const chip = el(
    "button",
    {
      type: "button",
      class: `filter-chip${stateClass}`,
      title: label.full,
      "aria-pressed": current ? "true" : "false",
      "aria-label": `${label.full}: ${stateWord}`,
    },
    [`${label.badge}${suffix}`],
  );
  chip.addEventListener("click", () => callbacks.onCycleFieldFilter(field));
  return chip;
}

// How many filters are "active" right now — drives the filter-icon button's
// badge count in the header so collapsing the filter rows into a sheet
// doesn't hide *that* a filter is applied.
export function countActiveFilters(state: GridState): number {
  return (state.caughtFilter !== "all" ? 1 : 0) + Object.keys(state.fieldFilters).length;
}

// Filter content used to live inline at the top of the grid; it's now the
// contents of the callable filter sheet/panel (rendered into a container
// that lives outside the grid's own `clear()` cycle, so opening/closing it
// doesn't fight the grid's rerenders). Select-mode + the bulk bar stay on
// the grid page itself — they're a selection tool, not a filter.
export function renderFilterSheetContent(container: HTMLElement, repo: Repository, state: GridState, callbacks: GridCallbacks) {
  clear(container);
  const indicatorSelection = repo.getIndicatorSelection();

  container.append(el("h2", { class: "filter-sheet-title" }, ["Filters"]));
  container.append(renderFilterLegend([...indicatorSelection, ...CLASSIFICATION_FIELDS, ...MORE_FILTER_FIELDS]));

  const filterBar = el("div", { class: "filter-bar" });
  for (const option of CAUGHT_FILTER_OPTIONS) {
    const button = el(
      "button",
      { type: "button", class: `filter-chip${state.caughtFilter === option.value ? " filter-chip-active" : ""}`, "aria-pressed": String(state.caughtFilter === option.value) },
      [option.label],
    );
    button.addEventListener("click", () => callbacks.onCaughtFilterChange(option.value));
    filterBar.append(button);
  }
  for (const field of indicatorSelection) {
    filterBar.append(fieldFilterChip(field, state, callbacks));
  }
  container.append(filterBar);

  // Species classification (rarity + Mega/Dynamax/Gigantamax-capable) — its
  // own row, not folded into the achievement chips above or the collapsed
  // "More filters" below. Small, fixed-size set (6 fields), and expected to
  // combine directly with Caught/Uncaught.
  const classificationBar = el("div", { class: "filter-bar" });
  for (const field of CLASSIFICATION_FIELDS) {
    classificationBar.append(fieldFilterChip(field, state, callbacks));
  }
  container.append(classificationBar);

  const indicatorSelectionSet = new Set<string>(indicatorSelection);
  const moreFields = MORE_FILTER_FIELDS.filter((f) => !indicatorSelectionSet.has(f));
  const moreToggle = el("button", { type: "button", class: "more-filters-toggle" }, [
    `${state.moreFiltersOpen ? "▾" : "▸"} More filters (${moreFields.length})`,
  ]);
  moreToggle.addEventListener("click", () => callbacks.onToggleMoreFilters());
  container.append(moreToggle);

  if (state.moreFiltersOpen) {
    const moreBar = el("div", { class: "filter-bar" });
    for (const field of moreFields) {
      moreBar.append(fieldFilterChip(field, state, callbacks));
    }
    container.append(moreBar);
  }
}
