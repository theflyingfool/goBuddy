<!--
  Stats page — the existing region/lens completion table (renderStatsPage,
  unchanged, mounted directly rather than rewritten: it's a large, tested,
  drill-down-heavy piece and rewriting it in Vue in the same pass as
  everything else risked more than it was worth, see docs/vue-migration-plan.md)
  plus two new charts the per-specimen schema makes possible: specimens by
  state, and top tags.
-->
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import type { CompletionLens, Repository } from "../../data/repository";
import type { PlayerProgressLogEntry } from "../../db/types";
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
const totalSpecimens = props.repo.countPokemonInstances();
const medals = props.repo.listMedalProgress();
const medalsStarted = medals.filter((m) => m.progress.currentCount > 0).length;
// Sorted by rank first (highest tier earns top billing), then by count —
// the "brag sheet" a trainer would actually want to see first.
const topMedals = [...medals]
  .filter((m) => m.progress.currentCount > 0)
  .sort((a, b) => b.progress.currentRank - a.progress.currentRank || b.progress.currentCount - a.progress.currentCount)
  .slice(0, 6);

const progressLog = props.repo.listPlayerProgressLog();
function hasXp(entry: PlayerProgressLogEntry): entry is PlayerProgressLogEntry & { totalXp: number } {
  return entry.totalXp !== null;
}
const xpPoints = computed(() => progressLog.filter(hasXp));

// Plain inline SVG line chart, no charting dependency — normalizes each
// point's totalXp/recordedAt into a 0..CHART_W/CHART_H viewBox.
const CHART_W = 300;
const CHART_H = 80;
const xpPath = computed(() => {
  const points = xpPoints.value;
  if (points.length < 2) return "";
  const minXp = Math.min(...points.map((p) => p.totalXp));
  const maxXp = Math.max(...points.map((p) => p.totalXp));
  const span = Math.max(1, maxXp - minXp);
  return points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * CHART_W;
      const y = CHART_H - ((p.totalXp - minXp) / span) * CHART_H;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
});

const LENS_LIST: { lens: CompletionLens; label: string }[] = [
  { lens: { kind: "registered" }, label: "Registered" },
  { lens: { kind: "formComplete" }, label: "Form-complete" },
  { lens: { kind: "costumeComplete" }, label: "Costume-complete" },
  { lens: { kind: "gigantamaxComplete" }, label: "Gigantamax-complete" },
  { lens: { kind: "megaComplete" }, label: "Mega-complete" },
];
const lensResults = ref<{ label: string; complete: number; total: number }[]>([]);
onMounted(async () => {
  const results = await props.repo.getCompletionStats(
    { kind: "global" },
    LENS_LIST.map((l) => l.lens),
  );
  lensResults.value = results.map((r, i) => ({ label: LENS_LIST[i].label, complete: r.complete, total: r.total }));
});

const stateCounts = props.repo.getSpecimenStateCounts();
const topTags = props.repo.getTopTagCounts();
const maxTagCount = Math.max(1, ...topTags.map((t) => t.count));
const maxStateCount = Math.max(1, stateCounts.shiny, stateCounts.lucky, stateCounts.shadow, stateCounts.purified);
</script>

<template>
  <div class="stats-kpi-row" v-if="progress">
    <div class="stats-kpi-card">
      <div class="stats-kpi-label">Trainer level</div>
      <div class="stats-kpi-value">{{ progress.currentLevel ?? "—" }}</div>
    </div>
    <div class="stats-kpi-card">
      <div class="stats-kpi-label">Specimens logged</div>
      <div class="stats-kpi-value">{{ totalSpecimens.toLocaleString() }}</div>
    </div>
    <div class="stats-kpi-card">
      <div class="stats-kpi-label">Medals started</div>
      <div class="stats-kpi-value">{{ medalsStarted }} / {{ medals.length }}</div>
    </div>
  </div>

  <div class="chart-card" v-if="lensResults.length">
    <div class="ctitle">Completion by lens</div>
    <div class="hbar-row" v-for="entry in lensResults" :key="entry.label">
      <span>{{ entry.label }}</span>
      <div class="hbar-track"><div class="hbar-fill" :style="{ width: (entry.total ? (entry.complete / entry.total) * 100 : 0) + '%' }"></div></div>
      <span class="hbar-val">{{ entry.complete }} / {{ entry.total }}</span>
    </div>
  </div>

  <div class="chart-card xp-card" v-if="progress && (progress.currentLevel !== null || progress.totalXp !== null)">
    <div class="xp-top">
      <span v-if="progress.currentLevel !== null">Trainer level {{ progress.currentLevel }}</span>
      <b class="tabular" v-if="progress.totalXp !== null">{{ progress.totalXp.toLocaleString() }} XP</b>
    </div>
    <svg v-if="xpPath" :viewBox="`0 0 ${CHART_W} ${CHART_H}`" preserveAspectRatio="none" class="xp-sparkline">
      <path :d="xpPath" fill="none" stroke="var(--accent)" stroke-width="2" vector-effect="non-scaling-stroke" />
    </svg>
    <p class="gap-note" v-else>
      Every time you update your level/XP on the Trainer page, it's logged with a timestamp — update it a few times and a chart of how fast you're gaining XP shows up here.
    </p>
  </div>

  <div class="chart-card" v-if="topMedals.length">
    <div class="ctitle">Top medals</div>
    <div class="hbar-row" v-for="entry in topMedals" :key="entry.medal.slug">
      <span>{{ entry.medal.name }}</span>
      <div class="hbar-track"><div class="hbar-fill" :style="{ width: Math.min(100, (entry.progress.currentRank / Math.max(1, entry.tiers.length)) * 100) + '%' }"></div></div>
      <span class="hbar-val">{{ entry.progress.currentCount }}</span>
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
