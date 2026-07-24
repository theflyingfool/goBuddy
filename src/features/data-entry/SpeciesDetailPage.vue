<!--
  Species detail — Tracking tab (Vue port of species-detail.ts). Info tab is
  a placeholder here; Task 5 fills it in (see docs/vue-migration-plan.md).

  Behavior is a straight port of the vanilla page: every write goes through
  the same Repository methods species-detail.ts used (setSpeciesPersonalField/
  setFormPersonalField/setMegaPersonalField), and cascade behavior (e.g. 4-star
  implies Caught) is entirely the repository's doing (src/db/cascades.ts's
  resolveFormFieldCascade, applied inside src/data/in-memory-store.ts) — this
  component never computes a cascade itself. Instead of the vanilla version's
  hand-patched DOM (refreshTile/refreshMegaRow/patchRegisteredIfChanged), every
  write re-fetches fresh state from the repo and Vue's reactivity does the
  rest, which sees the same cascaded facts the vanilla patches were chasing.
-->
<script lang="ts">
// Real module scope (a plain, non-`setup` <script> block) rather than a
// `const` at the top of <script setup> — <script setup> compiles into the
// component's setup(), which reruns on every mount, so a `const` declared
// there is per-instance, not shared. Every route navigation fully remounts
// this component (mountVueRoute always unmounts+recreates, per main.ts), so
// a real module-level singleton is required to preserve this per-species UI
// state (expand-in-place, filter text, missing-only, shiny view, tab) across
// a round trip to a different species and back — same reasoning, and same
// fix, as BulkFormEditPanel.vue's module-level bulkFormEditState.
export const expandedGroupKeysBySpecies = new Map<string, Set<string>>();
export const formFilterBySpecies = new Map<string, string>();
export const missingOnlyBySpecies = new Map<string, boolean>();
export const shinyViewBySpecies = new Map<string, boolean>();
export const infoViewBySpecies = new Map<string, boolean>();
</script>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { navigate, speciesDetailPath } from "../../app-shell/router";
import { fuzzyMatches, parseSearchQuery, type PokemonInstanceWithSpecies, type Repository } from "../../data/repository";
import type { FormPersonal, FormPersonalBooleanField, MegaPersonal, MegaVariant } from "../../db/types";
import { formSpritePath, megaSpritePath, speciesSpritePath } from "../../ui/sprites";
import { FORM_FIELD_GROUPS, SPECIES_FIELDS } from "./field-groups";
import { INDICATOR_LABELS, getFormGridSecondField } from "./indicator-labels";
import { COLLAPSE_GENDER_FORMS_SETTING_KEY, groupForms, megaVariantLabel, type FormGroup } from "./species-detail-shared";

const props = defineProps<{ repo: Repository; speciesSlug: string; onBack: () => void }>();

const detail = ref(props.repo.getSpeciesWithForms(props.speciesSlug));
const megaVariants = ref(props.repo.getMegaVariantsForSpecies(props.speciesSlug));
const collapseGender = computed(() => props.repo.getAppSetting(COLLAPSE_GENDER_FORMS_SETTING_KEY) === "1");
const adjacent = computed(() => props.repo.getAdjacentSpecies(props.speciesSlug));
const secondField = computed<FormPersonalBooleanField>(() => getFormGridSecondField(props.repo));

function refresh() {
  detail.value = props.repo.getSpeciesWithForms(props.speciesSlug);
  megaVariants.value = props.repo.getMegaVariantsForSpecies(props.speciesSlug);
}

const shinyView = ref(shinyViewBySpecies.get(props.speciesSlug) ?? false);
watch(shinyView, (v) => shinyViewBySpecies.set(props.speciesSlug, v));

const infoView = ref(infoViewBySpecies.get(props.speciesSlug) ?? false);
watch(infoView, (v) => infoViewBySpecies.set(props.speciesSlug, v));

const filterText = ref(formFilterBySpecies.get(props.speciesSlug) ?? "");
watch(filterText, (v) => formFilterBySpecies.set(props.speciesSlug, v));

const missingOnly = ref(missingOnlyBySpecies.get(props.speciesSlug) ?? false);
watch(missingOnly, (v) => missingOnlyBySpecies.set(props.speciesSlug, v));

