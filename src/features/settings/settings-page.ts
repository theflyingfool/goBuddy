import { EXCLUDE_REGIONAL_SETTING_KEY, MAX_GRID_INDICATORS, type Repository } from "../../data/repository";
import { CURRENT_PERSONAL_SCHEMA_VERSION } from "../../db/schema";
import { type ThemePreference, getThemePreference, setThemePreference } from "../../app-shell/theme";
import { clear, el, labeledToggle } from "../../ui/dom";
import { FORM_GRID_SECOND_FIELD_OPTIONS, INDICATOR_LABELS, INDICATOR_OPTIONS, getFormGridSecondField, setFormGridSecondField } from "../data-entry/indicator-labels";
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

  // Off by default (today's behavior): some players can actually reach
  // region-locked forms (an alt account, travel, trading) so Form-complete
  // requiring them is fair; others genuinely never can, which makes the
  // stat permanently unattainable for ~50 species. Per-install choice, not
  // a fixed app-wide answer (D2, docs/v1-tasks/04-mega-and-gigantamax.md).
  const statsFieldset = el("fieldset", {}, [el("legend", {}, ["Stats"])]);
  statsFieldset.append(
    labeledToggle("Exclude regional-exclusive forms from Form-complete", repo.getAppSetting(EXCLUDE_REGIONAL_SETTING_KEY) === "1", (checked) => {
      repo.setAppSetting(EXCLUDE_REGIONAL_SETTING_KEY, checked ? "1" : "0");
    }),
  );

  // Caught is always the form-grid tile's first icon (the baseline everyone
  // wants); this picks the *second* one — deliberately one field, not a
  // multi-select picker, since the owner specifically didn't want an
  // open-ended "which fields" decision here.
  const formGridFieldset = el("fieldset", {}, [el("legend", {}, ["Form grid — second quick-toggle"])]);
  const formGridOptions = el("div", { class: "theme-options" });
  function renderFormGridSecondFieldOptions() {
    clear(formGridOptions);
    const current = getFormGridSecondField(repo);
    for (const field of FORM_GRID_SECOND_FIELD_OPTIONS) {
      const button = el(
        "button",
        { type: "button", class: `filter-chip${current === field ? " filter-chip-active" : ""}` },
        [INDICATOR_LABELS[field].full],
      );
      button.addEventListener("click", () => {
        setFormGridSecondField(repo, field);
        renderFormGridSecondFieldOptions();
      });
      formGridOptions.append(button);
    }
  }
  renderFormGridSecondFieldOptions();
  formGridFieldset.append(formGridOptions);

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
  const statusEl = el("p", { class: "gap-note", "aria-live": "polite" }, []);

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
  // This file is the only backup that exists — nothing here syncs to any
  // account or server. Sits right under the button rather than in a
  // tooltip/help page, since it's the moment someone decides whether to
  // bother exporting at all.
  const exportGuidance = el("p", { class: "gap-note" }, ["This file is your only backup — export it after play sessions, and before updating or reinstalling the app."]);

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
        `Import "${file.name}" (exported ${new Date(data.exportedAt).toLocaleString()})? This REPLACES all of your current species/form/mega data with what's in this file — anything caught locally that isn't in the file will be gone. Settings/preferences aren't affected.`,
      );
      if (!proceed) return;

      // Backup-before-import is offered, not forced — see
      // docs/v1-tasks/02-data-safety-net.md. A "yes" runs the same export
      // flow as the button above (the user's real save dialog/share sheet,
      // not a silent background write); a "no" skips straight to import.
      const wantsBackup = window.confirm("Back up your current data first, before it's replaced? (Recommended)");
      if (wantsBackup) {
        statusEl.textContent = "Saving a backup of your current data first…";
        const snapshotResult = await exportPersonalData(repo);
        if (snapshotResult === "cancelled") {
          const proceedWithoutBackup = window.confirm("Backup cancelled. Import anyway without one?");
          if (!proceedWithoutBackup) {
            statusEl.textContent = "Cancelled.";
            return;
          }
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

  dataFieldset.append(exportButton, exportGuidance, importLabel, statusEl);

  const aboutFieldset = el("fieldset", {}, [el("legend", {}, ["About"])]);
  aboutFieldset.append(el("p", { class: "gap-note" }, [`Version ${__APP_VERSION__}`]));

  container.append(heading, appearanceFieldset, collapseFieldset, statsFieldset, formGridFieldset, indicatorFieldset, dataFieldset, aboutFieldset);
}
