<!--
  Stats page — the existing region/lens completion table (renderStatsPage,
  unchanged, mounted directly rather than rewritten: it's a large, tested,
  drill-down-heavy piece and rewriting it in Vue in the same pass as
  everything else risked more than it was worth, see docs/vue-migration-plan.md)
  plus two new charts the per-specimen schema makes possible: specimens by
  state, and top tags.
-->
<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import type { Repository } from "../../data/repository";
import { renderStatsPage } from "./stats-page";

const props = defineProps<{ repo: Repository }>();
const hostEl = ref<HTMLElement | null>(null);

onMounted(() => {
  if (hostEl.value) void renderStatsPage(hostEl.value, props.repo);
});
onUnmounted(() => {
  // renderStatsPage doesn't hold any resources beyond DOM nodes under
  // hostEl, which Vue tears down on its own when this component unmounts —
  // nothing further to clean up here.
});

const stateCounts = props.repo.getSpecimenStateCounts();
const topTags = props.repo.getTopTagCounts();
const maxTagCount = Math.max(1, ...topTags.map((t) => t.count));
const maxStateCount = Math.max(1, stateCounts.shiny, stateCounts.lucky, stateCounts.shadow, stateCounts.purified);
</script>

<template>
  <div ref="hostEl"></div>

  <fieldset>
    <legend>Specimens by state</legend>
    <div class="bar-row">
      <span>Shiny</span>
      <div class="bar-track"><div class="bar-fill" :style="{ width: (stateCounts.shiny / maxStateCount) * 100 + '%' }"></div></div>
      <span class="tabular">{{ stateCounts.shiny }}</span>
    </div>
    <div class="bar-row">
      <span>Lucky</span>
      <div class="bar-track"><div class="bar-fill" :style="{ width: (stateCounts.lucky / maxStateCount) * 100 + '%' }"></div></div>
      <span class="tabular">{{ stateCounts.lucky }}</span>
    </div>
    <div class="bar-row">
      <span>Shadow</span>
      <div class="bar-track"><div class="bar-fill" :style="{ width: (stateCounts.shadow / maxStateCount) * 100 + '%' }"></div></div>
      <span class="tabular">{{ stateCounts.shadow }}</span>
    </div>
    <div class="bar-row">
      <span>Purified</span>
      <div class="bar-track"><div class="bar-fill" :style="{ width: (stateCounts.purified / maxStateCount) * 100 + '%' }"></div></div>
      <span class="tabular">{{ stateCounts.purified }}</span>
    </div>
  </fieldset>

  <fieldset v-if="topTags.length">
    <legend>Top tags</legend>
    <div class="bar-row" v-for="entry in topTags" :key="entry.tag.id">
      <span>{{ entry.tag.name }}</span>
      <div class="bar-track"><div class="bar-fill" :style="{ width: (entry.count / maxTagCount) * 100 + '%' }"></div></div>
      <span class="tabular">{{ entry.count }}</span>
    </div>
  </fieldset>
</template>

<style scoped>
.bar-row {
  display: grid;
  grid-template-columns: 90px 1fr 40px;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  font-size: 0.85rem;
}
.bar-track {
  height: 10px;
  border-radius: 4px;
  background: var(--surface-2);
  overflow: hidden;
}
.bar-fill {
  height: 100%;
  background: var(--accent, #2a55d6);
}
</style>
