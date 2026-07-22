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

// Level-to-next-level XP thresholds aren't exposed on Repository yet (that's
// a real ingestion-data read, not something to fabricate) — this card shows
// what's actually known (current level + total XP) rather than a guessed
// progress bar toward the next level.
const progress = props.repo.getPlayerProgress();

const stateCounts = props.repo.getSpecimenStateCounts();
const topTags = props.repo.getTopTagCounts();
const maxTagCount = Math.max(1, ...topTags.map((t) => t.count));
const maxStateCount = Math.max(1, stateCounts.shiny, stateCounts.lucky, stateCounts.shadow, stateCounts.purified);
</script>

<template>
  <div class="chart-card xp-card" v-if="progress && (progress.currentLevel !== null || progress.totalXp !== null)">
    <div class="xp-top">
      <span v-if="progress.currentLevel !== null">Trainer level {{ progress.currentLevel }}</span>
      <b class="tabular" v-if="progress.totalXp !== null">{{ progress.totalXp.toLocaleString() }} XP</b>
    </div>
  </div>

  <div class="chart-card">
    <div class="ctitle">Specimens by state</div>
    <div class="hbar-row">
      <span>Shiny</span>
      <div class="hbar-track"><div class="hbar-fill" :style="{ width: (stateCounts.shiny / maxStateCount) * 100 + '%', background: 'var(--shiny)' }"></div></div>
      <span class="hbar-val">{{ stateCounts.shiny }}</span>
    </div>
    <div class="hbar-row">
      <span>Lucky</span>
      <div class="hbar-track"><div class="hbar-fill" :style="{ width: (stateCounts.lucky / maxStateCount) * 100 + '%', background: 'var(--lucky)' }"></div></div>
      <span class="hbar-val">{{ stateCounts.lucky }}</span>
    </div>
    <div class="hbar-row">
      <span>Shadow</span>
      <div class="hbar-track"><div class="hbar-fill" :style="{ width: (stateCounts.shadow / maxStateCount) * 100 + '%', background: 'var(--shadow)' }"></div></div>
      <span class="hbar-val">{{ stateCounts.shadow }}</span>
    </div>
    <div class="hbar-row">
      <span>Purified</span>
      <div class="hbar-track"><div class="hbar-fill" :style="{ width: (stateCounts.purified / maxStateCount) * 100 + '%', background: 'var(--purified)' }"></div></div>
      <span class="hbar-val">{{ stateCounts.purified }}</span>
    </div>
  </div>

  <div class="chart-card" v-if="topTags.length">
    <div class="ctitle">Top tags</div>
    <div class="hbar-row" v-for="entry in topTags" :key="entry.tag.id">
      <span>{{ entry.tag.name }}</span>
      <div class="hbar-track"><div class="hbar-fill" :style="{ width: (entry.count / maxTagCount) * 100 + '%' }"></div></div>
      <span class="hbar-val">{{ entry.count }}</span>
    </div>
  </div>

  <details class="settings-details">
    <summary>Full completion breakdown</summary>
    <div ref="hostEl"></div>
  </details>
</template>
