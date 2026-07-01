import { MAX_GRID_INDICATORS, type Repository } from "../../data/repository";
import { clear, el, labeledToggle } from "../../ui/dom";
import { INDICATOR_LABELS, INDICATOR_OPTIONS } from "../data-entry/indicator-labels";

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

  container.append(heading, collapseFieldset, indicatorFieldset);
}
