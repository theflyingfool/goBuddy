import { renderBootFailureRescue } from "./app-shell/boot-failure-rescue";
import { renderHeader } from "./app-shell/header";
import { renderNavDrawer } from "./app-shell/nav-drawer";
import { parseRoute, speciesDetailPath } from "./app-shell/router";
import { mountWriteFailureBanner, reportWriteFailure } from "./app-shell/write-failure-banner";
import { createSqliteRepository } from "./data/sqlite-repository";
import type { Repository } from "./data/repository";
import { renderSpeciesDetail } from "./features/data-entry/species-detail";
import { renderSpeciesGrid, type GridState } from "./features/data-entry/species-grid";
import { renderBulkFormEditPage } from "./features/data-entry/bulk-form-edit";
import { renderCoverageReportPage } from "./features/coverage-report/coverage-report-page";
import { renderSettingsPage } from "./features/settings/settings-page";
import { renderStatsPage } from "./features/stats/stats-page";
import { renderAchievementsPage, renderSearchToolsPage, renderXpAssistantPage } from "./features/stubs";
import { el } from "./ui/dom";

const app = document.getElementById("app")!;
const loadingEl = el("p", { class: "app-loading" }, ["Loading your dex…"]);
app.append(loadingEl);
mountWriteFailureBanner(app);

createSqliteRepository(reportWriteFailure)
  .then((repo) => {
    loadingEl.remove();
    bootstrap(repo);
  })
  .catch((err) => {
    console.error("Failed to open the on-device database:", err);
    loadingEl.remove();
    renderBootFailureRescue(app, err);
  });

function bootstrap(repo: Repository) {
  const headerEl = el("header", { class: "app-header" });
  const drawerEl = el("nav", { class: "nav-drawer" });
  const scrimEl = el("div", { class: "nav-scrim" });
  const contentEl = el("main", { class: "app-content" });
  app.append(headerEl, drawerEl, scrimEl, contentEl);

  const gridState: GridState = {
    filterText: "",
    caughtFilter: "all",
    collapsedRegions: new Set(),
    fieldFilters: {},
    moreFiltersOpen: false,
    selectMode: false,
    selectedSpecies: new Set(),
    bulkField: "registered",
    bulkValue: true,
  };
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
          onCycleFieldFilter: (field) => {
            const current = gridState.fieldFilters[field];
            if (current === undefined) gridState.fieldFilters[field] = "include";
            else if (current === "include") gridState.fieldFilters[field] = "exclude";
            else delete gridState.fieldFilters[field];
            renderGrid();
          },
          onToggleMoreFilters: () => {
            gridState.moreFiltersOpen = !gridState.moreFiltersOpen;
            renderGrid();
          },
          onToggleSelectMode: () => {
            gridState.selectMode = !gridState.selectMode;
            if (!gridState.selectMode) gridState.selectedSpecies.clear();
            renderGrid();
          },
          onToggleSpeciesSelection: (slug) => {
            if (gridState.selectedSpecies.has(slug)) gridState.selectedSpecies.delete(slug);
            else gridState.selectedSpecies.add(slug);
            renderGrid();
          },
          onBulkFieldChange: (field) => {
            gridState.bulkField = field;
            renderGrid();
          },
          onBulkValueChange: (value) => {
            gridState.bulkValue = value;
            renderGrid();
          },
          onApplyBulk: () => {
            const slugs = [...gridState.selectedSpecies];
            if (slugs.length === 0) return;
            void repo.bulkSetSpeciesPersonalField(slugs, gridState.bulkField, gridState.bulkValue).then(() => {
              gridState.selectedSpecies.clear();
              renderGrid();
            });
          },
          onClearSelection: () => {
            gridState.selectedSpecies.clear();
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
      renderHeader(
        headerEl,
        {
          kind: "jump",
          repo,
          onSelect: (slug) => {
            location.hash = speciesDetailPath(slug);
          },
        },
        () => setDrawerOpen(!drawerOpen),
      );
      renderSpeciesDetail(contentEl, repo, route.speciesSlug, () => {
        location.hash = "/data-entry";
      });
    } else {
      renderHeader(headerEl, { kind: "none" }, () => setDrawerOpen(!drawerOpen));
      switch (route.name) {
        case "bulk-form-edit":
          renderBulkFormEditPage(contentEl, repo);
          break;
        case "stats":
          renderStatsPage(contentEl, repo);
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
}
