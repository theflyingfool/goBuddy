<!--
  Bulk Edit forms — Vue port of bulk-form-edit.ts's renderBulkFormEditPage.
  Tier-B bulk edit: a fast "sweep one field across many forms" page for the
  workflow the user described — after initial per-form caught entry, quickly
  mark all their 4-star/shiny/etc. without hunting each form individually.

  Reuses, rather than reinventing:
    - repo.listSpeciesSummaries(filter) for region/search/caught/field
      filtering (same SpeciesFilter the grid uses),
    - groupForms() from species-detail-shared for the identical
      gender-collapsed grouping (one tile per form/costume),
    - FORM_FIELD_GROUPS for the section-grouped target-field picker and its
      availableWhen availability gating,
    - repo.bulkSetFormPersonalField for the batched, single-flush write.

  Rendered directly inside DexGridPage.vue's template (as a child component,
  not a separately-mounted app) whenever the grid's select-mode granularity
  toggle is set to "form" — see docs/vue-migration-plan.md's Dex/Bulk Edit
  merge notes. State below is module-level (like the vanilla page's) so
  toggling the granularity switch back and forth preserves in-progress
  filters/selection, matching today's behavior exactly.
-->
<script lang="ts">
// Real module scope (a plain, non-`setup` <script> block) rather than a
// `const` at the top of <script setup> — <script setup> compiles into the
// component's setup(), which reruns on every mount, so a `const` declared
// there is per-instance, not shared. This component only exists in the DOM
// while the grid's bulkGranularity === "form" (see DexGridPage.vue), and
// every route/state change up there fully remounts it (mountVueRoute always
// unmounts+recreates, per main.ts) — so a real module-level singleton is
// required to preserve the user's in-progress filter/selection across a
// granularity-toggle round trip, matching the vanilla bulk-form-edit.ts
// page's module-level state exactly.
import { reactive } from "vue";
import type { GridFilterField, SpeciesFilter } from "../../data/repository";
import type { FormPersonalBooleanField } from "../../db/types";

export type FieldFilterState = "include" | "exclude";

export interface BulkFormEditState {
  region: string; // "" = all regions
  search: string;
  caught: NonNullable<SpeciesFilter["caught"]>;
  fieldFilters: Partial<Record<GridFilterField, FieldFilterState>>;
  targetField: FormPersonalBooleanField;
  targetValue: boolean;
  /** Eligible form slugs the user has checked for the next apply. */
  selectedForms: Set<string>;
  /** Whether the region/caught/field-chip filter sheet is open. */
  filterSheetOpen: boolean;
}

export const bulkFormEditState: BulkFormEditState = reactive({
  region: "",
  search: "",
  caught: "caught", // the primary workflow starts from "things I've already caught"
  fieldFilters: {},
  targetField: "fourStar",
  targetValue: true,
  selectedForms: new Set(),
  filterSheetOpen: false,
});
</script>

<script setup lang="ts">
import { computed, ref } from "vue";
import { parseSearchQuery, type GridFilterField, type Repository } from "../../data/repository";
import { FORM_PERSONAL_BOOLEAN_FIELDS, type Form, type FormPersonalBooleanField } from "../../db/types";
import { formSpritePath } from "../../ui/sprites";
import { FORM_FIELD_GROUPS } from "./field-groups";
import { gridFilterFieldLabel, MORE_FILTER_FIELDS } from "./indicator-labels";
import { groupForms, matchesCaughtFilter } from "./species-detail-shared";

const props = defineProps<{ repo: Repository }>();

const state = bulkFormEditState;

const applying = ref(false);

const CAUGHT_OPTIONS: { value: BulkFormEditState["caught"]; label: string }[] = [
  { value: "all", label: "All" },
  { value: "caught", label: "Caught" },
  { value: "uncaught", label: "Uncaught" },
];

function findFieldGroup(field: FormPersonalBooleanField) {
  return FORM_FIELD_GROUPS.find((g) => g.fields.some((f) => f.field === field))!;
}

/** Forms of a group that the target field's section can actually apply to (honors availableWhen). */
function eligibleForms(group: { forms: Form[] }, availableWhen?: (form: Form) => boolean): Form[] {
  return availableWhen ? group.forms.filter(availableWhen) : group.forms;
}

const targetGroup = computed(() => findFieldGroup(state.targetField));
const availableWhen = computed(() => targetGroup.value.availableWhen);
const targetLabel = computed(() => targetGroup.value.fields.find((f) => f.field === state.targetField)!.label);

const activeFilterCount = computed(
  () => (state.region !== "" ? 1 : 0) + (state.caught !== "all" ? 1 : 0) + Object.keys(state.fieldFilters).length,
);

function fieldChipState(field: GridFilterField) {
  const current = state.fieldFilters[field];
  const label = gridFilterFieldLabel(field);
  const stateClass = current === "include" ? " filter-chip-include" : current === "exclude" ? " filter-chip-exclude" : "";
  const stateWord = current === "include" ? "included" : current === "exclude" ? "excluded" : "off";
  const suffix = current === "include" ? " ✓" : current === "exclude" ? " ✕" : "";
  return { current, label, stateClass, stateWord, suffix };
}

function cycleFieldFilter(field: GridFilterField) {
  const current = state.fieldFilters[field];
  if (current === undefined) state.fieldFilters[field] = "include";
  else if (current === "include") state.fieldFilters[field] = "exclude";
  else delete state.fieldFilters[field];
}

const regions = computed(() => props.repo.listRegions());

function onTargetFieldChange(field: FormPersonalBooleanField) {
  state.targetField = field;
  // Eligibility (which forms a Shadow/Dynamax field can touch) changes with
  // the field, so a stale selection could target now-ineligible forms —
  // clear it on field change.
  state.selectedForms.clear();
}

interface TileVM {
  key: string;
  label: string;
  ariaLabel: string;
  title: string;
  sprite: string;
  isSelected: boolean;
  alreadySet: boolean;
  eligibleSlugs: string[];
}

const hasNarrowing = computed(
  () => state.region !== "" || state.search.trim() !== "" || state.caught !== "all" || Object.keys(state.fieldFilters).length > 0,
);

// ---- Candidate tiles: same tappable-tile language as the Dex grid and the
// species-detail form grid, instead of a checkbox-rows-under-a-species-card
// list. A tile here is one (species, form-group) pair — tapping it toggles
// selection for that group's eligible forms; the target field/value picked
// above still applies to every selected tile on Apply, unchanged.
const tileResult = computed<{ tiles: TileVM[]; eligibleVisibleSlugs: string[] }>(() => {
  const tiles: TileVM[] = [];
  const eligibleVisibleSlugs: string[] = [];
  if (!hasNarrowing.value) return { tiles, eligibleVisibleSlugs };

  const parsedSearch = parseSearchQuery(state.search);
  // Repository.listSpeciesSummaries's species-level "costume" match means
  // "has this species EVER had a costume" (the Dex grid's species-browsing
  // sense — negated, that means "species with zero costume history"). Bulk
  // Edit's tiles are per-form, not per-species: a species like Pikachu mixes
  // costume and non-costume forms, so gating "!costume" at the species level
  // would drop Pikachu (and every other costume-having species) entirely
  // instead of just hiding its costume tiles — the bug this worked around.
  // Skip the species-level search for this one case and let the per-tile
  // filter below (which already handles it correctly) do the real work.
  const skipSpeciesLevelSearch = parsedSearch.keyword === "costume" && parsedSearch.negate;
  // Repository.listSpeciesSummaries's "caught" filter means
  // personal.registered — species-wide "you've registered at least one
  // form" (see SpeciesSummary's doc comment in repository.ts), not this
  // specific form's own caught state. That's correct for the Dex grid
  // (species-level tiles), but Bulk Edit's tiles are per-form: passing
  // state.caught through here would filter at the wrong granularity (same
  // class of bug as the "!costume" search above and the field-filter bug
  // fixed in PR #32) — e.g. "Caught" would show every form of any registered
  // species, including forms that individually aren't caught, and
  // "Uncaught" would hide a genuinely-uncaught form whose species is
  // registered because a *different* form was caught. Always query "all"
  // here and apply the real per-form caught check below instead.
  const summaries = props.repo.listSpeciesSummaries({
    region: state.region || undefined,
    search: skipSpeciesLevelSearch ? undefined : state.search || undefined,
    fieldFilters: state.fieldFilters,
  });

  for (const { species } of summaries) {
    const { forms } = props.repo.getSpeciesWithForms(species.slug);
    const personalBySlug = new Map(forms.map((f) => [f.form.slug, f.personal]));
    const groups = groupForms(
      forms.map((f) => f.form),
      true,
    );

    for (const group of groups) {
      if (parsedSearch.keyword === "costume") {
        const isCostumeGroup = group.forms.some((f) => f.costumeName !== null);
        if (parsedSearch.negate ? isCostumeGroup : !isCostumeGroup) continue;
      }
      // Per-form Caught/Uncaught check — see the comment on the
      // listSpeciesSummaries call above for why this can't be done at the
      // species level. Same "some form in the group" semantics as the
      // field-filter check just below: "Caught" keeps a group if any of its
      // forms are caught, "Uncaught" keeps it if none are.
      if (!matchesCaughtFilter(state.caught, group.forms.map((form) => !!personalBySlug.get(form.slug)?.caught))) {
        continue;
      }
      // repo.listSpeciesSummaries's field filters (above) only narrow which
      // SPECIES appear — a species passes if ANY of its forms match, same
      // "any form" semantics the Dex grid's species-level badges use
      // correctly. Bulk Edit's tiles are per-form, so a species-level pass
      // would otherwise render every form of a matching species, not just
      // the form(s) that actually match (e.g. filtering "Lucky" showed all
      // of Bulbasaur, not just its lucky form). Species-level-only filters
      // (registered/rarity/mega-capable/etc.) are correctly left alone here
      // — they don't vary per form, so the species-level gate above is
      // already exactly right for them.
      if (
        Object.entries(state.fieldFilters).some(([field, want]) => {
          if (!(FORM_PERSONAL_BOOLEAN_FIELDS as readonly string[]).includes(field)) return false;
          const f = field as FormPersonalBooleanField;
          const matches = group.forms.some((form) => personalBySlug.get(form.slug)?.[f]);
          return want === "include" ? !matches : matches;
        })
      ) {
        continue;
      }
      const eligible = eligibleForms(group, availableWhen.value);
      if (eligible.length === 0) continue; // gated out (e.g. non-shadow form, Shadow field selected)
      const eligibleSlugs = eligible.map((f) => f.slug);
      for (const s of eligibleSlugs) eligibleVisibleSlugs.push(s);

      const isSelected = eligibleSlugs.every((s) => state.selectedForms.has(s));
      const alreadySet = eligibleSlugs.every((s) => personalBySlug.get(s)?.[state.targetField]);

      tiles.push({
        key: `${species.slug}:${group.key}`,
        label: `${species.name} · ${group.label}`,
        ariaLabel: `${species.name} ${group.label}, ${isSelected ? "selected" : "not selected"}`,
        title: `Current ${targetLabel.value}: ${alreadySet ? "on" : "off"}`,
        sprite: formSpritePath(group.forms[0].slug, species.dexNumber),
        isSelected,
        alreadySet,
        eligibleSlugs,
      });
    }
  }

  return { tiles, eligibleVisibleSlugs };
});

function toggleTile(tile: TileVM) {
  const nowSelected = !tile.eligibleSlugs.every((s) => state.selectedForms.has(s));
  if (nowSelected) for (const s of tile.eligibleSlugs) state.selectedForms.add(s);
  else for (const s of tile.eligibleSlugs) state.selectedForms.delete(s);
}

const allVisibleSelected = computed(
  () => tileResult.value.eligibleVisibleSlugs.length > 0 && tileResult.value.eligibleVisibleSlugs.every((s) => state.selectedForms.has(s)),
);

function toggleSelectAllVisible() {
  const { eligibleVisibleSlugs } = tileResult.value;
  if (allVisibleSelected.value) for (const s of eligibleVisibleSlugs) state.selectedForms.delete(s);
  else for (const s of eligibleVisibleSlugs) state.selectedForms.add(s);
}

const selectedCount = computed(() => state.selectedForms.size);

function applyBulk() {
  const slugs = [...state.selectedForms];
  if (slugs.length === 0) return;
  applying.value = true;
  void props.repo.bulkSetFormPersonalField(slugs, state.targetField, state.targetValue).then(() => {
    state.selectedForms.clear();
    applying.value = false;
  });
}

function clearSelection() {
  state.selectedForms.clear();
}
</script>

<template>
  <div class="bulk-form-edit">
    <h2 class="page-title">Bulk edit forms</h2>
    <p class="page-intro">Filter to the forms you want, pick one field to set, then apply it to everything you've checked.</p>

    <!-- Search bar + callable filter sheet (region / caught / field chips) -->
    <div class="header-search bulk-search-row">
      <input v-model="state.search" type="search" class="bulk-search search-input" placeholder="Search species or dex #…" aria-label="Search" />
      <button
        type="button"
        class="filter-icon-button"
        aria-haspopup="true"
        aria-label="Filters"
        :aria-expanded="String(state.filterSheetOpen)"
        @click="state.filterSheetOpen = !state.filterSheetOpen"
      >
        ▤<span v-if="activeFilterCount > 0" class="filter-icon-badge">{{ activeFilterCount }}</span>
      </button>
    </div>

    <div :class="['nav-scrim', { open: state.filterSheetOpen }]" @click="state.filterSheetOpen = false"></div>
    <div :class="['filter-sheet', { open: state.filterSheetOpen }]" :inert="state.filterSheetOpen ? undefined : ''">
      <h2 class="filter-sheet-title">Filters</h2>
      <details class="settings-details filter-legend">
        <summary>Legend</summary>
        <div v-for="field in MORE_FILTER_FIELDS" :key="field" class="help-row">
          <span class="help-badge">{{ gridFilterFieldLabel(field).badge }}</span>
          <span class="help-row-body">{{ gridFilterFieldLabel(field).full }}</span>
        </div>
      </details>

      <div class="bulk-filter-row">
        <select v-model="state.region" class="bulk-region-select" aria-label="Region">
          <option value="">All regions</option>
          <option v-for="region in regions" :key="region.slug" :value="region.slug">{{ region.name }}</option>
        </select>
      </div>

      <div class="filter-bar">
        <button
          v-for="opt in CAUGHT_OPTIONS"
          :key="opt.value"
          type="button"
          :class="['filter-chip', { 'filter-chip-active': state.caught === opt.value }]"
          :aria-pressed="String(state.caught === opt.value)"
          @click="state.caught = opt.value"
        >
          {{ opt.label }}
        </button>
      </div>

      <div class="filter-bar">
        <button
          v-for="field in MORE_FILTER_FIELDS"
          :key="field"
          type="button"
          :class="['filter-chip', fieldChipState(field).stateClass]"
          :title="fieldChipState(field).label.full"
          :aria-pressed="fieldChipState(field).current ? 'true' : 'false'"
          :aria-label="`${fieldChipState(field).label.full}: ${fieldChipState(field).stateWord}`"
          @click="cycleFieldFilter(field)"
        >
          {{ fieldChipState(field).label.badge }}{{ fieldChipState(field).suffix }}
        </button>
      </div>
    </div>

    <!-- Target field picker (grouped by section) + on/off -->
    <div class="bulk-target-bar">
      <span class="bulk-set-label">Set field</span>
      <select
        class="bulk-target-select"
        aria-label="Field to set"
        :value="state.targetField"
        @change="onTargetFieldChange(($event.target as HTMLSelectElement).value as FormPersonalBooleanField)"
      >
        <optgroup v-for="group in FORM_FIELD_GROUPS" :key="group.title" :label="group.title">
          <option v-for="f in group.fields" :key="f.field" :value="f.field">{{ f.label }}</option>
        </optgroup>
      </select>
      <div class="bulk-onoff">
        <button
          type="button"
          :class="['filter-chip', { 'filter-chip-active': state.targetValue === true }]"
          :aria-pressed="String(state.targetValue === true)"
          @click="state.targetValue = true"
        >
          On
        </button>
        <button
          type="button"
          :class="['filter-chip', { 'filter-chip-active': state.targetValue === false }]"
          :aria-pressed="String(state.targetValue === false)"
          @click="state.targetValue = false"
        >
          Off
        </button>
      </div>
      <span v-if="availableWhen" class="bulk-gating-note">Only {{ targetGroup.title }}-available forms are shown.</span>
    </div>

    <!-- Candidate grid -->
    <div v-if="tileResult.eligibleVisibleSlugs.length > 0" class="bulk-selection-bar">
      <button type="button" class="filter-chip" @click="toggleSelectAllVisible">
        {{ allVisibleSelected ? "Deselect visible" : "Select visible" }}
      </button>
    </div>

    <div class="form-grid">
      <p v-if="!hasNarrowing" class="empty-state">Pick a region, search, or filter above to list forms.</p>
      <p v-else-if="tileResult.tiles.length === 0" class="empty-state">No forms match those filters.</p>
      <button
        v-for="tile in tileResult.tiles"
        :key="tile.key"
        type="button"
        :class="['form-tile', { selected: tile.isSelected }]"
        :aria-pressed="String(tile.isSelected)"
        :aria-label="tile.ariaLabel"
        :title="tile.title"
        @click="toggleTile(tile)"
      >
        <span v-if="tile.alreadySet" class="form-tile-more">✓</span>
        <img class="form-tile-sprite" :src="tile.sprite" alt="" loading="lazy" />
        <div class="form-tile-name">{{ tile.label }}</div>
      </button>
    </div>

    <!-- Apply bar -->
    <div class="bulk-action-bar bulk-apply-bar">
      <span class="bulk-count">{{ selectedCount }} form{{ selectedCount === 1 ? "" : "s" }} selected</span>
      <button type="button" class="bulk-apply-button" :disabled="selectedCount === 0 || applying" @click="applyBulk">
        {{ applying ? "Applying…" : `Apply "${targetLabel}" ${state.targetValue ? "On" : "Off"} to ${selectedCount} selected form${selectedCount === 1 ? "" : "s"}` }}
      </button>
      <button type="button" class="bulk-clear-button" :disabled="selectedCount === 0" @click="clearSelection">Clear selection</button>
    </div>
  </div>
</template>
