import { navigate, speciesDetailPath } from "../../app-shell/router";
import type { CompletionLens, CompletionLensResult, CompletionMissingSpecies, CompletionScope, Repository } from "../../data/repository";
import { clear, el, labeledToggle } from "../../ui/dom";
import { speciesSpritePath } from "../../ui/sprites";
import { ACHIEVEMENT_LENSES, PRIMARY_LENSES, lensKey, lensLabel, parseLensKey } from "./lens-labels";

const STATS_LENS_SETTING_KEY = "stats_lenses";
// Per the user: default to the two stats they specifically asked for first —
// everything else is available via the checkboxes below.
const DEFAULT_LENS_KEYS = ["registered", "achievement:lucky"];

// A "missing" drill-down can be hundreds of species (e.g. "Shiny" globally) —
// showing every tile would be unusably long/slow. Display-only guard, same
// reasoning as bulk-form-edit's MAX_SPECIES_SHOWN.
const MAX_MISSING_SHOWN = 150;

function loadSelection(repo: Repository): Set<string> {
  const raw = repo.getAppSetting(STATS_LENS_SETTING_KEY);
  if (!raw) return new Set(DEFAULT_LENS_KEYS);
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed) : new Set(DEFAULT_LENS_KEYS);
  } catch {
    return new Set(DEFAULT_LENS_KEYS);
  }
}

interface ScopeRow {
  label: string;
  scope: CompletionScope;
}

