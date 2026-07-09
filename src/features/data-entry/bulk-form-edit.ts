// Tier-B bulk edit: a fast "sweep one field across many forms" page for the
// workflow the user described — after initial per-form caught entry, quickly
// mark all their 4★s / shinies / etc. without hunting each form individually.
//
// Reuses, rather than reinventing:
//   - repo.listSpeciesSummaries(filter) for region/search/caught/field
//     filtering (same SpeciesFilter the grid uses),
//   - groupForms() from species-detail for the identical gender-collapsed
//     grouping (one checkbox per form/costume),
//   - FORM_FIELD_GROUPS for the section-grouped target-field picker and its
//     availableWhen availability gating,
//   - repo.bulkSetFormPersonalField for the batched, single-flush write.

import type { GridFilterField, Repository, SpeciesFilter } from "../../data/repository";
import type { Form, FormPersonal, FormPersonalBooleanField } from "../../db/types";
import { clear, el } from "../../ui/dom";
import { FORM_FIELD_GROUPS } from "./field-groups";
import { gridFilterFieldLabel, MORE_FILTER_FIELDS } from "./indicator-labels";
import { groupForms } from "./species-detail";

type FieldFilterState = "include" | "exclude";

interface BulkFormEditState {
  region: string; // "" = all regions
  search: string;
  caught: NonNullable<SpeciesFilter["caught"]>;
  fieldFilters: Partial<Record<GridFilterField, FieldFilterState>>;
  targetField: FormPersonalBooleanField;
  targetValue: boolean;
  /** Eligible form slugs the user has checked for the next apply. */
  selectedForms: Set<string>;
}

// Module-level so a re-render (the page rebuilds itself on every change, like
// species-detail) preserves the user's in-progress filter/selection.
const state: BulkFormEditState = {
  region: "",
  search: "",
  caught: "caught", // the primary workflow starts from "things I've already caught"
  fieldFilters: {},
  targetField: "fourStar",
  targetValue: true,
  selectedForms: new Set(),
};

const CAUGHT_OPTIONS: { value: BulkFormEditState["caught"]; label: string }[] = [
  { value: "all", label: "All" },
  { value: "caught", label: "Caught" },
  { value: "uncaught", label: "Uncaught" },
];

// Cap on how many species' form lists we render at once — a broad filter (e.g.
// "all caught") can match hundreds of species; showing every form checkbox
// would be unusably long and slow. Selection/apply still operate only on what
// the user actually checks, so this is a display-only guard.
const MAX_SPECIES_SHOWN = 120;

function findFieldGroup(field: FormPersonalBooleanField) {
  return FORM_FIELD_GROUPS.find((g) => g.fields.some((f) => f.field === field))!;
}

/** Forms of a group that the target field's section can actually apply to (honors availableWhen). */
function eligibleForms(group: { forms: Form[] }, availableWhen?: (form: Form) => boolean): Form[] {
  return availableWhen ? group.forms.filter(availableWhen) : group.forms;
}

