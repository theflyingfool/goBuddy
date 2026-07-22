<!--
  Trainer/Profile page — profile identity, level/XP (player_progress_personal,
  already modeled), and per-medal progress (medal_progress_personal, new this
  pass — see docs/vue-migration-plan.md). Friendship/buddy tracking is
  explicitly NOT here: that's the separate "Best Buddy Tracker" roadmap item,
  and there's no current-buddy concept anywhere yet to build on.
-->
<script setup lang="ts">
import { computed, ref } from "vue";
import type { Repository } from "../../data/repository";

const props = defineProps<{ repo: Repository }>();

const profile = ref(props.repo.getProfile());
const usernameInput = ref(profile.value.username);
const friendCodeInput = ref(profile.value.friendCode ?? "");
function saveProfile() {
  props.repo.setProfile(usernameInput.value.trim() || "Trainer", friendCodeInput.value.trim() || null);
  profile.value = props.repo.getProfile();
}

const progress = ref(props.repo.getPlayerProgress());
const levelInput = ref(progress.value?.currentLevel ?? "");
const xpInput = ref(progress.value?.totalXp ?? "");

function saveProgress() {
  const level = levelInput.value === "" ? null : Number(levelInput.value);
  const xp = xpInput.value === "" ? null : Number(xpInput.value);
  props.repo.setPlayerProgress(level, xp);
  progress.value = props.repo.getPlayerProgress();
}

const medalProgress = ref(props.repo.listMedalProgress());
// Sort event medals last, then alphabetically — event medals are one-off
// completion badges, standard medals are the ones worth seeing progress on
// first.
const sortedMedals = computed(() =>
  [...medalProgress.value].sort((a, b) => {
    if (a.medal.isEventMedal !== b.medal.isEventMedal) return a.medal.isEventMedal ? 1 : -1;
    return a.medal.name.localeCompare(b.medal.name);
  }),
);

function nextTarget(tiers: { rank: number; target: number | null }[], currentRank: number): number | null {
  const next = tiers.find((t) => t.rank === currentRank + 1);
  return next ? next.target : null;
}

function updateCount(medalSlug: string, tiers: { rank: number; target: number | null }[], currentRank: number, count: number) {
  // Advance rank automatically once the count clears the next tier's
  // target — mirrors how the game itself promotes a medal's tier the
  // instant its threshold is crossed, not on a separate manual step.
  let rank = currentRank;
  for (const tier of [...tiers].sort((a, b) => a.rank - b.rank)) {
    if (tier.target !== null && count >= tier.target) rank = tier.rank;
  }
  props.repo.setMedalProgress(medalSlug, rank, count);
  medalProgress.value = props.repo.listMedalProgress();
}
</script>

<template>
  <h2>Trainer</h2>

  <fieldset>
    <legend>Identity</legend>
    <div class="input-grid">
      <label class="field">
        Trainer name
        <input type="text" maxlength="20" v-model="usernameInput" @change="saveProfile" />
      </label>
      <label class="field">
        Friend code
        <input type="text" placeholder="0000 0000 0000" v-model="friendCodeInput" @change="saveProfile" />
      </label>
    </div>
  </fieldset>

  <fieldset>
    <legend>Level &amp; XP</legend>
    <div class="input-grid">
      <label class="field">
        Level
        <input type="number" min="1" max="50" v-model="levelInput" @change="saveProgress" />
      </label>
      <label class="field">
        Total XP
        <input type="number" min="0" v-model="xpInput" @change="saveProgress" />
      </label>
    </div>
  </fieldset>

  <fieldset>
    <legend>Medals ({{ sortedMedals.filter((m) => m.progress.currentCount > 0).length }} / {{ sortedMedals.length }} started)</legend>
    <div v-for="entry in sortedMedals" :key="entry.medal.slug" class="medal-row">
      <div class="medal-head">
        <strong>{{ entry.medal.name }}</strong>
        <span class="gap-note">{{ entry.medal.description }}</span>
      </div>
      <div class="medal-progress">
        <label>
          Count
          <input
            type="number"
            min="0"
            :value="entry.progress.currentCount"
            @change="updateCount(entry.medal.slug, entry.tiers, entry.progress.currentRank, Number(($event.target as HTMLInputElement).value))"
          />
        </label>
        <span class="gap-note" v-if="nextTarget(entry.tiers, entry.progress.currentRank) !== null">
          Tier {{ entry.progress.currentRank }} → next at {{ nextTarget(entry.tiers, entry.progress.currentRank) }}
        </span>
        <span class="gap-note" v-else-if="entry.progress.currentRank > 0"> Tier {{ entry.progress.currentRank }} (max) </span>
      </div>
    </div>
  </fieldset>
</template>

<!-- .medal-row/.medal-head/.medal-progress are styled globally in src/style.css. -->
