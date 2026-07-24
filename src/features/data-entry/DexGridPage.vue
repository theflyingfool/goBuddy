<!--
  Dex grid — core render (Vue port of species-grid.ts's renderSpeciesGrid,
  non-select-mode path only). Select-mode, the bulk-action bar, and the
  species/form granularity toggle are deliberately NOT ported here — that's
  Task 7 (see docs/vue-migration-plan.md). Tiles always navigate on click,
  matching today's `state.selectMode === false` behavior exactly; there is no
  UI in this component to turn select mode on (Task 7 adds the toolbar back).

  props.state is the same GridState object main.ts owns and mutates from the
  header search box / filter sheet (still vanilla TS, untouched by this
  task) — every callback-driven mutation calls the surrounding renderGrid()
  closure in main.ts, which re-invokes mountVueRoute() and so fully remounts
  this component with the freshly-mutated state. That means this component
  itself never needs to watch props.state for external changes; it just
  reads it once per mount, like every other prop here.
-->
<script setup lang="ts">
import { computed, ref } from "vue";
import type { Repository, SpeciesSummary } from "../../data/repository";
import { speciesSpritePath } from "../../ui/sprites";
import { INDICATOR_LABELS } from "./indicator-labels";
import type { GridCallbacks, GridState } from "./species-grid";

const props = defineProps<{ repo: Repository; state: GridState; callbacks: GridCallbacks }>();

interface RegionSection {
  slug: string;
  name: string;
  collapsed: boolean;
  summaries: SpeciesSummary[];
}

const indicatorSelection = computed(() => props.repo.getIndicatorSelection());

const sections = computed<RegionSection[]>(() => {
  const out: RegionSection[] = [];
  for (const region of props.repo.listRegions()) {
    const summaries = props.repo.listSpeciesSummaries({
      region: region.slug,
      search: props.state.filterText,
      caught: props.state.caughtFilter,
      fieldFilters: props.state.fieldFilters,
    });
    if (summaries.length === 0) continue;
    out.push({ slug: region.slug, name: region.name, collapsed: props.state.collapsedRegions.has(region.slug), summaries });
  }
  return out;
});

const anyResults = computed(() => sections.value.length > 0);

function badgesFor(summary: SpeciesSummary) {
  return indicatorSelection.value.filter((field) => summary.indicators[field]);
}

// Registered-toggle click patches this tile's own visual state in place
// instead of re-querying listSpeciesSummaries() — same tradeoff
// species-grid.ts's renderSpeciesGrid makes: if the current Caught/Uncaught
// filter would now exclude this tile, it stays visible (with its badge/class
// flipped) until the next full requery (a search/filter change or
// navigation), rather than paying for a requery on every tap.
const registeredOverrides = ref<Map<string, boolean>>(new Map());
function effectiveCaught(summary: SpeciesSummary): boolean {
  return registeredOverrides.value.get(summary.species.slug) ?? summary.caught;
}
function toggleRegistered(summary: SpeciesSummary) {
  const next = !effectiveCaught(summary);
  props.repo.setSpeciesPersonalField(summary.species.slug, "registered", next);
  const overrides = new Map(registeredOverrides.value);
  overrides.set(summary.species.slug, next);
  registeredOverrides.value = overrides;
}
</script>

<template>
  <div class="grid-select-toolbar"></div>

  <template v-for="section in sections" :key="section.slug">
    <button type="button" class="region-header" @click="props.callbacks.onToggleRegion(section.slug)">
      <span class="region-collapse-caret">{{ section.collapsed ? "▶" : "▼" }}</span>
      <span>{{ section.name }} ({{ section.summaries.length }})</span>
    </button>

    <div v-if="!section.collapsed" class="species-grid">
      <div v-for="summary in section.summaries" :key="summary.species.slug" class="species-tile-wrap">
        <button
          type="button"
          :class="['species-tile', { uncaught: !effectiveCaught(summary) }]"
          @click="props.callbacks.onSelectSpecies(summary.species.slug)"
        >
          <div class="badge-row">
            <span v-for="field in badgesFor(summary)" :key="field" class="badge" :title="INDICATOR_LABELS[field].full">
              {{ INDICATOR_LABELS[field].badge }}
            </span>
          </div>
          <img class="species-sprite" :src="speciesSpritePath(summary.species.dexNumber)" alt="" loading="lazy" />
        </button>
        <button
          type="button"
          :class="['registered-toggle', { on: effectiveCaught(summary) }]"
          :aria-pressed="String(effectiveCaught(summary))"
          :aria-label="`Registered: ${effectiveCaught(summary) ? 'on' : 'off'}`"
          @click.stop="toggleRegistered(summary)"
        >
          {{ effectiveCaught(summary) ? "✓" : "" }}
        </button>
        <div class="tile-label"><span class="dex-num">#{{ summary.species.dexNumber }}</span> {{ summary.species.name }}</div>
      </div>
    </div>
  </template>

  <p v-if="!anyResults" class="empty-state">No Pokémon match that search/filter.</p>
</template>
