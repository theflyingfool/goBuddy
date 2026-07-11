import { navigate, speciesDetailPath } from "../../app-shell/router";
import type { Form, FormPersonal, FormPersonalBooleanField, MegaVariantKind } from "../../db/types";
import type { Repository } from "../../data/repository";
import { clear, el, labeledToggle } from "../../ui/dom";
import { formSpritePath, megaSpritePath, speciesSpritePath } from "../../ui/sprites";
import { FORM_FIELD_GROUPS, SPECIES_FIELDS } from "./field-groups";
import { INDICATOR_LABELS, getFormGridSecondField } from "./indicator-labels";

// "Mega" for the single-variant case (null), "Mega X"/"Mega Y" for
// Charizard/Mewtwo-style dual variants, "Primal" as-is (that's the real
// in-game name — not "Mega Primal").
function megaVariantLabel(variant: MegaVariantKind): string {
  return variant === null ? "Mega" : variant === "Primal" ? "Primal" : `Mega ${variant}`;
}

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

// A gender-collapsed group can be >1 form (male+female); "true for the
// group" means true for every form in it, same convention the old per-group
// fieldsets used for their checkbox state.
function groupFieldAllTrue(group: FormGroup, formPersonalBySlug: Map<string, FormPersonal>, field: FormPersonalBooleanField): boolean {
  return group.forms.every((f) => formPersonalBySlug.get(f.slug)?.[field]);
}

function domId(key: string): string {
  return `form-group-${key.replace(/[^a-zA-Z0-9_-]+/g, "-")}`;
}

// Which form tiles are expanded-in-place (showing their full field list)
// right now, keyed by species — persisted across the full-page rerenders
// this module still does on every toggle, so expanding a tile doesn't get
// silently re-collapsed by an unrelated state change.
const expandedGroupKeysBySpecies = new Map<string, Set<string>>();

// Same rerender-loses-local-state problem as the expand tracking above, for
// the form-name filter box (high form-count species like Pikachu's 188 are
// otherwise unsearchable) and the per-species "Missing only" toggle.
const formFilterBySpecies = new Map<string, string>();
const missingOnlyBySpecies = new Map<string, boolean>();

// View-only "show shiny art instead" toggle — deliberately independent of
// any caught-shiny achievement field, since the point is to be able to look
// at what shiny looks like regardless of whether you've actually caught one.
// Same per-species/rerender-survives-toggle pattern as the maps above.
const shinyViewBySpecies = new Map<string, boolean>();

