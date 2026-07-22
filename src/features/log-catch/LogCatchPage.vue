<!--
  Log a catch — Quick mode bulk-adds N identical specimens fast (the "I have
  30 random Pidgey" case pokemon_instance exists for, see schema.ts); Full
  details adds CP/IV/nickname/tags to a single catch. See
  docs/vue-migration-plan.md's Log-a-catch milestone.
-->
<script setup lang="ts">
import { computed, ref } from "vue";
import type { NewPokemonInstanceBatch, Repository } from "../../data/repository";
import type { Form, PokemonInstance, Species } from "../../db/types";

const props = defineProps<{ repo: Repository }>();

const mode = ref<"quick" | "full">("quick");

const speciesQuery = ref("");
const speciesResults = ref<Species[]>([]);
const selectedSpecies = ref<Species | null>(null);
const formsForSpecies = ref<Form[]>([]);
const selectedFormSlug = ref<string>("");

function searchSpecies() {
  speciesResults.value = props.repo.searchSpecies(speciesQuery.value);
}

function pickSpecies(species: Species) {
  selectedSpecies.value = species;
  speciesResults.value = [];
  speciesQuery.value = species.name;
  formsForSpecies.value = props.repo.getSpeciesWithForms(species.slug).forms.map((f) => f.form);
  selectedFormSlug.value = formsForSpecies.value[0]?.slug ?? "";
}

const shiny = ref(false);
const lucky = ref(false);
const shadow = ref(false);
const purified = ref(false);

const quantity = ref(1);
function setQuantity(n: number) {
  quantity.value = Math.max(1, Math.min(500, n));
}

const cp = ref<number | null>(null);
const ivPercent = ref<number | null>(null);
const nickname = ref("");
const caughtAt = ref(new Date().toISOString().slice(0, 10));

const tags = ref(props.repo.listTags());
const selectedTagIds = ref<Set<number>>(new Set());
const newTagName = ref("");

function toggleTag(id: number) {
  if (selectedTagIds.value.has(id)) selectedTagIds.value.delete(id);
  else selectedTagIds.value.add(id);
  // Set mutation doesn't trigger Vue's reactivity on its own — reassign.
  selectedTagIds.value = new Set(selectedTagIds.value);
}

async function addNewTag() {
  const name = newTagName.value.trim();
  if (!name) return;
  const tag = await props.repo.createTag(name);
  tags.value = props.repo.listTags();
  selectedTagIds.value = new Set([...selectedTagIds.value, tag.id]);
  newTagName.value = "";
}

const saveLabel = computed(() => {
  if (mode.value === "full") return "Save";
  const n = quantity.value;
  return `Log ${n} ${selectedSpecies.value?.name ?? "specimen"}${n > 1 ? "s" : ""}`;
});

const justLogged = ref<PokemonInstance[] | null>(null);
const saving = ref(false);
const saveError = ref("");

async function save() {
  if (!selectedFormSlug.value) {
    saveError.value = "Pick a species first.";
    return;
  }
  saveError.value = "";
  saving.value = true;
  try {
    const batch: NewPokemonInstanceBatch = {
      formSlug: selectedFormSlug.value,
      count: mode.value === "quick" ? quantity.value : 1,
      shiny: shiny.value,
      lucky: lucky.value,
      shadow: shadow.value,
      purified: purified.value,
      cp: mode.value === "full" ? cp.value : null,
      ivPercent: mode.value === "full" ? ivPercent.value : null,
      nickname: mode.value === "full" ? nickname.value || null : null,
      caughtAt: mode.value === "full" ? caughtAt.value : null,
      tagIds: mode.value === "full" ? [...selectedTagIds.value] : [],
    };
    justLogged.value = await props.repo.createPokemonInstances(batch);
  } catch (err) {
    saveError.value = `Save failed: ${(err as Error).message}`;
  } finally {
    saving.value = false;
  }
}

async function quickAction(id: number, status: "traded" | "evolved" | "released") {
  await props.repo.setPokemonInstanceStatus(id, status);
}
</script>

<template>
  <h2>Log a catch</h2>

  <div class="segmented">
    <button type="button" :class="{ active: mode === 'quick' }" @click="mode = 'quick'">Quick</button>
    <button type="button" :class="{ active: mode === 'full' }" @click="mode = 'full'">Full details</button>
  </div>
  <p class="gap-note">
    <template v-if="mode === 'quick'">Quick mode bulk-adds identical low-value catches fast — species, state, and how many.</template>
    <template v-else>Full details logs one specimen with CP, IV, nickname, tags, and caught date.</template>
  </p>

  <fieldset>
    <legend>Species</legend>
    <input class="search-input" type="search" placeholder="Search species…" v-model="speciesQuery" @input="searchSpecies" />
    <ul v-if="speciesResults.length" class="species-results">
      <li v-for="s in speciesResults" :key="s.slug">
        <button type="button" @click="pickSpecies(s)">#{{ s.dexNumber }} {{ s.name }}</button>
      </li>
    </ul>
    <label class="field" v-if="selectedSpecies">
      Form
      <select v-model="selectedFormSlug">
        <option v-for="f in formsForSpecies" :key="f.slug" :value="f.slug">{{ f.costumeName ?? f.formName }} ({{ f.gender }})</option>
      </select>
    </label>
  </fieldset>

  <fieldset>
    <legend>State (applies to {{ mode === "quick" ? "the whole batch" : "this catch" }})</legend>
    <label class="toggle-row"><input type="checkbox" v-model="shiny" /><span>Shiny</span></label>
    <label class="toggle-row"><input type="checkbox" v-model="lucky" /><span>Lucky</span></label>
    <label class="toggle-row"><input type="checkbox" v-model="shadow" /><span>Shadow</span></label>
    <label class="toggle-row"><input type="checkbox" v-model="purified" /><span>Purified</span></label>
  </fieldset>

  <fieldset v-if="mode === 'quick'">
    <legend>How many?</legend>
    <div class="qty-row">
      <button type="button" @click="setQuantity(quantity - 1)">−</button>
      <input type="number" min="1" max="500" v-model.number="quantity" />
      <button type="button" @click="setQuantity(quantity + 1)">+</button>
      <button type="button" v-for="n in [5, 10, 25, 50]" :key="n" @click="setQuantity(n)">{{ n }}</button>
    </div>
  </fieldset>

  <fieldset v-if="mode === 'full'">
    <legend>Details</legend>
    <div class="input-grid">
      <label class="field">CP<input type="number" v-model.number="cp" /></label>
      <label class="field">IV %<input type="number" v-model.number="ivPercent" /></label>
      <label class="field">Nickname<input type="text" v-model="nickname" /></label>
      <label class="field">Caught on<input type="date" v-model="caughtAt" /></label>
    </div>
  </fieldset>

  <fieldset v-if="mode === 'full'">
    <legend>Tags</legend>
    <div class="tag-picker">
      <button
        type="button"
        v-for="tag in tags"
        :key="tag.id"
        :class="['tag-chip', { on: selectedTagIds.has(tag.id) }]"
        @click="toggleTag(tag.id)"
      >
        {{ tag.name }}
      </button>
    </div>
    <div class="new-tag-row">
      <input type="text" placeholder="New tag…" v-model="newTagName" @keyup.enter="addNewTag" />
      <button type="button" @click="addNewTag">+ Add tag</button>
    </div>
  </fieldset>

  <p class="gap-note" v-if="saveError" style="color: var(--negative, crimson);">{{ saveError }}</p>
  <button type="button" class="save-button" :disabled="saving" @click="save">{{ saveLabel }}</button>

  <div v-if="justLogged" class="just-logged">
    <h3>Logged {{ justLogged.length }} specimen{{ justLogged.length === 1 ? "" : "s" }}</h3>
    <p class="gap-note">Act on any of these right away — trade, mark evolved, or release.</p>
    <div v-for="(inst, i) in justLogged.slice(0, 12)" :key="inst.id" class="logged-row">
      <span>#{{ i + 1 }}</span>
      <button type="button" @click="quickAction(inst.id, 'traded')">Trade</button>
      <button type="button" @click="quickAction(inst.id, 'evolved')">Evolved</button>
      <button type="button" @click="quickAction(inst.id, 'released')">Release</button>
    </div>
    <p class="gap-note" v-if="justLogged.length > 12">+ {{ justLogged.length - 12 }} more — see Collection.</p>
  </div>
</template>

<style scoped>
.segmented {
  display: flex;
  gap: 4px;
  margin-bottom: 8px;
}
.segmented button {
  flex: 1;
}
.segmented button.active {
  background: var(--accent, #2a55d6);
  color: #fff;
}
.species-results {
  list-style: none;
  margin: 6px 0;
  padding: 0;
}
.qty-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.qty-row input {
  width: 60px;
  text-align: center;
}
.input-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.tag-picker {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}
.tag-chip {
  border: 1px dashed var(--line);
  border-radius: 999px;
  padding: 4px 10px;
  background: none;
}
.tag-chip.on {
  border-style: solid;
  background: var(--surface-2);
}
.new-tag-row {
  display: flex;
  gap: 6px;
}
.save-button {
  width: 100%;
  margin: 14px 0;
  padding: 10px;
  font-weight: 700;
}
.just-logged {
  border-top: 1px solid var(--line);
  padding-top: 12px;
}
.logged-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
}
</style>
