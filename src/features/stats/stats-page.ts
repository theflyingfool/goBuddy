import type { CompletionLens, CompletionLensResult, CompletionMissingSpecies, CompletionScope, Repository } from "../../data/repository";
import { clear, el, labeledToggle } from "../../ui/dom";
import { ACHIEVEMENT_LENSES, PRIMARY_LENSES, lensKey, lensLabel, parseLensKey } from "./lens-labels";

const STATS_LENS_SETTING_KEY = "stats_lenses";
// Per the user: default to the two stats they specifically asked for first —
// everything else is available via the checkboxes below.
const DEFAULT_LENS_KEYS = ["registered", "achievement:lucky"];

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
  const bodyEl = el("div", { class: "stats-body", "aria-live": "polite" });
  const detailEl = el("div", { class: "stats-detail" });
  container.append(lensFieldset, bodyEl, detailEl);

  const selected = loadSelection(repo);

  function lensToggle(lens: CompletionLens): HTMLElement {
    const key = lensKey(lens);
    return labeledToggle(lensLabel(lens), selected.has(key), (checked) => {
      if (checked) selected.add(key);
      else selected.delete(key);
      repo.setAppSetting(STATS_LENS_SETTING_KEY, JSON.stringify([...selected]));
      renderTable();
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

  function showMissing(rowLabel: string, lens: CompletionLens, missingSpecies: CompletionMissingSpecies[]) {
    clear(detailEl);
    if (missingSpecies.length === 0) {
      detailEl.append(el("p", {}, [`${rowLabel} — ${lensLabel(lens)}: nothing missing.`]));
      return;
    }
    const sorted = [...missingSpecies].sort((a, b) => a.dexNumber - b.dexNumber);
    detailEl.append(
      el("p", {}, [`${rowLabel} — ${lensLabel(lens)}: missing ${sorted.length}`]),
      el(
        "p",
        { class: "stats-missing-list" },
        [sorted.map((s) => `#${s.dexNumber} ${s.name}`).join(", ")],
      ),
    );
  }

  function renderCell(rowLabel: string, result: CompletionLensResult): HTMLElement {
    const pct = result.total === 0 ? 100 : Math.round((result.complete / result.total) * 100);
    const cell = el("button", { type: "button", class: "stats-cell" }, [
      el("div", { class: "stats-cell-bar" }, [el("div", { class: "stats-cell-fill", style: `width: ${pct}%` })]),
      el("div", { class: "stats-cell-text" }, [`${result.complete}/${result.total} (${pct}%)`]),
    ]);
    cell.addEventListener("click", () => showMissing(rowLabel, result.lens, result.missingSpecies));
    return cell;
  }

  async function renderTable() {
    const lenses = [...selected].map(parseLensKey).filter((l): l is CompletionLens => l !== null);
    clear(detailEl);

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
