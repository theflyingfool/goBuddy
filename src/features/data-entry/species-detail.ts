import { navigate, speciesDetailPath } from "../../app-shell/router";
import type { Form, FormPersonal, FormPersonalBooleanField, MegaPersonal, MegaVariant, MegaVariantKind } from "../../db/types";
import { fuzzyMatches, parseSearchQuery, type Repository } from "../../data/repository";
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

// Same per-species/rerender-survives-toggle pattern as shinyViewBySpecies —
// which of the two top-level panels (achievement tracking vs. reference
// info) is showing. Added alongside the new Info panel below; the Tracking
// panel is every bit of this page's existing content, untouched.
const infoViewBySpecies = new Map<string, boolean>();

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

  const identityBox = el("div", { class: "detail-header-identity" }, [
    backButton,
    prevButton,
    el("div", { class: "detail-hero-sprite-wrap" }, [
      el("img", { class: "detail-hero-sprite", src: speciesSpritePath(species.dexNumber, shinyView), alt: "", loading: "lazy" }),
      shinyToggle,
    ]),
    el("h2", {}, [el("span", { class: "dex-num" }, [`#${species.dexNumber}`]), ` ${species.name}`]),
    nextButton,
  ]);

  // Region is species-wide; types are per-form (a handful of species like
  // Tauros's breeds differ), so this reads the first form as the species'
  // representative typing rather than inventing a "default form" concept.
  const region = repo.listRegions().find((r) => r.slug === species.regionSlug);
  const types = forms.length > 0 ? repo.getFormTypes(forms[0].form.slug) : [];
  const infoBox = el("div", { class: "detail-header-info" }, [
    el("div", { class: "detail-header-info-row" }, [
      el("span", { class: "detail-header-info-label" }, ["Region"]),
      el("span", {}, [region?.name ?? "—"]),
    ]),
    el("div", { class: "detail-header-info-row" }, [
      el("span", { class: "detail-header-info-label" }, [types.length > 1 ? "Types" : "Type"]),
      el(
        "span",
        { class: "detail-header-types" },
        types.length > 0 ? types.map((t) => el("span", { class: "type-chip" }, [t.name])) : ["—"],
      ),
    ]),
  ]);

  const header = el("div", { class: "detail-header" }, [identityBox, infoBox]);

  const rerender = () => renderSpeciesDetail(container, repo, speciesSlug, onBack);

  // Tracking/Info split — Tracking is every bit of this page's existing
  // achievement-toggle content (untouched below); Info is new. CP calculator
  // and Pokédex flavor text are deliberately NOT here yet: neither base
  // stats nor flavor text exist anywhere in the ingested reference data
  // (confirmed while scoping this — see docs/vue-migration-plan.md), and
  // fabricating either would be inventing real Pokémon GO facts rather than
  // showing real data. Type matchups ARE real (type_effectiveness), so those
  // are here now.
  const infoView = infoViewBySpecies.get(speciesSlug) ?? false;
  const representativeForm = forms[0]?.form;
  const matchups = representativeForm ? repo.getTypeMatchups(representativeForm.slug) : [];
  const weakTo = matchups.filter((m) => m.multiplier > 1).sort((a, b) => b.multiplier - a.multiplier);
  const resists = matchups.filter((m) => m.multiplier < 1).sort((a, b) => a.multiplier - b.multiplier);

  const trackingTab = el("button", { type: "button", class: `species-view-tab${infoView ? "" : " active"}` }, ["Tracking"]);
  const infoTab = el("button", { type: "button", class: `species-view-tab${infoView ? " active" : ""}` }, ["Info"]);
  trackingTab.addEventListener("click", () => {
    infoViewBySpecies.set(speciesSlug, false);
    rerender();
  });
  infoTab.addEventListener("click", () => {
    infoViewBySpecies.set(speciesSlug, true);
    rerender();
  });
  const viewSegmented = el("div", { class: "species-view-segmented" }, [trackingTab, infoTab]);

  const infoPanel = el("div", { class: "species-info-panel" }, [
    el("fieldset", {}, [
      el("legend", {}, ["Type matchups"]),
      el("div", { class: "matchup-grid" }, [
        ...weakTo.map((m) => el("span", { class: "matchup-chip matchup-weak" }, [`Weak: ${m.attackingType.name} ×${m.multiplier}`])),
        ...resists.map((m) => el("span", { class: "matchup-chip matchup-resist" }, [`Resists: ${m.attackingType.name} ×${m.multiplier}`])),
        ...(weakTo.length === 0 && resists.length === 0 ? [el("span", { class: "gap-note" }, ["No type data for this form."])] : []),
      ]),
    ]),
    el("fieldset", {}, [
      el("legend", {}, ["Pokédex entry"]),
      el("p", { class: "gap-note" }, ["Not available yet — flavor text isn't in the current reference data."]),
    ]),
    el("fieldset", {}, [
      el("legend", {}, ["CP calculator"]),
      el("p", { class: "gap-note" }, ["Not available yet — base stats aren't in the current reference data (see docs/vue-migration-plan.md)."]),
    ]),
  ]);

  // Registered can flip false->true as a side effect of any form/Mega toggle
  // below — it's the species' very first personal-field write, and that
  // cascade writes to speciesPersonal, which lives outside formGrid/
  // megaFieldset entirely (a structurally separate fieldset built once,
  // right here). Rather than rebuild the whole page to reflect it, track
  // the last-known value and patch just this one checkbox on the rare
  // occasion it actually changes — the cascade only ever sets it, never
  // unsets it, so false->true is the only transition to watch for.
  let lastKnownRegistered = personal.registered;
  let registeredInputEl: HTMLInputElement | null = null;
  function patchRegisteredIfChanged() {
    const fresh = repo.getSpeciesWithForms(speciesSlug).personal.registered;
    if (fresh && !lastKnownRegistered && registeredInputEl) registeredInputEl.checked = true;
    lastKnownRegistered = fresh;
  }

  const speciesFieldset = el("fieldset", {}, [el("legend", {}, ["Species"])]);
  for (const { field, label } of SPECIES_FIELDS) {
    const toggleEl = labeledToggle(label, personal[field], (checked) => {
      repo.setSpeciesPersonalField(speciesSlug, field, checked);
      patchRegisteredIfChanged();
    });
    if (field === "registered") registeredInputEl = toggleEl.querySelector("input");
    speciesFieldset.append(toggleEl);
  }

  // Mega is species-wide, not per-form (any non-Shadow individual of the
  // species can be temporarily Mega Evolved regardless of costume) — its own
  // fieldset next to Species/Purified, not folded into the per-form grid
  // below. 0 rows for most species, 1 for single-variant megas, 2 for
  // Charizard/Mewtwo-style dual variants.
  const megaVariants = repo.getMegaVariantsForSpecies(speciesSlug);
  const megaFieldset = megaVariants.length > 0 ? el("fieldset", {}, [el("legend", {}, ["Mega"])]) : null;

  function buildMegaRow(variant: MegaVariant, mp: MegaPersonal): HTMLElement {
    return el("div", { class: "mega-variant-row" }, [
      el("img", {
        class: "mega-variant-sprite",
        src: megaSpritePath(variant.slug, species.dexNumber, shinyView),
        alt: "",
        loading: "lazy",
      }),
      el("span", { class: "mega-variant-label" }, [megaVariantLabel(variant.variant)]),
      labeledToggle("Evolved", mp.evolved, (checked) => {
        repo.setMegaPersonalField(variant.slug, "evolved", checked);
        refreshMegaRow(variant.slug);
      }),
      labeledToggle("Shiny Evolved", mp.shinyEvolved, (checked) => {
        repo.setMegaPersonalField(variant.slug, "shinyEvolved", checked);
        refreshMegaRow(variant.slug);
      }),
    ]);
  }

  const megaRowSlots = new Map<string, HTMLElement>();
  function refreshMegaRow(variantSlug: string) {
    patchRegisteredIfChanged();
    const slot = megaRowSlots.get(variantSlug);
    const fresh = repo.getMegaVariantsForSpecies(speciesSlug).find((v) => v.variant.slug === variantSlug);
    if (!slot || !fresh) {
      rerender();
      return;
    }
    const row = buildMegaRow(fresh.variant, fresh.personal);
    slot.replaceWith(row);
    megaRowSlots.set(variantSlug, row);
  }

  if (megaFieldset) {
    for (const { variant, personal: mp } of megaVariants) {
      const row = buildMegaRow(variant, mp);
      megaRowSlots.set(variant.slug, row);
      megaFieldset.append(row);
    }
  }

  const groups = groupForms(forms.map((f) => f.form), collapseGender);
  const formPersonalBySlug = new Map<string, FormPersonal>(forms.map((f) => [f.form.slug, f.personal]));

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

  // Only "costume" is meaningful at this per-form granularity — rarity
  // keywords (legendary/mythical/ultrabeast) are species-wide facts, so
  // within one species' own form list every form would match or none would.
  const parsedFilter = parseSearchQuery(filterText);
  const matchesFilter = (group: FormGroup) => {
    if (parsedFilter.keyword === "costume") {
      const isCostumeGroup = group.forms.some((f) => f.costumeName !== null);
      return parsedFilter.negate ? !isCostumeGroup : isCostumeGroup;
    }
    return fuzzyMatches(group.label, parsedFilter.text);
  };
  const secondField = getFormGridSecondField(repo);

  let expandedKeys = expandedGroupKeysBySpecies.get(speciesSlug);
  if (!expandedKeys) {
    expandedKeys = new Set();
    expandedGroupKeysBySpecies.set(speciesSlug, expandedKeys);
  }
  const expandedKeysForRender = expandedKeys;

  // Every form (Standard, Shadow, every costume) is one tile in a searchable
  // grid — this is what actually holds up for a 150+-form species like
  // Pikachu, where a scroll-and-hope accordion didn't. Caught + one
  // configurable second achievement icon sit right on the tile (unambiguous
  // here, unlike the Dex grid, since one tile really is one specific form/
  // group); "⋯" expands that tile in place into its full field list without
  // navigating anywhere else.
  //
  // Toggling a tile's own state (caught/second icon/expand/an expanded
  // field) rebuilds only that tile (+ its expanded panel) in place instead
  // of the whole page — buildTile() is a pure function of (group, current
  // personal-state map), called once per tile on the initial render and
  // again, standalone, whenever that one tile's own state changes.
  const formGrid = el("div", { class: "form-grid" });
  const tileSlots = new Map<string, { tile: HTMLElement; panel: HTMLElement | null }>();

  function buildTile(group: FormGroup, formPersonalBySlug: Map<string, FormPersonal>): { tile: HTMLElement; panel: HTMLElement | null } {
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
      refreshTile(group);
    });

    const secondToggle = el(
      "button",
      { type: "button", class: `form-mini-toggle${secondOn ? " on" : ""}`, "aria-pressed": String(secondOn), "aria-label": `${INDICATOR_LABELS[secondField].full}: ${secondOn ? "on" : "off"}` },
      [INDICATOR_LABELS[secondField].badge],
    );
    secondToggle.addEventListener("click", (e) => {
      e.stopPropagation();
      for (const form of group.forms) repo.setFormPersonalField(form.slug, secondField, !secondOn);
      refreshTile(group);
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
      refreshTile(group);
    };
    tile.addEventListener("click", toggleExpanded);
    tile.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggleExpanded();
      }
    });

    let panel: HTMLElement | null = null;
    if (isExpanded) {
      panel = el("div", { class: "form-expanded-panel", id: domId(group.key) }, [
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
              refreshTile(group);
            }),
          );
        }
        panel.append(fieldset);
      }
    }
    return { tile, panel };
  }

  function refreshTile(group: FormGroup) {
    patchRegisteredIfChanged();
    const slot = tileSlots.get(group.key);
    if (!slot) {
      rerender();
      return;
    }
    const freshFormPersonalBySlug = new Map<string, FormPersonal>(
      repo.getSpeciesWithForms(speciesSlug).forms.map((f) => [f.form.slug, f.personal]),
    );
    // "Missing only" is a live filter on caught-state — a tile that just got
    // marked caught needs to actually disappear from that view, not sit
    // there patched-in-place looking done inside a "still missing" list.
    if (missingOnly && groupFieldAllTrue(group, freshFormPersonalBySlug, "caught")) {
      slot.tile.remove();
      slot.panel?.remove();
      tileSlots.delete(group.key);
      if (tileSlots.size === 0) {
        formGrid.append(el("p", { class: "empty-state" }, ["No forms match that filter."]));
      }
      return;
    }
    const fresh = buildTile(group, freshFormPersonalBySlug);
    slot.tile.replaceWith(fresh.tile);
    if (slot.panel) {
      if (fresh.panel) slot.panel.replaceWith(fresh.panel);
      else slot.panel.remove();
    } else if (fresh.panel) {
      fresh.tile.after(fresh.panel);
    }
    tileSlots.set(group.key, fresh);
  }

  const visibleGroups = groups.filter(matchesFilter).filter((g) => !missingOnly || !groupFieldAllTrue(g, formPersonalBySlug, "caught"));

  if (visibleGroups.length === 0) {
    formGrid.append(el("p", { class: "empty-state" }, ["No forms match that filter."]));
  }
  for (const group of visibleGroups) {
    const { tile, panel } = buildTile(group, formPersonalBySlug);
    tileSlots.set(group.key, { tile, panel });
    formGrid.append(tile);
    if (panel) formGrid.append(panel);
  }

  container.append(header, viewSegmented);
  if (infoView) {
    container.append(infoPanel);
  } else {
    container.append(speciesFieldset);
    if (megaFieldset) container.append(megaFieldset);
    container.append(formToolbar, formGrid);
  }
}
