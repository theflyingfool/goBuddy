import type { Repository, SpeciesFilter } from "../../data/repository";
import { clear, el } from "../../ui/dom";
import { speciesSpritePath } from "../../ui/sprites";
import { INDICATOR_LABELS } from "./indicator-labels";

export interface GridState {
  filterText: string;
  caughtFilter: NonNullable<SpeciesFilter["caught"]>;
  collapsedRegions: Set<string>;
}

export interface GridCallbacks {
  onSelectSpecies: (speciesSlug: string) => void;
  onCaughtFilterChange: (value: GridState["caughtFilter"]) => void;
  onToggleRegion: (regionSlug: string) => void;
}

const CAUGHT_FILTER_OPTIONS: { value: GridState["caughtFilter"]; label: string }[] = [
  { value: "all", label: "All" },
  { value: "caught", label: "Caught" },
  { value: "uncaught", label: "Uncaught" },
];

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
  container.append(filterBar);

  let anyResults = false;

  for (const region of repo.listRegions()) {
    const summaries = repo.listSpeciesSummaries({
      region: region.slug,
      search: state.filterText,
      caught: state.caughtFilter,
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
