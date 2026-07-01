import { navigate, speciesDetailPath } from "../../app-shell/router";
import type { Form, FormPersonal } from "../../db/types";
import type { Repository } from "../../data/repository";
import { clear, el, labeledToggle } from "../../ui/dom";
import { FORM_FIELD_GROUPS, SPECIES_FIELDS } from "./field-groups";

const COLLAPSE_SETTING_KEY = "collapse_gender_forms";

interface FormGroup {
  key: string;
  label: string;
  forms: Form[];
}

function groupForms(forms: Form[], collapseGender: boolean): FormGroup[] {
  const groups = new Map<string, FormGroup>();
  for (const form of forms) {
    const groupKey = collapseGender ? `${form.formName}|${form.costumeName ?? ""}` : form.slug;
    const existing = groups.get(groupKey);
    if (existing) {
      existing.forms.push(form);
    } else {
      const baseLabel = form.costumeName ?? form.formName;
      const label = collapseGender ? baseLabel : `${baseLabel} (${form.gender})`;
      groups.set(groupKey, { key: groupKey, label, forms: [form] });
    }
  }
  return [...groups.values()];
}

export function renderSpeciesDetail(container: HTMLElement, repo: Repository, speciesSlug: string, onBack: () => void) {
  clear(container);

  const { species, personal, forms } = repo.getSpeciesWithForms(speciesSlug);
  const collapseGender = repo.getAppSetting(COLLAPSE_SETTING_KEY) === "1";
  const { prev, next } = repo.getAdjacentSpecies(speciesSlug);

  const backButton = el("button", { type: "button", class: "back-button" }, ["← Back"]);
  backButton.addEventListener("click", onBack);

  const prevButton = el("button", { type: "button", class: "nav-chevron", disabled: prev ? undefined : "true" }, ["‹"]);
  if (prev) prevButton.addEventListener("click", () => navigate(speciesDetailPath(prev.slug)));

  const nextButton = el("button", { type: "button", class: "nav-chevron", disabled: next ? undefined : "true" }, ["›"]);
  if (next) nextButton.addEventListener("click", () => navigate(speciesDetailPath(next.slug)));

  const header = el("div", { class: "detail-header" }, [
    backButton,
    prevButton,
    el("h2", {}, [`#${species.dexNumber} ${species.name}`]),
    nextButton,
  ]);

  const speciesFieldset = el("fieldset", {}, [el("legend", {}, ["Species"])]);
  for (const { field, label } of SPECIES_FIELDS) {
    speciesFieldset.append(
      labeledToggle(label, personal[field], (checked) => {
        repo.setSpeciesPersonalField(speciesSlug, field, checked);
      }),
    );
  }

  const formsContainer = el("div", { class: "forms-container" });
  const formPersonalBySlug = new Map<string, FormPersonal>(forms.map((f) => [f.form.slug, f.personal]));
  const groups = groupForms(
    forms.map((f) => f.form),
    collapseGender,
  );

  for (const group of groups) {
    const groupEl = el("div", { class: "form-group" }, [el("h3", {}, [group.label])]);
    for (const { title, fields } of FORM_FIELD_GROUPS) {
      const fieldset = el("fieldset", {}, [el("legend", {}, [title])]);
      for (const { field, label } of fields) {
        const allChecked = group.forms.every((f) => formPersonalBySlug.get(f.slug)?.[field]);
        fieldset.append(
          labeledToggle(label, allChecked, (checked) => {
            for (const form of group.forms) {
              repo.setFormPersonalField(form.slug, field, checked);
            }
            renderSpeciesDetail(container, repo, speciesSlug, onBack);
          }),
        );
      }
      groupEl.append(fieldset);
    }
    formsContainer.append(groupEl);
  }

  container.append(header, speciesFieldset, formsContainer);
}
