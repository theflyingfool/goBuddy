<!--
  Vue port of the vanilla help-page.ts — Phase 0/1 migration
  (docs/vue-migration-plan.md). Pure static content, no Repository
  dependency; the badge-glyphs list is rendered with v-for over
  REPRESENTATIVE_BADGES instead of the vanilla file's manual loop, but
  every heading/paragraph/badge-row's text is preserved verbatim.
-->
<script setup lang="ts">
import { INDICATOR_LABELS } from "../data-entry/indicator-labels";
import type { FormPersonalBooleanField } from "../../db/types";

// A representative slice of INDICATOR_LABELS, not every combo (there are 30)
// — the combos all follow the same "prefix stacks with the base meaning"
// rule explained above the list, so listing every lucky/shadow/dynamax×
// floor/shundo/4★ permutation would just repeat that rule 30 times instead
// of explaining it once.
const REPRESENTATIVE_BADGES: { field: FormPersonalBooleanField; description: string }[] = [
  { field: "caught", description: "you own this form at all — every other badge implies this one." },
  { field: "shiny", description: "caught a shiny individual of this form." },
  { field: "floor", description: "caught one at the worst possible IVs for a normal catch (see the glossary below)." },
  { field: "fourStar", description: "caught one rated 4-star on appraisal." },
  { field: "shundo", description: "caught a shiny that's also 100% IV — see the glossary below." },
  { field: "lucky", description: "traded this form into a Lucky Pokémon." },
  { field: "shadow", description: "caught/obtained this form as Shadow." },
  { field: "dynamax", description: "this form has Dynamaxed at least once." },
  { field: "luckyShundo", description: "a Lucky individual that's also a Shundo — every prefix/base combo stacks the same way." },
  { field: "shadowFloor", description: "a Shadow individual at Shadow's own IV floor (usually 0/0/0, occasionally raised for some raid-sourced Shadows)." },
];
</script>

<template>
  <h2>Help</h2>

  <fieldset>
    <legend>Badge glyphs</legend>
    <p class="help-intro">
      Badges combine: a prefix (🍀 Lucky / ☾ Shadow / D Dynamaxed) stacks with a base achievement (✨ Shiny, 0 Floor IV, ★ 4★, 💎 Shundo) to mean "this Lucky/Shadow/Dynamaxed individual also hit that achievement." A few examples:
    </p>
    <div v-for="{ field, description } in REPRESENTATIVE_BADGES" :key="field" class="help-row">
      <span class="help-badge">{{ INDICATOR_LABELS[field].badge }}</span>
      <span class="help-row-body"><strong>{{ INDICATOR_LABELS[field].full }}</strong> — {{ description }}</span>
    </div>
  </fieldset>

  <fieldset>
    <legend>Stats lenses</legend>
    <div class="help-row">
      <span class="help-badge"></span>
      <span class="help-row-body"><strong>Registered</strong> — you've caught the species at all — one catch of any form counts.</span>
    </div>
    <div class="help-row">
      <span class="help-badge"></span>
      <span class="help-row-body"><strong>Form-complete</strong> — every non-costume, non-Gigantamax form of a species is caught. Regional-exclusive forms count unless you turn that off in Settings.</span>
    </div>
    <div class="help-row">
      <span class="help-badge"></span>
      <span class="help-row-body"><strong>Costume-complete</strong> — every costume form of a species is caught. Only species that have ever had a costume count toward the total — species with no costume don't drag the percentage down.</span>
    </div>
    <div class="help-row">
      <span class="help-badge"></span>
      <span class="help-row-body"><strong>Gigantamax-complete</strong> — every Gigantamax form of a species is caught. Same denominator rule as Costume-complete: only Gigantamax-capable species count.</span>
    </div>
    <div class="help-row">
      <span class="help-badge"></span>
      <span class="help-row-body"><strong>Mega-complete / Mega-shiny-complete</strong> — every Mega/Primal variant of a species has been Mega Evolved (or Shiny Mega Evolved) at least once. Charizard needs both X and Y, not just one.</span>
    </div>
  </fieldset>

  <fieldset>
    <legend>Floor / Shundo glossary</legend>
    <div class="help-row">
      <span class="help-badge">0</span>
      <span class="help-row-body"><strong>Floor IV</strong> — the lowest possible IVs for that catch type — 0/0/0 for a normal or Shadow catch, 12/12/12 for a Lucky catch (Lucky Pokémon are guaranteed at least 12 in every stat).</span>
    </div>
    <div class="help-row">
      <span class="help-badge">💎</span>
      <span class="help-row-body"><strong>Shundo</strong> — shiny + 100% IV ('hundo') on the same individual. Stored as its own fact, not inferred from the shiny and floor/4★ flags separately — catching a shiny and a hundo doesn't imply they were the same Pokémon.</span>
    </div>
    <div class="help-row">
      <span class="help-badge">★</span>
      <span class="help-row-body"><strong>4★</strong> — a 4-star Team Leader appraisal — this app's shorthand for a Pokémon whose IVs the in-game appraisal rates at the top tier.</span>
    </div>
  </fieldset>

  <fieldset>
    <legend>Filter chips</legend>
    <p class="help-intro">
      Every filter chip on the Dex grid is tri-state — tap to cycle: off → <strong>included ✓</strong> → <strong>excluded ✕</strong> → off. "Included" shows only species/forms matching that filter; "excluded" hides them.
    </p>
  </fieldset>

  <fieldset>
    <legend>Search box keywords</legend>
    <p class="help-intro">
      Beyond a species name or dex number, typing one of these words alone into a search box filters by it instead — put <strong>!</strong> in front to mean "not" (e.g. <strong>!costume</strong> for everything without one). Works in the Dex grid, Bulk Edit, and species-detail's own form search.
    </p>
    <div class="help-row">
      <span class="help-badge"></span>
      <span class="help-row-body"><strong>costume</strong> — has this species/form ever had a costume.</span>
    </div>
    <div class="help-row">
      <span class="help-badge"></span>
      <span class="help-row-body"><strong>legendary / mythical / ultrabeast</strong> — matches the species' rarity classification — same as the L/M/UB chips, just reachable from the search box too.</span>
    </div>
  </fieldset>
</template>