export function renderSpeciesDetail(container: HTMLElement, repo: Repository, speciesSlug: string, onBack: () => void) {
  clear(container);

  const { species, personal, forms } = repo.getSpeciesWithForms(speciesSlug);
  const collapseGender = repo.getAppSetting(COLLAPSE_SETTING_KEY) === "1";
  const { prev, next } = repo.getAdjacentSpecies(speciesSlug);
  const shinyView = shinyViewBySpecies.get(speciesSlug) ?? false;

  const backButton = el("button", { type: "button", class: "back-button" }, ["← Back"]);
  backButton.addEventListener("click", onBack);

  const prevButton = el("button", { type: "button", class: "nav-chevron", disabled: prev ? undefined : "true" }, ["‹"]);
  if (prev) prevButton.addEventListener("click", () => navigate(speciesDetailPath(prev.slug)));

  const nextButton = el("button", { type: "button", class: "nav-chevron", disabled: next ? undefined : "true" }, ["›"]);
  if (next) nextButton.addEventListener("click", () => navigate(speciesDetailPath(next.slug)));

  // View-only — flips which art this page's sprites show, independent of
  // any caught-shiny achievement. Affects the hero sprite and every form
  // tile below at once, so "going back and forth" is one tap either way.
  const shinyToggle = el(
    "button",
    { type: "button", class: `shiny-view-toggle${shinyView ? " on" : ""}`, "aria-pressed": String(shinyView), "aria-label": `Show shiny art: ${shinyView ? "on" : "off"}`, title: "View shiny art" },
    ["✨"],
  );
  shinyToggle.addEventListener("click", () => {
    shinyViewBySpecies.set(speciesSlug, !shinyView);
    rerender();
  });

  const header = el("div", { class: "detail-header" }, [
    backButton,
    prevButton,
    el("div", { class: "detail-hero-sprite-wrap" }, [
      el("img", { class: "detail-hero-sprite", src: speciesSpritePath(species.dexNumber, shinyView), alt: "", loading: "lazy" }),
      shinyToggle,
    ]),
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

  let expandedKeys = expandedGroupKeysBySpecies.get(speciesSlug);
  if (!expandedKeys) {
    expandedKeys = new Set();
    expandedGroupKeysBySpecies.set(speciesSlug, expandedKeys);
  }
  const expandedKeysForRender = expandedKeys;

  const rerender = () => renderSpeciesDetail(container, repo, speciesSlug, onBack);

  // Mega is species-wide, not per-form (any non-Shadow individual of the
  // species can be temporarily Mega Evolved regardless of costume) — its own
  // fieldset next to Species/Purified, not folded into the per-form grid
  // below. 0 rows for most species, 1 for single-variant megas, 2 for
  // Charizard/Mewtwo-style dual variants.
  const megaVariants = repo.getMegaVariantsForSpecies(speciesSlug);
  const megaFieldset = megaVariants.length > 0 ? el("fieldset", {}, [el("legend", {}, ["Mega"])]) : null;
  if (megaFieldset) {
    for (const { variant, personal: mp } of megaVariants) {
      megaFieldset.append(
        el("div", { class: "mega-variant-row" }, [
          el("img", {
            class: "mega-variant-sprite",
            src: megaSpritePath(variant.slug, species.dexNumber, shinyView),
            alt: "",
            loading: "lazy",
          }),
          el("span", { class: "mega-variant-label" }, [megaVariantLabel(variant.variant)]),
          labeledToggle("Evolved", mp.evolved, (checked) => {
            repo.setMegaPersonalField(variant.slug, "evolved", checked);
            rerender();
          }),
          labeledToggle("Shiny Evolved", mp.shinyEvolved, (checked) => {
            repo.setMegaPersonalField(variant.slug, "shinyEvolved", checked);
            rerender();
          }),
        ]),
      );
    }
  }

  const filterText = formFilterBySpecies.get(speciesSlug) ?? "";
  const filterInput = el("input", {
    type: "search",
    class: "search-input form-filter-input",
    placeholder: `Search ${groups.length} forms…`,
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

  const missingOnly = missingOnlyBySpecies.get(speciesSlug) ?? false;
  const missingChip = el(
    "button",
    { type: "button", class: `missing-chip${missingOnly ? " on" : ""}`, "aria-pressed": String(missingOnly) },
    [`Missing only${missingOnly ? " ✓" : ""}`],
  );
  missingChip.addEventListener("click", () => {
    missingOnlyBySpecies.set(speciesSlug, !missingOnly);
    rerender();
  });

  const formToolbar = el("div", { class: "form-toolbar" }, [filterInput, missingChip]);

  const normalizedFilter = filterText.trim().toLowerCase();
  const matchesFilter = (group: FormGroup) => normalizedFilter === "" || group.label.toLowerCase().includes(normalizedFilter);
  const secondField = getFormGridSecondField(repo);
  const visibleGroups = groups.filter(matchesFilter).filter((g) => !missingOnly || !groupFieldAllTrue(g, formPersonalBySlug, "caught"));

  // Every form (Standard, Shadow, every costume) is one tile in a searchable
  // grid — this is what actually holds up for a 150+-form species like
  // Pikachu, where a scroll-and-hope accordion didn't. Caught + one
  // configurable second achievement icon sit right on the tile (unambiguous
  // here, unlike the Dex grid, since one tile really is one specific form/
  // group); "⋯" expands that tile in place into its full field list without
  // navigating anywhere else.
  const formGrid = el("div", { class: "form-grid" });
  if (visibleGroups.length === 0) {
    formGrid.append(el("p", { class: "empty-state" }, ["No forms match that filter."]));
  }
  for (const group of visibleGroups) {
    const caught = groupFieldAllTrue(group, formPersonalBySlug, "caught");
    const secondOn = groupFieldAllTrue(group, formPersonalBySlug, secondField);
    const isExpanded = expandedKeysForRender.has(group.key);

    const caughtToggle = el(
      "button",
      { type: "button", class: `form-mini-toggle${caught ? " on" : ""}`, "aria-pressed": String(caught), "aria-label": `Caught: ${caught ? "on" : "off"}` },
      [INDICATOR_LABELS.caught.badge],
    );
    caughtToggle.addEventListener("click", (e) => {
      e.stopPropagation();
      for (const form of group.forms) repo.setFormPersonalField(form.slug, "caught", !caught);
      rerender();
    });

    const secondToggle = el(
      "button",
      { type: "button", class: `form-mini-toggle${secondOn ? " on" : ""}`, "aria-pressed": String(secondOn), "aria-label": `${INDICATOR_LABELS[secondField].full}: ${secondOn ? "on" : "off"}` },
      [INDICATOR_LABELS[secondField].badge],
    );
    secondToggle.addEventListener("click", (e) => {
      e.stopPropagation();
      for (const form of group.forms) repo.setFormPersonalField(form.slug, secondField, !secondOn);
      rerender();
    });

    const tile = el(
      "div",
      { class: `form-tile${isExpanded ? " active-tile" : ""}`, role: "button", tabindex: "0", "aria-expanded": String(isExpanded), "aria-label": `${group.label}, ${isExpanded ? "collapse" : "expand"}` },
      [
        el("span", { class: "form-tile-more" }, ["⋯"]),
        el("img", { class: "form-tile-sprite", src: formSpritePath(group.forms[0].slug, species.dexNumber, shinyView), alt: "", loading: "lazy" }),
        el("div", { class: "form-tile-name" }, [group.label]),
        el("div", { class: "form-tile-icons" }, [caughtToggle, secondToggle]),
      ],
    );
    const toggleExpanded = () => {
      if (isExpanded) expandedKeysForRender.delete(group.key);
      else expandedKeysForRender.add(group.key);
      rerender();
    };
    tile.addEventListener("click", toggleExpanded);
    tile.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggleExpanded();
      }
    });
    formGrid.append(tile);

    if (isExpanded) {
      const panel = el("div", { class: "form-expanded-panel", id: domId(group.key) }, [
        el("div", { class: "form-expanded-title" }, [group.label]),
      ]);
      for (const { title, fields, availableWhen } of FORM_FIELD_GROUPS) {
        if (availableWhen && !group.forms.some(availableWhen)) continue;
        const fieldset = el("fieldset", {}, [el("legend", {}, [title])]);
        for (const { field, label } of fields) {
          const allChecked = groupFieldAllTrue(group, formPersonalBySlug, field);
          fieldset.append(
            labeledToggle(label, allChecked, (checked) => {
              for (const form of group.forms) {
                repo.setFormPersonalField(form.slug, field, checked);
              }
              rerender();
            }),
          );
        }
        panel.append(fieldset);
      }
      formGrid.append(panel);
    }
  }

  container.append(header, speciesFieldset);
  if (megaFieldset) container.append(megaFieldset);
  container.append(formToolbar, formGrid);
}
