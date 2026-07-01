import { MAX_GRID_INDICATORS, type Repository } from "../../data/repository";
import { CURRENT_PERSONAL_SCHEMA_VERSION } from "../../db/schema";
import { clear, el, labeledToggle } from "../../ui/dom";
import { INDICATOR_LABELS, INDICATOR_OPTIONS } from "../data-entry/indicator-labels";
import { exportPersonalData, readPersonalDataFile } from "./personal-data-transfer";

const COLLAPSE_SETTING_KEY = "collapse_gender_forms";

export function renderSettingsPage(container: HTMLElement, repo: Repository) {
  clear(container);

  const heading = el("h2", {}, ["Settings"]);

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
      statusEl.textContent = "Importing…";
      await repo.importPersonalData(data);
      statusEl.textContent = "Imported. Reloading…";
      window.location.reload();
    } catch (err) {
      statusEl.textContent = `Import failed: ${(err as Error).message}`;
    }
  });
  const importLabel = el("label", { class: "toggle-row" }, ["Import personal data", importInput]);

  dataFieldset.append(exportButton, importLabel, statusEl);

  container.append(heading, collapseFieldset, indicatorFieldset, dataFieldset);
}
