<!--
  One 0-15 IV-component input (Attack/Defense/Stamina), used three times by
  LogCatchPage.vue's Full details mode. Desktop (>=720px) shows a range
  slider (tick marks at 5/10) alongside a number input with native
  up/down arrows -- both bound to the same value, so typing, dragging, or
  clicking the arrows all work. Mobile shows a <select> instead: dragging a
  16-value slider precisely on a small touchscreen is imprecise, and a
  dropdown is exact and fast to tap.
-->
<script setup lang="ts">
const props = defineProps<{ modelValue: number | null; label: string }>();
const emit = defineEmits<{ (e: "update:modelValue", value: number | null): void }>();

const OPTIONS = Array.from({ length: 16 }, (_, i) => i); // 0..15

function onSliderOrNumberInput(raw: string) {
  if (raw === "") {
    emit("update:modelValue", null);
    return;
  }
  const n = Number(raw);
  emit("update:modelValue", Number.isFinite(n) ? Math.max(0, Math.min(15, Math.round(n))) : null);
}

function onSelectInput(raw: string) {
  emit("update:modelValue", raw === "" ? null : Number(raw));
}
</script>

<template>
  <div class="iv-component-input">
    <label class="iv-component-label">{{ props.label }}</label>

    <div class="iv-component-desktop">
      <input
        type="range"
        min="0"
        max="15"
        step="1"
        list="iv-tick-marks"
        :value="props.modelValue ?? 0"
        @input="onSliderOrNumberInput(($event.target as HTMLInputElement).value)"
      />
      <input
        type="number"
        min="0"
        max="15"
        :value="props.modelValue"
        @input="onSliderOrNumberInput(($event.target as HTMLInputElement).value)"
      />
    </div>

    <select class="iv-component-mobile" :value="props.modelValue ?? ''" @change="onSelectInput(($event.target as HTMLSelectElement).value)">
      <option value="">—</option>
      <option v-for="n in OPTIONS" :key="n" :value="n">{{ n }}</option>
    </select>
  </div>
  <datalist id="iv-tick-marks">
    <option value="5"></option>
    <option value="10"></option>
  </datalist>
</template>
