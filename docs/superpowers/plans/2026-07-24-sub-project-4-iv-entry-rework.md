# Sub-project 4: IV-Entry Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Log-a-catch's single typed IV% field with Attack/Defense/Stamina inputs (0–15 each), making `iv_percent` a real SQL generated column instead of a hand-typed value.

**Architecture:** A schema/migration layer change (new `iv_attack`/`iv_defense`/`iv_stamina` columns, `iv_percent` becomes `GENERATED ALWAYS AS ... VIRTUAL`) feeding an app-layer plumbing change (types, the one INSERT statement that writes these columns, a shared rounding-formula helper used both by the in-memory cache and the UI's live preview) feeding a new shared Vue input component wired into `LogCatchPage.vue`.

**Tech Stack:** Drizzle ORM (SQLite generated columns via `.generatedAlwaysAs()`), Vue 3 `<script setup>`, `node:test`, Playwright.

## Global Constraints

- No existing rows have a percent-only IV with no component breakdown to preserve (owner-confirmed 2026-07-23) — `iv_percent` becomes purely derived, no legacy-value column needed. If real data during implementation contradicts this, stop and ask.
- CP stays a manual field — not computable without base-stat data (unrelated to this sub-project).
- No edit UI exists for a logged specimen's stats after creation, and none is being added here — this only touches the Log-a-catch creation form.
- The responsive breakpoint is `min-width: 720px`, matching every other responsive rule already in `src/style.css`.
- Lint (`npm run lint`) and `npx tsc -b --noEmit` must pass before every commit.

---

## File Structure

| File | Responsibility |
| :--- | :--- |
| `src/db/schema/personal.ts` | `pokemonInstance` table: new `ivAttack`/`ivDefense`/`ivStamina` columns + CHECK constraints, `ivPercent` becomes generated |
| `src/db/migrations/000X_*.sql` (new, drizzle-kit generated + hand-edited) | The table-rebuild migration |
| `src/db/migrations-data.ts` (regenerated) | Embeds the new migration's SQL |
| `src/db/schema.ts` | `CURRENT_PERSONAL_SCHEMA_VERSION` 7 → 8 |
| `src/db/types.ts` | `PokemonInstance` gains 3 fields; adds a shared `computeIvPercent()` helper |
| `src/data/repository.ts` | `NewPokemonInstanceBatch`: `ivPercent` → 3 fields |
| `src/data/sqlite-repository.ts` | `createPokemonInstances`'s INSERT statement and in-memory object construction |
| `src/features/log-catch/IvComponentInput.vue` (new) | Shared responsive 0–15 input (slider+number on desktop, select on mobile) |
| `src/features/log-catch/LogCatchPage.vue` | Full-details mode: 3 inputs replace the 1 field, live preview |
| `test/*.test.ts` (new + modified) | Generated-column unit test, fixture updates |
| `e2e/log-catch-iv-entry.spec.ts` (new) | End-to-end coverage of the new flow |

---

### Task 1: Schema + migration — `pokemon_instance` gets real IV components

**Files:**
- Modify: `src/db/schema/personal.ts`
- Modify: `src/db/schema.ts`
- Modify: `src/db/types.ts`
- Create: `src/db/migrations/000X_iv_components.sql` (exact filename assigned by `drizzle-kit generate`)
- Modify: `src/db/migrations-data.ts` (regenerated, not hand-edited)
- Test: `test/iv-generated-column.test.ts` (new)

**Interfaces:**
- Consumes: nothing new.
- Produces: `PokemonInstance.ivAttack: number | null`, `.ivDefense: number | null`, `.ivStamina: number | null` (all consumed by Task 2/3). `PokemonInstance.ivPercent: number | null` stays the same name/type but is now documented as derived. A new exported function `computeIvPercent(ivAttack: number | null, ivDefense: number | null, ivStamina: number | null): number | null` in `src/db/types.ts`, consumed by Task 2 (sqlite-repository.ts) and Task 3 (LogCatchPage.vue's live preview) — this MUST implement the exact same rounding as the SQL generated column, so both stay in agreement.

- [ ] **Step 1: Update the Drizzle schema**

In `src/db/schema/personal.ts`, find the `pokemonInstance` table definition:

```ts
export const pokemonInstance = sqliteTable(
  "pokemon_instance",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    formSlug: text("form_slug").notNull(),
    profileId: integer("profile_id").notNull(),
    status: text("status", { enum: ["kept", "traded", "released", "evolved"] }).notNull().default("kept"),
    recordedAt: integer("recorded_at", { mode: "timestamp_ms" }).notNull(),
    caughtAt: integer("caught_at", { mode: "timestamp_ms" }),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
    cp: integer("cp"),
    ivPercent: real("iv_percent"),
    shiny: integer("shiny", { mode: "boolean" }).notNull().default(false),
    lucky: integer("lucky", { mode: "boolean" }).notNull().default(false),
    shadow: integer("shadow", { mode: "boolean" }).notNull().default(false),
    purified: integer("purified", { mode: "boolean" }).notNull().default(false),
    heartsEarned: integer("hearts_earned"),
    currentMegaLevel: integer("current_mega_level"),
    nickname: text("nickname"),
    backgroundSlug: text("background_slug"),
  },
  (table) => ({
    ...boolChecks("pokemon_instance", { shiny: table.shiny, lucky: table.lucky, shadow: table.shadow, purified: table.purified }),
    statusCheck: check("pokemon_instance_status_enum", sql`${table.status} IN ('kept', 'traded', 'released', 'evolved')`),
  }),
);
```

Replace with:

```ts
export const pokemonInstance = sqliteTable(
  "pokemon_instance",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    formSlug: text("form_slug").notNull(),
    profileId: integer("profile_id").notNull(),
    status: text("status", { enum: ["kept", "traded", "released", "evolved"] }).notNull().default("kept"),
    recordedAt: integer("recorded_at", { mode: "timestamp_ms" }).notNull(),
    caughtAt: integer("caught_at", { mode: "timestamp_ms" }),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
    cp: integer("cp"),
    ivAttack: integer("iv_attack"),
    ivDefense: integer("iv_defense"),
    ivStamina: integer("iv_stamina"),
    // Generated, not written directly -- SQLite rejects an explicit INSERT
    // into a GENERATED column. Rounds to 1 decimal place; NULL unless all
    // three components are present. See src/db/types.ts's computeIvPercent
    // for the JS-side mirror of this exact formula (used for the in-memory
    // cache and the Log-a-catch live preview, both of which need a value
    // before a DB round-trip is possible).
    ivPercent: real("iv_percent").generatedAlwaysAs(
      sql`CASE WHEN iv_attack IS NOT NULL AND iv_defense IS NOT NULL AND iv_stamina IS NOT NULL THEN ROUND((iv_attack + iv_defense + iv_stamina) * 100.0 / 45, 1) ELSE NULL END`,
      { mode: "virtual" },
    ),
    shiny: integer("shiny", { mode: "boolean" }).notNull().default(false),
    lucky: integer("lucky", { mode: "boolean" }).notNull().default(false),
    shadow: integer("shadow", { mode: "boolean" }).notNull().default(false),
    purified: integer("purified", { mode: "boolean" }).notNull().default(false),
    heartsEarned: integer("hearts_earned"),
    currentMegaLevel: integer("current_mega_level"),
    nickname: text("nickname"),
    backgroundSlug: text("background_slug"),
  },
  (table) => ({
    ...boolChecks("pokemon_instance", { shiny: table.shiny, lucky: table.lucky, shadow: table.shadow, purified: table.purified }),
    statusCheck: check("pokemon_instance_status_enum", sql`${table.status} IN ('kept', 'traded', 'released', 'evolved')`),
    ivAttackCheck: check("pokemon_instance_iv_attack_range", sql`${table.ivAttack} IS NULL OR (${table.ivAttack} >= 0 AND ${table.ivAttack} <= 15)`),
    ivDefenseCheck: check("pokemon_instance_iv_defense_range", sql`${table.ivDefense} IS NULL OR (${table.ivDefense} >= 0 AND ${table.ivDefense} <= 15)`),
    ivStaminaCheck: check("pokemon_instance_iv_stamina_range", sql`${table.ivStamina} IS NULL OR (${table.ivStamina} >= 0 AND ${table.ivStamina} <= 15)`),
  }),
);
```

- [ ] **Step 2: Generate the migration**

Run: `npm run db:generate`

This produces a new file under `src/db/migrations/` (drizzle-kit assigns the filename/tag). Read it in full. Per the exact same reasoning documented in `0001_timestamps_to_epoch_ms.sql`'s header comment (read that file's header now if you haven't — it explains this precisely), drizzle-kit's rebuild:
1. Likely drops the `REFERENCES form(slug)`, `REFERENCES profile(id)`, `REFERENCES backgrounds(slug)` clauses on `form_slug`/`profile_id`/`background_slug` when it regenerates the `CREATE TABLE __new_pokemon_instance` statement, because those clauses were originally hand-added to earlier migrations, not present in the Drizzle schema object itself (confirm this by checking: `formSlug: text("form_slug").notNull()` in the schema has no `.references()` call, same for `profileId`/`backgroundSlug`). If they're missing from the generated migration's `CREATE TABLE __new_pokemon_instance` statement, hand-add them back: ``` `form_slug` text NOT NULL REFERENCES form(slug),``` etc., matching `0001`'s exact `pokemon_instance` rebuild as a reference.
2. Wraps only the first table it touches in `PRAGMA foreign_keys=OFF`/`ON`, leaving the rest enforced — verify empirically with the sqlite3 CLI (create a throwaway `:memory:` or temp-file DB, apply the migration's raw SQL directly) whether this causes a `no such table` error for any REFERENCES target created later in the same file or by a still-pending table. If so, apply the same fix `0001`'s header comment describes: move the `PRAGMA foreign_keys=OFF` to the very start and `=ON` to the very end of this migration file's SQL.

This migration only touches `pokemon_instance` (a single table), so the fix (if needed at all) is much smaller in scope than `0001`'s ten-table rebuild — but confirm empirically, don't assume it's fine just because it's a smaller migration.

- [ ] **Step 3: Regenerate `migrations-data.ts`**

Run: `npm run db:generate-data`

This embeds the new migration's SQL as a string constant — do not hand-edit `migrations-data.ts` directly, it's generated output.

- [ ] **Step 4: Bump the schema version**

In `src/db/schema.ts`, change:
```ts
export const CURRENT_PERSONAL_SCHEMA_VERSION = 7;
```
to:
```ts
// Bumped 7 -> 8: pokemon_instance.iv_percent changed from a writable REAL
// column to a SQL GENERATED column derived from new iv_attack/iv_defense/
// iv_stamina columns (see docs/superpowers/specs/2026-07-24-sub-project-4-iv-entry-rework-design.md).
// A pre-8 export's ivPercent field is not carried forward on import -- the
// imported instance's IV fields land null until re-entered, since the
// export never had real component data to derive from either.
export const CURRENT_PERSONAL_SCHEMA_VERSION = 8;
```

- [ ] **Step 5: Update `src/db/types.ts`**

Find:
```ts
export interface PokemonInstance {
  id: number;
  formSlug: string;
  profileId: number;
  status: PokemonInstanceStatus;
  recordedAt: number;
  caughtAt: number | null;
  updatedAt: number;
  cp: number | null;
  ivPercent: number | null;
  shiny: boolean;
  lucky: boolean;
  shadow: boolean;
  purified: boolean;
  heartsEarned: number | null;
  currentMegaLevel: number | null;
  nickname: string | null;
  backgroundSlug: string | null;
}
```

Replace with:
```ts
export interface PokemonInstance {
  id: number;
  formSlug: string;
  profileId: number;
  status: PokemonInstanceStatus;
  recordedAt: number;
  caughtAt: number | null;
  updatedAt: number;
  cp: number | null;
  ivAttack: number | null;
  ivDefense: number | null;
  ivStamina: number | null;
  /** Derived from ivAttack/ivDefense/ivStamina by a SQL GENERATED column -- never write this directly. See computeIvPercent below for the JS-side mirror used before a DB round-trip is possible. */
  ivPercent: number | null;
  shiny: boolean;
  lucky: boolean;
  shadow: boolean;
  purified: boolean;
  heartsEarned: number | null;
  currentMegaLevel: number | null;
  nickname: string | null;
  backgroundSlug: string | null;
}

/** Mirrors pokemon_instance.iv_percent's SQL GENERATED expression exactly (schema/personal.ts) -- used wherever a value is needed before an actual DB round-trip (the in-memory cache after an insert, and the Log-a-catch live preview). */
export function computeIvPercent(ivAttack: number | null, ivDefense: number | null, ivStamina: number | null): number | null {
  if (ivAttack === null || ivDefense === null || ivStamina === null) return null;
  return Math.round(((ivAttack + ivDefense + ivStamina) * 100) / 45 * 10) / 10;
}
```

- [ ] **Step 6: Write the failing test**

Create `test/iv-generated-column.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";

import { runPersonalMigrations } from "../src/db/migrations";
import { nodeSqliteConnection } from "./node-sqlite-connection";

function freshDb(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  return db;
}

test("pokemon_instance.iv_percent is computed from iv_attack/iv_defense/iv_stamina", async () => {
  const db = freshDb();
  await runPersonalMigrations(nodeSqliteConnection(db));
  db.exec("PRAGMA foreign_keys = OFF"); // form_slug/profile_id/background_slug reference tables this test doesn't create
  db.prepare(
    "INSERT INTO pokemon_instance (form_slug, profile_id, recorded_at, updated_at, iv_attack, iv_defense, iv_stamina) VALUES ('bulbasaur-standard', 1, 0, 0, 15, 15, 15)",
  ).run();
  db.prepare(
    "INSERT INTO pokemon_instance (form_slug, profile_id, recorded_at, updated_at, iv_attack, iv_defense, iv_stamina) VALUES ('bulbasaur-standard', 1, 0, 0, 0, 0, 0)",
  ).run();
  db.prepare(
    "INSERT INTO pokemon_instance (form_slug, profile_id, recorded_at, updated_at, iv_attack, iv_defense, iv_stamina) VALUES ('bulbasaur-standard', 1, 0, 0, 10, 8, 4)",
  ).run();
  db.prepare(
    "INSERT INTO pokemon_instance (form_slug, profile_id, recorded_at, updated_at, iv_attack, iv_defense, iv_stamina) VALUES ('bulbasaur-standard', 1, 0, 0, NULL, NULL, NULL)",
  ).run();

  const rows = db.prepare("SELECT iv_attack, iv_defense, iv_stamina, iv_percent FROM pokemon_instance ORDER BY id").all() as {
    iv_attack: number | null;
    iv_defense: number | null;
    iv_stamina: number | null;
    iv_percent: number | null;
  }[];

  assert.equal(rows[0].iv_percent, 100);
  assert.equal(rows[1].iv_percent, 0);
  assert.equal(rows[2].iv_percent, 48.9); // (10+8+4)*100/45 = 48.888... -> rounds to 48.9
  assert.equal(rows[3].iv_percent, null);
});

test("inserting an out-of-range IV component is rejected by the CHECK constraint", async () => {
  const db = freshDb();
  await runPersonalMigrations(nodeSqliteConnection(db));
  db.exec("PRAGMA foreign_keys = OFF");
  assert.throws(() => {
    db.prepare(
      "INSERT INTO pokemon_instance (form_slug, profile_id, recorded_at, updated_at, iv_attack, iv_defense, iv_stamina) VALUES ('bulbasaur-standard', 1, 0, 0, 16, 0, 0)",
    ).run();
  }, /CHECK constraint failed/);
});
```

- [ ] **Step 7: Run the test, verify it fails for the right reason on `main` before your schema change, then passes after**

Run: `npx tsx --test test/iv-generated-column.test.ts`

Since Steps 1-5 already happened before this step, this test should already pass. If it doesn't, your migration (Step 2) didn't land the generated column or CHECK constraints correctly — go back and fix the migration SQL directly (or re-run `db:generate` after correcting `schema/personal.ts`) before proceeding.

- [ ] **Step 8: Verify**

Run: `npx tsc -b --noEmit` (will show errors in files Task 2 hasn't touched yet — that's expected and fine, Task 2 fixes those; confirm the errors are ONLY in `src/data/repository.ts`, `src/data/sqlite-repository.ts`, `src/features/log-catch/LogCatchPage.vue`, or existing tests referencing the old `ivPercent`-only shape, not in `src/db/schema/personal.ts`, `src/db/schema.ts`, or `src/db/types.ts` themselves).

Run: `npx tsx --test test/iv-generated-column.test.ts` — both tests pass.

- [ ] **Step 9: Commit**

```bash
git add src/db/schema/personal.ts src/db/schema.ts src/db/types.ts src/db/migrations/ src/db/migrations-data.ts test/iv-generated-column.test.ts
git commit -m "Make pokemon_instance.iv_percent a SQL generated column"
```

---

### Task 2: App-layer plumbing — repository, write path, shared helper consumers

**Files:**
- Modify: `src/data/repository.ts`
- Modify: `src/data/sqlite-repository.ts`
- Modify: `test/personal-data-transfer.test.ts`

**Interfaces:**
- Consumes: `PokemonInstance.ivAttack`/`.ivDefense`/`.ivStamina`, `computeIvPercent()` from Task 1.
- Produces: `NewPokemonInstanceBatch.ivAttack`/`.ivDefense`/`.ivStamina` (consumed by Task 3's `LogCatchPage.vue`).

- [ ] **Step 1: Update `NewPokemonInstanceBatch`**

In `src/data/repository.ts`, find:
```ts
export interface NewPokemonInstanceBatch {
  formSlug: string;
  count: number;
  shiny?: boolean;
  lucky?: boolean;
  shadow?: boolean;
  purified?: boolean;
  cp?: number | null;
  ivPercent?: number | null;
  nickname?: string | null;
  /** Epoch milliseconds, matching PokemonInstance.caughtAt — see LogCatchPage.vue for the date-input-string -> epoch-ms conversion. */
  caughtAt?: number | null;
  backgroundSlug?: string | null;
  tagIds?: number[];
}
```

Replace `ivPercent?: number | null;` with:
```ts
  ivAttack?: number | null;
  ivDefense?: number | null;
  ivStamina?: number | null;
```

- [ ] **Step 2: Update the INSERT statement**

In `src/data/sqlite-repository.ts`, find `createPokemonInstances`'s INSERT (the statement inserting into `pokemon_instance`). It currently includes `iv_percent` in both the column list and the bound values (`DEFAULT_PROFILE_ID`/`batch.ivPercent` era — by this point in the branch it should read `state.profile.id`/`batch.ivPercent`, per the earlier profile-id fix). Change the column list from:
```sql
INSERT INTO pokemon_instance (form_slug, profile_id, status, recorded_at, caught_at, updated_at, cp, iv_percent, shiny, lucky, shadow, purified, nickname, background_slug)
VALUES (?, ?, 'kept', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
```
to:
```sql
INSERT INTO pokemon_instance (form_slug, profile_id, status, recorded_at, caught_at, updated_at, cp, iv_attack, iv_defense, iv_stamina, shiny, lucky, shadow, purified, nickname, background_slug)
VALUES (?, ?, 'kept', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
```
(`iv_percent` must NOT appear here — SQLite rejects an explicit `INSERT`/value for a `GENERATED` column.) Update the bound-values array to match: replace the single `batch.ivPercent ?? null` entry with three entries, `batch.ivAttack ?? null, batch.ivDefense ?? null, batch.ivStamina ?? null`, in the same position (right after `cp`).

- [ ] **Step 3: Update the in-memory object construction**

Immediately after the INSERT, this function builds a `PokemonInstance` object to push into `created`/`state.pokemonInstances` (it does not re-query the row — see the function's own comment about `last_insert_rowid()` being the only re-query it does). Find the object literal (currently has `ivPercent: batch.ivPercent ?? null,` or similar) and replace with:
```ts
            ivAttack: batch.ivAttack ?? null,
            ivDefense: batch.ivDefense ?? null,
            ivStamina: batch.ivStamina ?? null,
            ivPercent: computeIvPercent(batch.ivAttack ?? null, batch.ivDefense ?? null, batch.ivStamina ?? null),
```
Add the import: `import { computeIvPercent } from "../db/types";` (check whether `sqlite-repository.ts` already imports from `../db/types` elsewhere in the file and add to that existing import statement instead of a new one, to avoid a duplicate-import lint error).

- [ ] **Step 4: Update the existing test fixture**

In `test/personal-data-transfer.test.ts`, find the hand-written legacy export fixture's `pokemonInstances` entry with `ivPercent: 100,`. Replace with `ivAttack: 15, ivDefense: 15, ivStamina: 15, ivPercent: 100,` (keep `ivPercent` too — the fixture represents a raw JSON export object being read by `readPersonalDataFile`, and since this test doesn't touch `createPokemonInstances`/the DB at all, it's just verifying JSON shape handling; keeping a hand-consistent `ivPercent` value alongside the components avoids the test's other assertions needing to change simultaneously). If any assertion in this test elsewhere reads `.ivPercent` on this fixture and expects a specific value, confirm 100 is still correct given 15+15+15.

- [ ] **Step 5: Verify**

Run: `npx tsc -b --noEmit` — should now be clean except for `src/features/log-catch/LogCatchPage.vue` (Task 3's job).

Run: `npm test` — all should pass, including Task 1's new `iv-generated-column.test.ts` and the updated `personal-data-transfer.test.ts`.

- [ ] **Step 6: Commit**

```bash
git add src/data/repository.ts src/data/sqlite-repository.ts test/personal-data-transfer.test.ts
git commit -m "Wire pokemon_instance's IV components through the repository write path"
```

---

### Task 3: `IvComponentInput.vue` + `LogCatchPage.vue` wiring + e2e test

**Files:**
- Create: `src/features/log-catch/IvComponentInput.vue`
- Modify: `src/features/log-catch/LogCatchPage.vue`
- Modify: `src/style.css` (new component's styling)
- Create: `e2e/log-catch-iv-entry.spec.ts`

**Interfaces:**
- Consumes: `computeIvPercent` from `src/db/types.ts` (Task 1), `NewPokemonInstanceBatch.ivAttack`/`.ivDefense`/`.ivStamina` (Task 2).
- Produces: nothing further downstream — this is the last task in the sub-project.

- [ ] **Step 1: Write `IvComponentInput.vue`**

```vue
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
</template>

<datalist id="iv-tick-marks">
  <option value="5"></option>
  <option value="10"></option>
</datalist>
```

Note: a bare top-level `<datalist>` outside `<template>` is not valid SFC structure — move it inside the `<template>` root as a sibling of the outer `<div class="iv-component-input">` (Vue 3 SFCs support multiple root template nodes). Correct the template block to:

```vue
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
```

- [ ] **Step 2: Add responsive CSS**

Add to `src/style.css`:

```css
.iv-component-input {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.iv-component-label {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--muted);
}
.iv-component-desktop {
  display: none;
  align-items: center;
  gap: 8px;
}
.iv-component-desktop input[type="range"] {
  flex: 1;
}
.iv-component-desktop input[type="number"] {
  width: 56px;
}
.iv-component-mobile {
  display: block;
  border: 1px solid var(--line);
  background: var(--bg);
  color: var(--ink);
  border-radius: var(--radius-sm, 8px);
  padding: 8px 10px;
  font-size: 0.92rem;
}
@media (min-width: 720px) {
  .iv-component-desktop {
    display: flex;
  }
  .iv-component-mobile {
    display: none;
  }
}
```

Check the exact token names (`--muted`, `--line`, `--bg`, `--ink`, `--radius-sm`) against what's already defined in `src/style.css`'s `:root` block and substitute the real names if any differ from this snippet.

- [ ] **Step 3: Wire into `LogCatchPage.vue`**

Replace:
```ts
const ivPercent = ref<number | null>(null);
```
with:
```ts
const ivAttack = ref<number | null>(null);
const ivDefense = ref<number | null>(null);
const ivStamina = ref<number | null>(null);
const livePreviewIv = computed(() => computeIvPercent(ivAttack.value, ivDefense.value, ivStamina.value));
```
Add the import: `import { computeIvPercent } from "../../db/types";` (merge into the existing `import type { Form, PokemonInstance, Species } from "../../db/types";` line — note `computeIvPercent` is a value import, not `type`, so it needs a separate `import { computeIvPercent } from "../../db/types";` statement, or split the existing line into a mixed `import { computeIvPercent, type Form, type PokemonInstance, type Species } from "../../db/types";` — match whatever style the rest of this file's imports already use for mixed type/value imports from the same module).

Add `import IvComponentInput from "./IvComponentInput.vue";`.

In `save()`, replace:
```ts
      ivPercent: mode.value === "full" ? ivPercent.value : null,
```
with:
```ts
      ivAttack: mode.value === "full" ? ivAttack.value : null,
      ivDefense: mode.value === "full" ? ivDefense.value : null,
      ivStamina: mode.value === "full" ? ivStamina.value : null,
```

In the template, replace:
```html
<label class="field">IV %<input type="number" v-model.number="ivPercent" /></label>
```
with:
```html
<IvComponentInput v-model="ivAttack" label="Attack IV" />
<IvComponentInput v-model="ivDefense" label="Defense IV" />
<IvComponentInput v-model="ivStamina" label="Stamina IV" />
<div class="field" v-if="livePreviewIv !== null">
  <span class="iv-component-label">IV %</span>
  <span class="tabular">{{ livePreviewIv }}%</span>
</div>
```

- [ ] **Step 4: Write the e2e test**

Create `e2e/log-catch-iv-entry.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

test("logging a catch with IV components computes and persists the correct IV%", async ({ page }) => {
  await page.goto("/#/log-catch");
  await page.waitForLoadState("networkidle");

  await page.getByRole("searchbox").fill("bulbasaur");
  await page.getByText("Bulbasaur", { exact: false }).first().click();

  await page.getByRole("tab", { name: /full details/i }).click();

  // Use the mobile <select> path (works regardless of viewport width used
  // by the Playwright config, unlike the desktop-only slider/number pair).
  const selects = page.locator(".iv-component-mobile");
  await selects.nth(0).selectOption("15");
  await selects.nth(1).selectOption("15");
  await selects.nth(2).selectOption("15");

  await expect(page.getByText("100%")).toBeVisible();

  await page.getByRole("button", { name: /^save$/i }).click();
  await page.waitForTimeout(500);

  await page.goto("/#/collection");
  await page.waitForLoadState("networkidle");
  await expect(page.getByText("100% IV")).toBeVisible();
});
```

Adjust selectors once you've loaded the actual running page in a browser and confirmed exact rendered text/roles (this is a starting shape, not literal text guaranteed to match every detail of the real DOM — e.g. confirm the "Full details" mode toggle is actually an ARIA tab, and that `.iv-component-mobile` selects are visible/interactable in whatever viewport Playwright's config defaults to, forcing a narrow viewport explicitly via `page.setViewportSize` if the default is >=720px wide).

- [ ] **Step 5: Verify**

Run: `npx tsc -b --noEmit` — clean.
Run: `npm test` — all pass.
Run: `npx playwright test e2e/log-catch-iv-entry.spec.ts` — passes.
Run the full Playwright suite (`npx playwright test`) — everything passes except the already-known, pre-existing, unrelated `settings-and-export.spec.ts` failure (confirmed unrelated across every prior sub-project task — no need to re-litigate it here).

Manually check in a browser at both a narrow (<720px) and wide (>=720px) viewport that the slider+number pair appears on wide and the dropdown appears on narrow, and that dragging/typing/arrow-clicking the desktop slider+number pair all update the same value.

- [ ] **Step 6: Update the migration-plan/roadmap docs if relevant**

Check `docs/superpowers/specs/2026-07-23-v2-consolidation-roadmap.md`'s Sub-project 4 section — no update needed there (it just names the sub-project, doesn't track line-item status), but if a status-tracking convention exists elsewhere for completed sub-projects, follow it.

- [ ] **Step 7: Commit**

```bash
git add src/features/log-catch/IvComponentInput.vue src/features/log-catch/LogCatchPage.vue src/style.css e2e/log-catch-iv-entry.spec.ts
git commit -m "Replace Log-a-catch's typed IV% field with Attack/Defense/Stamina inputs"
```
