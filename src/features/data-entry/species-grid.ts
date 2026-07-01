import type { GridFilterField, Repository, SpeciesFilter } from "../../data/repository";
import { clear, el } from "../../ui/dom";
import { speciesSpritePath } from "../../ui/sprites";
import { CLASSIFICATION_FIELDS, INDICATOR_LABELS, MORE_FILTER_FIELDS, gridFilterFieldLabel } from "./indicator-labels";

export type FieldFilterState = "include" | "exclude";

export interface GridState {
  filterText: string;
  caughtFilter: NonNullable<SpeciesFilter["caught"]>;
  collapsedRegions: Set<string>;
  /** Tri-state quick filters beyond All/Caught/Uncaught, keyed by field. */
  fieldFilters: Partial<Record<GridFilterField, FieldFilterState>>;
  /** Whether the "More filters" section (every field beyond the user's 4 chosen indicators) is expanded. */
  moreFiltersOpen: boolean;
}

export interface GridCallbacks {
  onSelectSpecies: (speciesSlug: string) => void;
  onCaughtFilterChange: (value: GridState["caughtFilter"]) => void;
  onToggleRegion: (regionSlug: string) => void;
  /** Cycles a field's filter state: off → include → exclude → off. */
  onCycleFieldFilter: (field: GridFilterField) => void;
  onToggleMoreFilters: () => void;
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
  const chip = el("button", { type: "button", class: `filter-chip${stateClass}`, title: label.full }, [`${label.badge}${suffix}`]);
  chip.addEventListener("click", () => callbacks.onCycleFieldFilter(field));
  return chip;
}

export function renderSpeciesGrid(container: HTMLElement, repo: Repository, state: GridState, callbacks: GridCallbacks) {
  clear(container);

  const indicatorSelection = repo.getIndicatorSelection();

  const filterBar = el("div", { class: "filter-bar" });
  for (const option of CAUGHT_FILTER_OPTIONS) {
    const button = el(
      "button",
      { type: "button", class: `filter-chip${state.caughtFilter === option.value ? " filter-chip-active" : ""}` },
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
  // own always-visible row, not folded into the achievement chips above or
  // the collapsed "More filters" below. Small, fixed-size set (6 fields),
  // and expected to combine directly with Caught/Uncaught.
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

  let anyResults = false;

  for (const region of repo.listRegions()) {
    const summaries = repo.listSpeciesSummaries({
      region: region.slug,
      search: state.filterText,
      caught: state.caughtFilter,
      fieldFilters: state.fieldFilters,
    });
    if (summaries.length === 0) continue;
    anyResults = true;

    const collapsed = state.collapsedRegions.has(region.slug);
    const sectionHeader = el("button", { type: "button", class: "region-header" }, [
      el("span", { class: "region-collapse-caret" }, [collapsed ? "▶" : "▼"]),
      el("span", {}, [`${region.name} (${summaries.length})`]),
    ]);
    sectionHeader.addEventListener("click", () => callbacks.onToggleRegion(region.slug));
    container.append(sectionHeader);

    if (collapsed) continue;

    const grid = el("div", { class: "species-grid" });
    for (const { species, caught, indicators } of summaries) {
      const badges = indicatorSelection
        .filter((field) => indicators[field])
        .map((field) => el("span", { class: "badge", title: INDICATOR_LABELS[field].full }, [INDICATOR_LABELS[field].badge]));

      const tile = el("button", { type: "button", class: `species-tile${caught ? "" : " uncaught"}` }, [
        el("div", { class: "badge-row" }, badges),
        el("img", {
          class: "species-sprite",
          src: speciesSpritePath(species.dexNumber),
          alt: species.name,
          loading: "lazy",
        }),
        el("div", { class: "tile-label" }, [`#${species.dexNumber} ${species.name}`]),
      ]);
      tile.addEventListener("click", () => callbacks.onSelectSpecies(species.slug));
      grid.append(tile);
    }
    container.append(grid);
  }

  if (!anyResults) {
    container.append(el("p", { class: "empty-state" }, ["No Pokémon match that search/filter."]));
  }
}
