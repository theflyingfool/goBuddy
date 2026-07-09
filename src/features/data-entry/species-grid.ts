import type { GridFilterField, Repository, SpeciesFilter } from "../../data/repository";
import { clear, el } from "../../ui/dom";
import { speciesSpritePath } from "../../ui/sprites";
import { SPECIES_FIELDS } from "./field-groups";
import { CLASSIFICATION_FIELDS, INDICATOR_LABELS, MORE_FILTER_FIELDS, gridFilterFieldLabel } from "./indicator-labels";

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
}

export interface GridCallbacks {
  onSelectSpecies: (speciesSlug: string) => void;
  onCaughtFilterChange: (value: GridState["caughtFilter"]) => void;
  onToggleRegion: (regionSlug: string) => void;
  /** Cycles a field's filter state: off → include → exclude → off. */
  onCycleFieldFilter: (field: GridFilterField) => void;
  onToggleMoreFilters: () => void;
  onToggleSelectMode: () => void;
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

function renderBulkBar(state: GridState, callbacks: GridCallbacks): HTMLElement {
  const bar = el("div", { class: "bulk-action-bar" });

  const fieldSelect = el("select", { class: "bulk-field-select", "aria-label": "Field to set" }) as HTMLSelectElement;
  for (const { field, label } of SPECIES_FIELDS) {
    fieldSelect.append(el("option", { value: field }, [label]));
  }
  fieldSelect.value = state.bulkField;
  fieldSelect.addEventListener("change", () => callbacks.onBulkFieldChange(fieldSelect.value as SpeciesBulkField));

  const onOff = el("div", { class: "bulk-onoff" });
  for (const opt of [{ v: true, label: "On" }, { v: false, label: "Off" }] as const) {
    const btn = el(
      "button",
      { type: "button", class: `filter-chip${state.bulkValue === opt.v ? " filter-chip-active" : ""}`, "aria-pressed": String(state.bulkValue === opt.v) },
      [opt.label],
    );
    btn.addEventListener("click", () => callbacks.onBulkValueChange(opt.v));
    onOff.append(btn);
  }

  const applyBtn = el("button", { type: "button", class: "bulk-apply-button" }, [`Apply to ${state.selectedSpecies.size}`]);
  applyBtn.addEventListener("click", () => callbacks.onApplyBulk());

  const clearBtn = el("button", { type: "button", class: "bulk-clear-button" }, ["Clear"]);
  clearBtn.addEventListener("click", () => callbacks.onClearSelection());

  bar.append(
    el("span", { class: "bulk-count" }, [`${state.selectedSpecies.size} selected`]),
    el("span", { class: "bulk-set-label" }, ["Set"]),
    fieldSelect,
    onOff,
    applyBtn,
    clearBtn,
  );
  return bar;
}

export function renderSpeciesGrid(container: HTMLElement, repo: Repository, state: GridState, callbacks: GridCallbacks) {
  clear(container);

  const indicatorSelection = repo.getIndicatorSelection();

  const selectToolbar = el("div", { class: "grid-select-toolbar" });
  const selectToggle = el(
    "button",
    { type: "button", class: `filter-chip${state.selectMode ? " filter-chip-active" : ""}`, "aria-pressed": String(state.selectMode) },
    [state.selectMode ? "✓ Selecting" : "Select"],
  );
  selectToggle.addEventListener("click", () => callbacks.onToggleSelectMode());
  selectToolbar.append(selectToggle);
  if (state.selectMode) {
    selectToolbar.append(el("span", { class: "grid-select-hint" }, ["Tap tiles to select, then choose a field to set."]));
  }
  container.append(selectToolbar);

  // Lives in its own stable slot so toggling one tile's selection only
  // touches this small bar in place, instead of rebuilding the entire
  // (possibly 1000+ tile) grid below it on every tap.
  const bulkBarSlot = el("div", {});
  container.append(bulkBarSlot);
  let bulkBarEl: HTMLElement | null = null;
  function refreshBulkBar() {
    const shouldShow = state.selectMode && state.selectedSpecies.size > 0;
    if (shouldShow) {
      const fresh = renderBulkBar(state, callbacks);
      if (bulkBarEl) bulkBarEl.replaceWith(fresh);
      else bulkBarSlot.append(fresh);
      bulkBarEl = fresh;
    } else if (bulkBarEl) {
      bulkBarEl.remove();
      bulkBarEl = null;
    }
  }
  refreshBulkBar();

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

      const selected = state.selectMode && state.selectedSpecies.has(species.slug);
      const tile = el(
        "button",
        { type: "button", class: `species-tile${caught ? "" : " uncaught"}${selected ? " selected" : ""}` },
        [
          el("div", { class: "badge-row" }, badges),
          state.selectMode ? el("span", { class: `select-check${selected ? " on" : ""}` }, [selected ? "✓" : ""]) : "",
          el("img", {
            class: "species-sprite",
            src: speciesSpritePath(species.dexNumber),
            // The name is already visible as text right below (tile-label) —
            // an alt here would just make screen readers announce it twice.
            alt: "",
            loading: "lazy",
          }),
          el("div", { class: "tile-label" }, [
            el("span", { class: "dex-num" }, [`#${species.dexNumber}`]),
            ` ${species.name}`,
          ]),
        ],
      );
      tile.addEventListener("click", () => {
        if (!state.selectMode) {
          callbacks.onSelectSpecies(species.slug);
          return;
        }
        // In-place instead of a full renderGrid(): mutates the same Set the
        // caller holds (no callback needed to "commit" it), then updates
        // just this tile + the bulk bar, not the whole grid.
        const nowSelected = !state.selectedSpecies.has(species.slug);
        if (nowSelected) state.selectedSpecies.add(species.slug);
        else state.selectedSpecies.delete(species.slug);

        tile.classList.toggle("selected", nowSelected);
        const check = tile.querySelector<HTMLElement>(".select-check");
        if (check) {
          check.classList.toggle("on", nowSelected);
          check.textContent = nowSelected ? "✓" : "";
        }

        refreshBulkBar();
      });
      grid.append(tile);
    }
    container.append(grid);
  }

  if (!anyResults) {
    container.append(el("p", { class: "empty-state" }, ["No Pokémon match that search/filter."]));
  }
}