export async function renderStatsPage(container: HTMLElement, repo: Repository) {
  clear(container);
  container.append(el("h2", {}, ["Stats"]));

  const lensFieldset = el("fieldset", {});
  const kpiRow = el("div", { class: "stats-kpi-row" });
  const bodyEl = el("div", { class: "stats-body" });
  const detailEl = el("div", { class: "stats-detail" });
  container.append(lensFieldset, kpiRow, bodyEl, detailEl);

  const selected = loadSelection(repo);

  function lensToggle(lens: CompletionLens): HTMLElement {
    const key = lensKey(lens);
    return labeledToggle(lensLabel(lens), selected.has(key), (checked) => {
      if (checked) selected.add(key);
      else selected.delete(key);
      repo.setAppSetting(STATS_LENS_SETTING_KEY, JSON.stringify([...selected]));
      void renderTable();
    });
  }

  function renderLensCheckboxes() {
    clear(lensFieldset);
    lensFieldset.append(el("legend", {}, ["Lenses"]));
    for (const lens of PRIMARY_LENSES) lensFieldset.append(lensToggle(lens));

    const checkedAchievementCount = ACHIEVEMENT_LENSES.filter((lens) => selected.has(lensKey(lens))).length;
    const details = el("details", { class: "stats-more-lenses" }, [el("summary", {}, [`More lenses (${ACHIEVEMENT_LENSES.length}${checkedAchievementCount ? `, ${checkedAchievementCount} checked` : ""})`])]);
    if (checkedAchievementCount > 0) details.setAttribute("open", "true");
    for (const lens of ACHIEVEMENT_LENSES) details.append(lensToggle(lens));
    lensFieldset.append(details);
  }

  // Missing-species drill-down: a tappable sprite grid (not a comma-joined
  // text blob) that jumps straight to the species' own detail page — the
  // "cool stats you can easily drill into" the owner asked for.
  function showMissing(rowLabel: string, lens: CompletionLens, missingSpecies: CompletionMissingSpecies[]) {
    clear(detailEl);
    detailEl.append(el("h3", {}, [`${rowLabel} — ${lensLabel(lens)}`]));
    detailEl.scrollIntoView({ block: "nearest", behavior: "smooth" });

    if (missingSpecies.length === 0) {
      detailEl.append(el("p", { class: "stats-missing-note" }, ["Nothing missing — fully complete."]));
      return;
    }

    const sorted = [...missingSpecies].sort((a, b) => a.dexNumber - b.dexNumber);
    detailEl.append(
      el("p", { class: "stats-missing-note" }, [`Missing ${sorted.length} — tap one to jump to its page.`]),
    );

    const shown = sorted.slice(0, MAX_MISSING_SHOWN);
    const grid = el("div", { class: "stats-missing-grid" });
    for (const species of shown) {
      const tile = el("button", { type: "button", class: "stats-missing-tile" }, [
        el("img", {
          class: "stats-missing-sprite",
          src: speciesSpritePath(species.dexNumber),
          alt: species.name,
          loading: "lazy",
        }),
        el("div", { class: "tile-label" }, [el("span", { class: "dex-num" }, [`#${species.dexNumber}`]), ` ${species.name}`]),
      ]);
      tile.addEventListener("click", () => navigate(speciesDetailPath(species.slug)));
      grid.append(tile);
    }
    detailEl.append(grid);

    if (sorted.length > shown.length) {
      detailEl.append(
        el("p", { class: "stats-truncation-note" }, [`Showing the first ${shown.length} of ${sorted.length} — narrow to a single region for the rest.`]),
      );
    }
  }

  function completionPct(result: CompletionLensResult): number {
    return result.total === 0 ? 100 : Math.round((result.complete / result.total) * 100);
  }

  function renderCell(rowLabel: string, result: CompletionLensResult): HTMLElement {
    const pct = completionPct(result);
    const cell = el("button", { type: "button", class: "stats-cell" }, [
      el("div", { class: "stats-cell-bar" }, [el("div", { class: "stats-cell-fill", style: `width: ${pct}%` })]),
      el("div", { class: "stats-cell-text" }, [`${result.complete}/${result.total} (${pct}%)`]),
    ]);
    cell.addEventListener("click", () => showMissing(rowLabel, result.lens, result.missingSpecies));
    return cell;
  }

  // Headline KPI cards for the global ("All regions") scope — the
  // at-a-glance dashboard summary above the region-by-region breakdown.
  function renderKpiCard(result: CompletionLensResult): HTMLElement {
    const pct = completionPct(result);
    const card = el("button", { type: "button", class: "stats-kpi-card" }, [
      el("div", { class: "stats-kpi-label" }, [lensLabel(result.lens)]),
      el("div", { class: "stats-kpi-value" }, [`${pct}%`]),
      el("div", { class: "stats-cell-bar" }, [el("div", { class: "stats-cell-fill", style: `width: ${pct}%` })]),
      el("div", { class: "stats-kpi-fraction" }, [`${result.complete} / ${result.total}`]),
    ]);
    card.addEventListener("click", () => showMissing("All regions", result.lens, result.missingSpecies));
    return card;
  }

  async function renderTable() {
    const lenses = [...selected].map(parseLensKey).filter((l): l is CompletionLens => l !== null);
    clear(detailEl);
    clear(kpiRow);

    if (lenses.length === 0) {
      clear(bodyEl);
      bodyEl.append(el("p", { class: "empty-state" }, ["Check a lens above to see completion stats."]));
      return;
    }

    clear(bodyEl);
    bodyEl.append(el("p", { class: "stub-message" }, ["Computing…"]));

    const regions = repo.listRegions();
    const scopeRows: ScopeRow[] = [{ label: "All regions", scope: { kind: "global" } }, ...regions.map((r) => ({ label: r.name, scope: { kind: "region", regionSlug: r.slug } as CompletionScope }))];

    const rows = await Promise.all(
      scopeRows.map(async (row) => ({
        label: row.label,
        results: await repo.getCompletionStats(row.scope, lenses),
      })),
    );

    clear(bodyEl);
    clear(kpiRow);

    for (const result of rows[0].results) {
      kpiRow.append(renderKpiCard(result));
    }

    const table = el("table", { class: "stats-table" });
    const headerRow = el("tr", {}, [el("th", {}, ["Region"]), ...lenses.map((lens) => el("th", {}, [lensLabel(lens)]))]);
    table.append(el("thead", {}, [headerRow]));

    const tbody = el("tbody", {});
    for (const row of rows) {
      tbody.append(el("tr", {}, [el("td", { class: "stats-row-label" }, [row.label]), ...row.results.map((result) => el("td", {}, [renderCell(row.label, result)]))]));
    }
    table.append(tbody);

    bodyEl.append(el("div", { class: "stats-table-wrap" }, [table]));
  }

  renderLensCheckboxes();
  await renderTable();
}
