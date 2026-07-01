import { renderHeader } from "./app-shell/header";
import { renderNavDrawer } from "./app-shell/nav-drawer";
import { parseRoute, speciesDetailPath } from "./app-shell/router";
import { createDummyRepository } from "./data/dummy-repository";
import { renderSpeciesDetail } from "./features/data-entry/species-detail";
import { renderSpeciesGrid, type GridState } from "./features/data-entry/species-grid";
import { renderCoverageReportPage } from "./features/coverage-report/coverage-report-page";
import { renderSettingsPage } from "./features/settings/settings-page";
import { renderAchievementsPage, renderSearchToolsPage, renderStatsPage, renderXpAssistantPage } from "./features/stubs";
import { el } from "./ui/dom";

const repo = createDummyRepository();

const app = document.getElementById("app")!;
const headerEl = el("header", { class: "app-header" });
const drawerEl = el("nav", { class: "nav-drawer" });
const scrimEl = el("div", { class: "nav-scrim" });
const contentEl = el("main", { class: "app-content" });
app.append(headerEl, drawerEl, scrimEl, contentEl);

const gridState: GridState = { filterText: "", caughtFilter: "all", collapsedRegions: new Set() };
let drawerOpen = false;

function setDrawerOpen(open: boolean) {
  drawerOpen = open;
  drawerEl.classList.toggle("open", drawerOpen);
  scrimEl.classList.toggle("open", drawerOpen);
}

scrimEl.addEventListener("click", () => setDrawerOpen(false));

function render() {
  const route = parseRoute(location.hash);

  renderNavDrawer(drawerEl, route.name, () => setDrawerOpen(false));

  if (route.name === "data-entry-grid") {
    const renderGrid = () =>
      renderSpeciesGrid(contentEl, repo, gridState, {
        onSelectSpecies: (slug) => {
          location.hash = speciesDetailPath(slug);
        },
        onCaughtFilterChange: (value) => {
          gridState.caughtFilter = value;
          renderGrid();
        },
        onToggleRegion: (regionSlug) => {
          if (gridState.collapsedRegions.has(regionSlug)) gridState.collapsedRegions.delete(regionSlug);
          else gridState.collapsedRegions.add(regionSlug);
          renderGrid();
        },
      });

    renderHeader(
      headerEl,
      {
        kind: "filter",
        value: gridState.filterText,
        onChange: (v) => {
          gridState.filterText = v;
          renderGrid();
        },
      },
      () => setDrawerOpen(!drawerOpen),
    );
    renderGrid();
  } else if (route.name === "data-entry-detail") {
    renderHeader(headerEl, { kind: "jump", repo, onSelect: (slug) => {
      location.hash = speciesDetailPath(slug);
    } }, () => setDrawerOpen(!drawerOpen));
    renderSpeciesDetail(contentEl, repo, route.speciesSlug, () => {
      location.hash = "/data-entry";
    });
  } else {
    renderHeader(headerEl, { kind: "none" }, () => setDrawerOpen(!drawerOpen));
    switch (route.name) {
      case "stats":
        renderStatsPage(contentEl);
        break;
      case "search-tools":
        renderSearchToolsPage(contentEl);
        break;
      case "coverage-report":
        renderCoverageReportPage(contentEl);
        break;
      case "settings":
        renderSettingsPage(contentEl, repo);
        break;
      case "achievements":
        renderAchievementsPage(contentEl);
        break;
      case "xp-assistant":
        renderXpAssistantPage(contentEl);
        break;
    }
  }
}

window.addEventListener("hashchange", () => {
  setDrawerOpen(false);
  window.scrollTo(0, 0);
  render();
});
render();
