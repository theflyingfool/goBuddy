import { MAX_GRID_INDICATORS, type Repository } from "../../data/repository";
import { CURRENT_PERSONAL_SCHEMA_VERSION } from "../../db/schema";
import { type ThemePreference, getThemePreference, setThemePreference } from "../../app-shell/theme";
import { clear, el, labeledToggle } from "../../ui/dom";
import { INDICATOR_LABELS, INDICATOR_OPTIONS } from "../data-entry/indicator-labels";
import { exportPersonalData, readPersonalDataFile } from "./personal-data-transfer";

const COLLAPSE_SETTING_KEY = "collapse_gender_forms";

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

export function renderSettingsPage(container: HTMLElement, repo: Repository) {
  clear(container);

  const heading = el("h2", {}, ["Settings"]);

  const appearanceFieldset = el("fieldset", {}, [el("legend", {}, ["Appearance"])]);
  const themeOptions = el("div", { class: "theme-options" });
  function renderThemeOptions() {
    clear(themeOptions);
    const current = getThemePreference(repo);
    for (const option of THEME_OPTIONS) {
      const button = el(
        "button",
        { type: "button", class: `filter-chip${current === option.value ? " filter-chip-active" : ""}` },
        [option.label],
      );
      button.addEventListener("click", () => {
        setThemePreference(repo, option.value);
        renderThemeOptions();
      });
      themeOptions.append(button);
    }
  }
  renderThemeOptions();
  appearanceFieldset.append(themeOptions);

  const collapseFieldset = el("fieldset", {}, [el("legend", {}, ["Display"])]);
  collapseFieldset.append(
    labeledToggle("Collapse gender-split forms", repo.getAppSetting(COLLAPSE_SETTING_KEY) === "1", (checked) => {
      repo.setAppSetting(COLLAPSE_SETTING_KEY, checked ? "1" : "0");
    }),
  );

  const indicatorFieldset = el("fieldset", {}, [
    el("legend", {}, [`Grid badges (pick up to ${MAX_GRID_INDICATORS})`]),
  ]);

  function renderIndicatorCheckboxes() {
    const existing = indicatorFieldset.querySelectorAll(".toggle-row");
    existing.forEach((node) => node.remove());

    const selected = repo.getIndicatorSelection();
    for (const field of INDICATOR_OPTIONS) {
      const isChecked = selected.includes(field);
      const atCap = selected.length >= MAX_GRID_INDICATORS;
      const row = labeledToggle(INDICATOR_LABELS[field].full, isChecked, (checked) => {
        const current = repo.getIndicatorSelection();
        const updated = checked ? [...current, field] : current.filter((f) => f !== field);
        repo.setIndicatorSelection(updated);
        renderIndicatorCheckboxes();
      });
      if (!isChecked && atCap) {
        (row.querySelector("input") as HTMLInputElement).disabled = true;
        row.classList.add("toggle-row-disabled");
      }
      indicatorFieldset.append(row);
    }
  }

  renderIndicatorCheckboxes();

  const dataFieldset = el("fieldset", {}, [el("legend", {}, ["Data"])]);
  const statusEl = el("p", { class: "gap-note" }, []);

  const exportButton = el("button", { type: "button" }, ["Export personal data"]);
  exportButton.addEventListener("click", async () => {
    statusEl.textContent = "Exporting…";
    try {
      const result = await exportPersonalData(repo);
      statusEl.textContent = result === "saved" ? "Exported." : "Cancelled.";
    } catch (err) {
      statusEl.textContent = `Export failed: ${(err as Error).message}`;
    }
  });

  const importInput = el("input", { type: "file", accept: "application/json" }) as HTMLInputElement;
  importInput.addEventListener("change", async () => {
    const file = importInput.files?.[0];
    importInput.value = "";
    if (!file) return;
    try {
      const { data, schemaMismatch } = await readPersonalDataFile(file);
      if (schemaMismatch) {
        const proceed = window.confirm(
          `This export is from schema version ${data.schemaVersion}, but this app is on version ${CURRENT_PERSONAL_SCHEMA_VERSION}. Some fields may not match. Import anyway?`,
        );
        if (!proceed) return;
      }
      const proceed = window.confirm(
        `Import "${file.name}" (exported ${new Date(data.exportedAt).toLocaleString()})? This overwrites any matching entries — anything not in the file stays as-is.`,
      );
      if (!proceed) return;

      // Safety-net snapshot of what's about to be overwritten, in case the
      // import turns out to be the wrong file or otherwise goes sideways —
      // see docs/v1-tasks/02-data-safety-net.md. Uses the same export flow
      // as the button above, so it's the user's real save dialog/share
      // sheet, not a silent background write.
      statusEl.textContent = "Saving a safety backup of your current data first…";
      const snapshotResult = await exportPersonalData(repo);
      if (snapshotResult === "cancelled") {
        const proceedWithoutBackup = window.confirm("Backup cancelled. Import anyway without a fresh backup?");
        if (!proceedWithoutBackup) {
          statusEl.textContent = "Cancelled.";
          return;
        }
      }

      statusEl.textContent = "Importing…";
      const { skippedSpeciesSlugs, skippedFormSlugs } = await repo.importPersonalData(data);
      const skipped = skippedSpeciesSlugs + skippedFormSlugs;
      if (skipped > 0) {
        statusEl.textContent = `Imported, but skipped ${skipped} row(s) with slugs this app's reference data doesn't recognize (likely from a different app version). Reloading…`;
        setTimeout(() => window.location.reload(), 3000);
      } else {
        statusEl.textContent = "Imported. Reloading…";
        window.location.reload();
      }
    } catch (err) {
      statusEl.textContent = `Import failed: ${(err as Error).message}`;
    }
  });
  const importLabel = el("label", { class: "toggle-row" }, ["Import personal data", importInput]);

  dataFieldset.append(exportButton, importLabel, statusEl);

  container.append(heading, appearanceFieldset, collapseFieldset, indicatorFieldset, dataFieldset);
}
