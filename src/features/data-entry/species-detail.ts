import { navigate, speciesDetailPath } from "../../app-shell/router";
import type { Form, FormPersonal } from "../../db/types";
import type { Repository } from "../../data/repository";
import { clear, el, labeledToggle } from "../../ui/dom";
import { speciesSpritePath } from "../../ui/sprites";
import { FORM_FIELD_GROUPS, SPECIES_FIELDS } from "./field-groups";

const COLLAPSE_SETTING_KEY = "collapse_gender_forms";

export interface FormGroup {
  key: string;
  label: string;
  forms: Form[];
}

// Exported for reuse by the bulk-form-edit page, which needs the identical
// gender-collapsing grouping this page uses (one checkbox per form/costume,
// gender variants merged) rather than reinventing it.
export function groupForms(forms: Form[], collapseGender: boolean): FormGroup[] {
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

function groupIsCaught(group: FormGroup, formPersonalBySlug: Map<string, FormPersonal>): boolean {
  return group.forms.every((f) => formPersonalBySlug.get(f.slug)?.caught);
}

function domId(key: string): string {
  return `form-group-${key.replace(/[^a-zA-Z0-9_-]+/g, "-")}`;
}

// A species with many costumes/letters/formes (e.g. Pikachu's 188) can't
// reasonably show every form group expanded at once — groups render as
// collapsed-by-default <details>. This tracks which ones the user has
// opened, keyed by species, so a toggle-triggered re-render (this module
// re-renders the whole page on every checkbox change) doesn't re-collapse
// sections the user just opened.
const openGroupKeysBySpecies = new Map<string, Set<string>>();

// Same rerender-loses-local-state problem as the open/collapse tracking
// above, for the form-name filter box below (high form-count species like
// Pikachu's 188 are otherwise unsearchable).
const formFilterBySpecies = new Map<string, string>();

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
    // Species-level sprite only — per-form/costume art (e.g. a party-hat
    // Bulbasaur) is the separate, already-scoped image-pipeline task
    // (docs/v1-tasks/05-image-pipeline.md, §7), blocked on sourcing a
    // costume-ID→name lookup that doesn't exist yet.
    el("img", { class: "detail-hero-sprite", src: speciesSpritePath(species.dexNumber), alt: "", loading: "lazy" }),
    el("h2", {}, [el("span", { class: "dex-num" }, [`#${species.dexNumber}`]), ` ${species.name}`]),
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

  const formPersonalBySlug = new Map<string, FormPersonal>(forms.map((f) => [f.form.slug, f.personal]));
  const groups = groupForms(
    forms.map((f) => f.form),
    collapseGender,
  );

  let openKeys = openGroupKeysBySpecies.get(speciesSlug);
  if (!openKeys) {
    openKeys = new Set();
    openGroupKeysBySpecies.set(speciesSlug, openKeys);
  }
  const openKeysForRender = openKeys;

  const rerender = () => renderSpeciesDetail(container, repo, speciesSlug, onBack);

  const filterText = formFilterBySpecies.get(speciesSlug) ?? "";
  const filterInput = el("input", {
    type: "search",
    class: "search-input form-filter-input",
    placeholder: `Filter ${groups.length} forms by name…`,
    value: filterText,
    "aria-label": "Filter forms by name",
  }) as HTMLInputElement;
  filterInput.addEventListener("input", () => {
    formFilterBySpecies.set(speciesSlug, filterInput.value);
    const cursor = filterInput.selectionStart;
    rerender();
    const newInput = container.querySelector<HTMLInputElement>(".form-filter-input");
    newInput?.focus();
    if (cursor !== null) newInput?.setSelectionRange(cursor, cursor);
  });

  const normalizedFilter = filterText.trim().toLowerCase();
  const matchesFilter = (group: FormGroup) => normalizedFilter === "" || group.label.toLowerCase().includes(normalizedFilter);
  const visibleGroups = groups.filter(matchesFilter);

  // Compact overview grid: quick-scan caught status across every form group,
  // and a shortcut to open/jump to one instead of scrolling past everything
  // else in a long collapsed list.
  const overview = el("div", { class: "form-overview-grid" });
  for (const group of visibleGroups) {
    const caught = groupIsCaught(group, formPersonalBySlug);
    const tile = el("button", { type: "button", class: `form-overview-tile${caught ? " caught" : ""}` }, [group.label]);
    tile.addEventListener("click", () => {
      openKeysForRender.add(group.key);
      rerender();
      document.getElementById(domId(group.key))?.scrollIntoView({ block: "start", behavior: "smooth" });
    });
    overview.append(tile);
  }

  const formsContainer = el("div", { class: "forms-container" });
  if (visibleGroups.length === 0) {
    formsContainer.append(el("p", { class: "empty-state" }, ["No forms match that filter."]));
  }
  for (const group of visibleGroups) {
    const caught = groupIsCaught(group, formPersonalBySlug);
    // While actively filtering, auto-open every match instead of requiring an
    // extra tap — the user is specifically looking for this group.
    const forceOpen = normalizedFilter !== "";
    const details = el("details", { id: domId(group.key), class: "form-group" }) as HTMLDetailsElement;
    details.open = forceOpen || openKeysForRender.has(group.key);
    details.addEventListener("toggle", () => {
      if (details.open) openKeysForRender.add(group.key);
      else openKeysForRender.delete(group.key);
    });

    const summary = el("summary", {}, [
      el("span", { class: "form-group-label" }, [group.label]),
      el("span", { class: `form-group-status${caught ? " caught" : ""}` }, [caught ? "✓" : ""]),
    ]);
    details.append(summary);

    for (const { title, fields, availableWhen } of FORM_FIELD_GROUPS) {
      if (availableWhen && !group.forms.some(availableWhen)) continue;
      const fieldset = el("fieldset", {}, [el("legend", {}, [title])]);
      for (const { field, label } of fields) {
        const allChecked = group.forms.every((f) => formPersonalBySlug.get(f.slug)?.[field]);
        fieldset.append(
          labeledToggle(label, allChecked, (checked) => {
            for (const form of group.forms) {
              repo.setFormPersonalField(form.slug, field, checked);
            }
            rerender();
          }),
        );
      }
      details.append(fieldset);
    }
    formsContainer.append(details);
  }

  container.append(header, speciesFieldset);
  // Only worth showing for species with enough forms that scanning them all
  // isn't trivial — most species have a handful, a few (Pikachu, Unown,
  // Vivillon, ...) have dozens to hundreds.
  const FORM_FILTER_THRESHOLD = 8;
  if (groups.length > FORM_FILTER_THRESHOLD) container.append(filterInput);
  container.append(overview, formsContainer);
}