export function renderBulkFormEditPage(container: HTMLElement, repo: Repository) {
  clear(container);
  const rerender = () => renderBulkFormEditPage(container, repo);

  const targetGroup = findFieldGroup(state.targetField);
  const availableWhen = targetGroup.availableWhen;
  const targetLabel = targetGroup.fields.find((f) => f.field === state.targetField)!.label;

  container.append(el("h2", { class: "page-title" }, ["Bulk edit forms"]));
  container.append(
    el("p", { class: "page-intro" }, [
      "Filter to the forms you want, pick one field to set, then apply it to everything you've checked.",
    ]),
  );

  // ---- Filters (region / search / caught / field chips) ----
  const filters = el("div", { class: "bulk-filters" });

  const regionSelect = el("select", { class: "bulk-region-select", "aria-label": "Region" }) as HTMLSelectElement;
  regionSelect.append(el("option", { value: "" }, ["All regions"]));
  for (const region of repo.listRegions()) {
    regionSelect.append(el("option", { value: region.slug }, [region.name]));
  }
  regionSelect.value = state.region;
  regionSelect.addEventListener("change", () => {
    state.region = regionSelect.value;
    rerender();
  });

  const searchInput = el("input", { type: "search", class: "bulk-search", placeholder: "Search name or #", "aria-label": "Search" }) as HTMLInputElement;
  searchInput.value = state.search;
  searchInput.addEventListener("input", () => {
    state.search = searchInput.value;
    rerender();
  });

  const caughtBar = el("div", { class: "filter-bar" });
  for (const opt of CAUGHT_OPTIONS) {
    const btn = el("button", { type: "button", class: `filter-chip${state.caught === opt.value ? " filter-chip-active" : ""}` }, [opt.label]);
    btn.addEventListener("click", () => {
      state.caught = opt.value;
      rerender();
    });
    caughtBar.append(btn);
  }

  const fieldChips = el("div", { class: "filter-bar" });
  for (const field of MORE_FILTER_FIELDS) {
    const current = state.fieldFilters[field];
    const label = gridFilterFieldLabel(field);
    const stateClass = current === "include" ? " filter-chip-include" : current === "exclude" ? " filter-chip-exclude" : "";
    const suffix = current === "include" ? " ✓" : current === "exclude" ? " ✕" : "";
    const chip = el("button", { type: "button", class: `filter-chip${stateClass}`, title: label.full }, [`${label.badge}${suffix}`]);
    chip.addEventListener("click", () => {
      if (current === undefined) state.fieldFilters[field] = "include";
      else if (current === "include") state.fieldFilters[field] = "exclude";
      else delete state.fieldFilters[field];
      rerender();
    });
    fieldChips.append(chip);
  }

  filters.append(
    el("div", { class: "bulk-filter-row" }, [regionSelect, searchInput]),
    caughtBar,
    fieldChips,
  );
  container.append(filters);

  // ---- Target field picker (grouped by section) + on/off ----
  const targetBar = el("div", { class: "bulk-target-bar" });
  const targetSelect = el("select", { class: "bulk-target-select", "aria-label": "Field to set" }) as HTMLSelectElement;
  for (const group of FORM_FIELD_GROUPS) {
    const optgroup = el("optgroup", { label: group.title }) as HTMLOptGroupElement;
    for (const f of group.fields) {
      optgroup.append(el("option", { value: f.field }, [f.label]));
    }
    targetSelect.append(optgroup);
  }
  targetSelect.value = state.targetField;
  targetSelect.addEventListener("change", () => {
    state.targetField = targetSelect.value as FormPersonalBooleanField;
    // Eligibility (which forms a Shadow/Dynamax field can touch) changes with
    // the field, so a stale selection could target now-ineligible forms —
    // clear it on field change.
    state.selectedForms.clear();
    rerender();
  });

  const onOff = el("div", { class: "bulk-onoff" });
  for (const opt of [{ v: true, label: "On" }, { v: false, label: "Off" }] as const) {
    const btn = el("button", { type: "button", class: `filter-chip${state.targetValue === opt.v ? " filter-chip-active" : ""}` }, [opt.label]);
    btn.addEventListener("click", () => {
      state.targetValue = opt.v;
      rerender();
    });
    onOff.append(btn);
  }

  targetBar.append(el("span", { class: "bulk-set-label" }, ["Set field"]), targetSelect, onOff);
  if (availableWhen) {
    targetBar.append(el("span", { class: "bulk-gating-note" }, [`Only ${targetGroup.title}-available forms are shown.`]));
  }
  container.append(targetBar);

  // ---- Candidate form list ----
  const hasNarrowing = state.region !== "" || state.search.trim() !== "" || state.caught !== "all" || Object.keys(state.fieldFilters).length > 0;

  const listContainer = el("div", { class: "bulk-form-list" });
  const eligibleVisibleSlugs: string[] = [];

  if (!hasNarrowing) {
    listContainer.append(el("p", { class: "empty-state" }, ["Pick a region, search, or filter above to list forms."]));
  } else {
    const summaries = repo.listSpeciesSummaries({
      region: state.region || undefined,
      search: state.search || undefined,
      caught: state.caught,
      fieldFilters: state.fieldFilters,
    });

    if (summaries.length === 0) {
      listContainer.append(el("p", { class: "empty-state" }, ["No species match those filters."]));
    } else {
      const shown = summaries.slice(0, MAX_SPECIES_SHOWN);
      for (const { species } of shown) {
        const { forms } = repo.getSpeciesWithForms(species.slug);
        const personalBySlug = new Map<string, FormPersonal>(forms.map((f) => [f.form.slug, f.personal]));
        const groups = groupForms(
          forms.map((f) => f.form),
          true,
        );

        const rows: HTMLElement[] = [];
        for (const group of groups) {
          const eligible = eligibleForms(group, availableWhen);
          if (eligible.length === 0) continue; // gated out (e.g. non-shadow form, Shadow field selected)
          const eligibleSlugs = eligible.map((f) => f.slug);
          for (const s of eligibleSlugs) eligibleVisibleSlugs.push(s);

          const checked = eligibleSlugs.every((s) => state.selectedForms.has(s));
          const alreadySet = eligibleSlugs.every((s) => personalBySlug.get(s)?.[state.targetField]);

          const input = el("input", { type: "checkbox" }) as HTMLInputElement;
          input.checked = checked;
          input.addEventListener("change", () => {
            if (input.checked) for (const s of eligibleSlugs) state.selectedForms.add(s);
            else for (const s of eligibleSlugs) state.selectedForms.delete(s);
            rerender();
          });

          rows.push(
            el("label", { class: "toggle-row bulk-form-row" }, [
              input,
              el("span", {}, [group.label]),
              el("span", { class: `bulk-current${alreadySet ? " on" : ""}`, title: `Current ${targetLabel}` }, [alreadySet ? "✓" : ""]),
            ]),
          );
        }

        if (rows.length === 0) continue;
        const card = el("div", { class: "bulk-species-card" }, [
          el("div", { class: "bulk-species-name" }, [el("span", { class: "dex-num" }, [`#${species.dexNumber}`]), ` ${species.name}`]),
          ...rows,
        ]);
        listContainer.append(card);
      }

      if (summaries.length > shown.length) {
        listContainer.append(el("p", { class: "bulk-truncation-note" }, [`Showing the first ${shown.length} of ${summaries.length} species — narrow your filters to see more.`]));
      }
    }
  }

  // ---- Select-all / clear over what's currently visible ----
  if (eligibleVisibleSlugs.length > 0) {
    const selectionBar = el("div", { class: "bulk-selection-bar" });
    const allVisibleSelected = eligibleVisibleSlugs.every((s) => state.selectedForms.has(s));
    const selectAllBtn = el("button", { type: "button", class: "filter-chip" }, [allVisibleSelected ? "Deselect visible" : "Select visible"]);
    selectAllBtn.addEventListener("click", () => {
      if (allVisibleSelected) for (const s of eligibleVisibleSlugs) state.selectedForms.delete(s);
      else for (const s of eligibleVisibleSlugs) state.selectedForms.add(s);
      rerender();
    });
    selectionBar.append(selectAllBtn);
    container.append(selectionBar);
  }

  container.append(listContainer);

  // ---- Apply bar ----
  const applyBar = el("div", { class: "bulk-action-bar bulk-apply-bar" });
  const count = state.selectedForms.size;
  applyBar.append(el("span", { class: "bulk-count" }, [`${count} form${count === 1 ? "" : "s"} selected`]));

  const applyBtn = el("button", { type: "button", class: "bulk-apply-button" }, [`Apply "${targetLabel}" ${state.targetValue ? "On" : "Off"} to ${count} selected form${count === 1 ? "" : "s"}`]);
  if (count === 0) applyBtn.setAttribute("disabled", "true");
  applyBtn.addEventListener("click", () => {
    const slugs = [...state.selectedForms];
    if (slugs.length === 0) return;
    applyBtn.setAttribute("disabled", "true");
    applyBtn.textContent = "Applying…";
    void repo.bulkSetFormPersonalField(slugs, state.targetField, state.targetValue).then(() => {
      state.selectedForms.clear();
      rerender();
    });
  });

  const clearBtn = el("button", { type: "button", class: "bulk-clear-button" }, ["Clear selection"]);
  if (count === 0) clearBtn.setAttribute("disabled", "true");
  clearBtn.addEventListener("click", () => {
    state.selectedForms.clear();
    rerender();
  });

  applyBar.append(applyBtn, clearBtn);
  container.append(applyBar);
}