const expandedKeys = ref<Set<string>>(new Set(expandedGroupKeysBySpecies.get(props.speciesSlug) ?? []));
watch(expandedKeys, (v) => expandedGroupKeysBySpecies.set(props.speciesSlug, v));
function toggleExpanded(key: string) {
  const next = new Set(expandedKeys.value);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  expandedKeys.value = next;
}

const groups = computed<FormGroup[]>(() => groupForms(detail.value.forms.map((f) => f.form), collapseGender.value));
const formPersonalBySlug = computed(() => new Map<string, FormPersonal>(detail.value.forms.map((f) => [f.form.slug, f.personal])));

function groupFieldAllTrue(group: FormGroup, field: FormPersonalBooleanField): boolean {
  const map = formPersonalBySlug.value;
  return group.forms.every((f) => map.get(f.slug)?.[field]);
}

const parsedFilter = computed(() => parseSearchQuery(filterText.value));
function matchesFilter(group: FormGroup): boolean {
  const pf = parsedFilter.value;
  if (pf.keyword === "costume") {
    const isCostumeGroup = group.forms.some((f) => f.costumeName !== null);
    return pf.negate ? !isCostumeGroup : isCostumeGroup;
  }
  return fuzzyMatches(group.label, pf.text);
}

const visibleGroups = computed(() =>
  groups.value.filter(matchesFilter).filter((g) => !missingOnly.value || !groupFieldAllTrue(g, "caught")),
);

function domId(key: string): string {
  return `form-group-${key.replace(/[^a-zA-Z0-9_-]+/g, "-")}`;
}

function setFormFieldForGroup(group: FormGroup, field: FormPersonalBooleanField, value: boolean) {
  for (const form of group.forms) props.repo.setFormPersonalField(form.slug, field, value);
  refresh();
}

function setSpeciesField(field: (typeof SPECIES_FIELDS)[number]["field"], value: boolean) {
  props.repo.setSpeciesPersonalField(props.speciesSlug, field, value);
  refresh();
}

function setMegaField(variantSlug: string, field: keyof Omit<MegaPersonal, "megaVariantSlug">, value: boolean) {
  props.repo.setMegaPersonalField(variantSlug, field, value);
  refresh();
}

// Region is species-wide; types are per-form (a handful of species like
// Tauros's breeds differ), so this reads the first form as the species'
// representative typing rather than inventing a "default form" concept —
// same convention as species-detail.ts.
const region = computed(() => props.repo.listRegions().find((r) => r.slug === detail.value.species.regionSlug));
const representativeFormSlug = computed(() => detail.value.forms[0]?.form.slug);
const types = computed(() => (representativeFormSlug.value ? props.repo.getFormTypes(representativeFormSlug.value) : []));

// Info tab — CP calculator and Pokédex flavor text are deliberately NOT here:
// neither base stats nor flavor text exist anywhere in the ingested reference
// data (confirmed while scoping the Vue migration — see
// docs/vue-migration-plan.md), and fabricating either would be inventing real
// Pokémon GO facts rather than showing real data. Type matchups ARE real
// (type_effectiveness), so those are shown.
const matchups = computed(() => (representativeFormSlug.value ? props.repo.getTypeMatchups(representativeFormSlug.value) : []));
const weakTo = computed(() => matchups.value.filter((m) => m.multiplier > 1).sort((a, b) => b.multiplier - a.multiplier));
const resists = computed(() => matchups.value.filter((m) => m.multiplier < 1).sort((a, b) => a.multiplier - b.multiplier));

// Individuals ("specimens") logged for this species via Log a catch —
// Repository has no species-scoped instance query, so this reuses the same
// listPokemonInstances() the Collection page calls and filters client-side,
// rather than adding a new Repository method for one page.
const specimens = ref<PokemonInstanceWithSpecies[]>(
  props.repo.listPokemonInstances().filter((i) => i.species.slug === props.speciesSlug),
);

function goToLogCatch() {
  navigate(`/log-catch?species=${encodeURIComponent(props.speciesSlug)}`);
}
</script>

<template>
  <div class="detail-header">
    <div class="detail-header-identity">
      <button type="button" class="back-button" @click="props.onBack">← Back</button>
      <button
        type="button"
        class="nav-chevron"
        :disabled="!adjacent.prev"
        @click="adjacent.prev && navigate(speciesDetailPath(adjacent.prev.slug))"
      >
        ‹
      </button>
      <div class="detail-hero-sprite-wrap">
        <img class="detail-hero-sprite" :src="speciesSpritePath(detail.species.dexNumber, shinyView)" alt="" loading="lazy" />
        <button
          type="button"
          :class="['shiny-view-toggle', { on: shinyView }]"
          :aria-pressed="String(shinyView)"
          :aria-label="`Show shiny art: ${shinyView ? 'on' : 'off'}`"
          title="View shiny art"
          @click="shinyView = !shinyView"
        >
          ✨
        </button>
      </div>
      <h2><span class="dex-num">#{{ detail.species.dexNumber }}</span> {{ detail.species.name }}</h2>
      <button
        type="button"
        class="nav-chevron"
        :disabled="!adjacent.next"
        @click="adjacent.next && navigate(speciesDetailPath(adjacent.next.slug))"
      >
        ›
      </button>
    </div>
    <div class="detail-header-info">
      <div class="detail-header-info-row">
        <span class="detail-header-info-label">Region</span>
        <span>{{ region?.name ?? "—" }}</span>
      </div>
      <div class="detail-header-info-row">
        <span class="detail-header-info-label">{{ types.length > 1 ? "Types" : "Type" }}</span>
        <span class="detail-header-types">
          <span v-if="types.length === 0">—</span>
          <span v-else v-for="t in types" :key="t.slug" class="type-chip">{{ t.name }}</span>
        </span>
      </div>
    </div>
  </div>

  <div class="species-view-segmented">
    <button type="button" :class="['species-view-tab', { active: !infoView }]" @click="infoView = false">Tracking</button>
    <button type="button" :class="['species-view-tab', { active: infoView }]" @click="infoView = true">Info</button>
  </div>

  <div v-if="infoView" class="species-info-panel">
    <fieldset>
      <legend>Type matchups</legend>
      <div class="matchup-grid">
        <span v-if="weakTo.length === 0 && resists.length === 0" class="gap-note">No type data for this form.</span>
        <span v-for="m in weakTo" :key="`weak-${m.attackingType.slug}`" class="matchup-chip matchup-weak">
          Weak: {{ m.attackingType.name }} ×{{ m.multiplier }}
        </span>
        <span v-for="m in resists" :key="`resist-${m.attackingType.slug}`" class="matchup-chip matchup-resist">
          Resists: {{ m.attackingType.name }} ×{{ m.multiplier }}
        </span>
      </div>
    </fieldset>
    <fieldset>
      <legend>Pokédex entry</legend>
      <p class="gap-note">Not available yet — flavor text isn't in the current reference data.</p>
    </fieldset>
    <fieldset>
      <legend>CP calculator</legend>
      <p class="gap-note">Not available yet — base stats aren't in the current reference data (see docs/vue-migration-plan.md).</p>
    </fieldset>
  </div>

  <template v-else>
    <button type="button" class="fab" @click="goToLogCatch">+ Log a catch</button>

    <fieldset>
      <legend>Species</legend>
      <label v-for="{ field, label } in SPECIES_FIELDS" :key="field" class="toggle-row">
        <input type="checkbox" :checked="detail.personal[field]" @change="setSpeciesField(field, ($event.target as HTMLInputElement).checked)" />
        <span>{{ label }}</span>
      </label>
    </fieldset>

    <fieldset v-if="megaVariants.length > 0">
      <legend>Mega</legend>
      <div v-for="{ variant, personal: mp } in megaVariants" :key="variant.slug" class="mega-variant-row">
        <img class="mega-variant-sprite" :src="megaSpritePath(variant.slug, detail.species.dexNumber, shinyView)" alt="" loading="lazy" />
        <span class="mega-variant-label">{{ megaVariantLabel(variant.variant) }}</span>
        <label class="toggle-row">
          <input type="checkbox" :checked="mp.evolved" @change="setMegaField(variant.slug, 'evolved', ($event.target as HTMLInputElement).checked)" />
          <span>Evolved</span>
        </label>
        <label class="toggle-row">
          <input
            type="checkbox"
            :checked="mp.shinyEvolved"
            @change="setMegaField(variant.slug, 'shinyEvolved', ($event.target as HTMLInputElement).checked)"
          />
          <span>Shiny Evolved</span>
        </label>
      </div>
    </fieldset>

    <div class="form-toolbar">
      <input
        type="search"
        class="search-input form-filter-input"
        :placeholder="`Search ${groups.length} forms…`"
        v-model="filterText"
        aria-label="Filter forms by name"
      />
      <button type="button" :class="['missing-chip', { on: missingOnly }]" :aria-pressed="String(missingOnly)" @click="missingOnly = !missingOnly">
        Missing only{{ missingOnly ? " ✓" : "" }}
      </button>
    </div>

    <div class="form-grid">
      <p v-if="visibleGroups.length === 0" class="empty-state">No forms match that filter.</p>
      <template v-for="group in visibleGroups" :key="group.key">
        <div
          :class="['form-tile', { 'active-tile': expandedKeys.has(group.key) }]"
          role="button"
          tabindex="0"
          :aria-expanded="String(expandedKeys.has(group.key))"
          :aria-label="`${group.label}, ${expandedKeys.has(group.key) ? 'collapse' : 'expand'}`"
          @click="toggleExpanded(group.key)"
          @keydown.enter.prevent="toggleExpanded(group.key)"
          @keydown.space.prevent="toggleExpanded(group.key)"
        >
          <span class="form-tile-more">⋯</span>
          <img class="form-tile-sprite" :src="formSpritePath(group.forms[0].slug, detail.species.dexNumber, shinyView)" alt="" loading="lazy" />
          <div class="form-tile-name">{{ group.label }}</div>
          <div class="form-tile-icons">
            <button
              type="button"
              :class="['form-mini-toggle', { on: groupFieldAllTrue(group, 'caught') }]"
              :aria-pressed="String(groupFieldAllTrue(group, 'caught'))"
              :aria-label="`Caught: ${groupFieldAllTrue(group, 'caught') ? 'on' : 'off'}`"
              @click.stop="setFormFieldForGroup(group, 'caught', !groupFieldAllTrue(group, 'caught'))"
            >
              {{ INDICATOR_LABELS.caught.badge }}
            </button>
            <button
              type="button"
              :class="['form-mini-toggle', { on: groupFieldAllTrue(group, secondField) }]"
              :aria-pressed="String(groupFieldAllTrue(group, secondField))"
              :aria-label="`${INDICATOR_LABELS[secondField].full}: ${groupFieldAllTrue(group, secondField) ? 'on' : 'off'}`"
              @click.stop="setFormFieldForGroup(group, secondField, !groupFieldAllTrue(group, secondField))"
            >
              {{ INDICATOR_LABELS[secondField].badge }}
            </button>
          </div>
        </div>
        <div v-if="expandedKeys.has(group.key)" class="form-expanded-panel" :id="domId(group.key)">
          <div class="form-expanded-title">{{ group.label }}</div>
          <template v-for="fg in FORM_FIELD_GROUPS" :key="fg.title">
            <fieldset v-if="!fg.availableWhen || group.forms.some(fg.availableWhen)">
              <legend>{{ fg.title }}</legend>
              <label v-for="{ field, label } in fg.fields" :key="field" class="toggle-row">
                <input
                  type="checkbox"
                  :checked="groupFieldAllTrue(group, field)"
                  @change="setFormFieldForGroup(group, field, ($event.target as HTMLInputElement).checked)"
                />
                <span>{{ label }}</span>
              </label>
            </fieldset>
          </template>
        </div>
      </template>
    </div>

    <div class="specimens-strip">
      <h3>Individuals ({{ specimens.length }})</h3>
      <p v-if="specimens.length === 0" class="gap-note">No individuals logged for this species yet — use Log a catch above.</p>
      <ul v-else class="collection-list">
        <li v-for="s in specimens" :key="s.instance.id" class="collection-row">
          <div class="collection-row-main">
            <img class="collection-sprite" :src="formSpritePath(s.form.slug, s.species.dexNumber, s.instance.shiny)" alt="" />
            <span class="collection-name">{{ s.instance.nickname || s.species.name }}</span>
            <span v-if="s.instance.status !== 'kept'" :class="['status-pill', s.instance.status]">{{ s.instance.status }}</span>
            <span class="collection-stats tabular" v-if="s.instance.cp !== null || s.instance.ivPercent !== null">
              <template v-if="s.instance.cp !== null">CP {{ s.instance.cp }}</template>
              <template v-if="s.instance.ivPercent !== null">{{ s.instance.cp !== null ? " · " : "" }}{{ s.instance.ivPercent }}% IV</template>
            </span>
            <span class="collection-tags" v-if="s.tags.length">
              <span v-for="tag in s.tags" :key="tag.id" class="mini-tag">{{ tag.name }}</span>
            </span>
          </div>
        </li>
      </ul>
    </div>
  </template>
</template>
