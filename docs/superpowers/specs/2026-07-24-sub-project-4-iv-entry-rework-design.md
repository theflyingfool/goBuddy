# Sub-project 4: IV-Entry Rework — Design

> Part of the [V2 consolidation roadmap](2026-07-23-v2-consolidation-roadmap.md).
> This is the design for that roadmap's Sub-project 4 only.

## Goal

Replace Log-a-catch "Full details" mode's single typed **IV %** field with
three Attack/Defense/Stamina inputs (each 0–15, matching real in-game IV
mechanics), with IV% computed rather than hand-entered — removing a manual
math step and a source of typos/inconsistent rounding.

## Corrections from the original roadmap framing

The roadmap doc's Sub-project 4 section assumed an existing IV-slider
pattern (from the species-detail CP calculator) could be reused, and left
open whether CP should also become computed here. Neither holds:

- **No IV-slider UI exists anywhere in the app today.** The CP calculator
  referenced was a mockup detail — the real, built species-detail Info tab
  shows an honest "Not available yet — base stats aren't in the current
  reference data" message instead. This sub-project builds new input UI
  from scratch, not a port of an existing pattern.
- **CP cannot become computed from IVs+level**, for the same reason (no
  base-stat data in `reference.json`). It stays a separate, manual field —
  unrelated to this change.
- **No edit flow exists for a logged specimen's stats after creation** —
  only status changes (traded/evolved/released). This sub-project only
  touches the Log-a-catch creation form, not any edit UI.

## Scope

### 1. Schema: `pokemon_instance` gains real IV components

Add three new nullable columns, each an `INTEGER` with a `CHECK` constraint
(0–15 inclusive), matching this table's existing named-CHECK convention
(`pokemon_instance_shiny_bool`, etc.):
- `iv_attack`
- `iv_defense`
- `iv_stamina`

`iv_percent` (currently a plain writable `REAL` column) becomes a genuine
SQL **generated column**:

```sql
iv_percent REAL GENERATED ALWAYS AS (
  CASE WHEN iv_attack IS NOT NULL AND iv_defense IS NOT NULL AND iv_stamina IS NOT NULL
       THEN ROUND((iv_attack + iv_defense + iv_stamina) * 100.0 / 45, 1)
       ELSE NULL END
) VIRTUAL
```

`VIRTUAL`, not `STORED` — nothing queries or indexes on `iv_percent` in SQL
(the existing "sort by IV" logic in `in-memory-store.ts` sorts the
in-memory cache in JS, not via `ORDER BY`), so there's no reason to pay
storage cost for a value this cheap to recompute on read.

**Owner decision (2026-07-23): no existing rows have a percent-only IV with
no component breakdown to preserve.** `iv_percent` cleanly becomes the one
and only source of truth for displayed IV%, with no legacy-value column
needed. If this assumption turns out wrong once real data is inspected
during implementation, stop and ask before proceeding — this design does
not cover a legacy-preservation path.

**Why a real generated column, not app-computed:** SQLite computes and
enforces this consistently at the database layer — every current and
future reader (Collection page, species-detail specimen cards, any code
added later) gets a correct, always-in-sync value for free, with nothing
to keep manually consistent in application code the way a plain stored
column would require.

**Migration mechanics:** this requires the same table-rebuild pattern as
the epoch-ms migration (`0001_timestamps_to_epoch_ms.sql`) — SQLite can't
`ALTER TABLE` a column into being `GENERATED`. Generate via
`npm run db:generate` after updating `src/db/schema/personal.ts`, then
hand-edit the output the same way `0001`'s header comment documents:
restore any `REFERENCES` clauses drizzle-kit's rebuild drops (this table
has three: `form_slug`, `profile_id`, `background_slug`), and reorder the
`PRAGMA foreign_keys` bracketing if drizzle-kit generates it incorrectly
again (verify empirically with the sqlite3 CLi, don't assume — see that
migration's own comment for why this exact check matters).

**Schema version bump:** `CURRENT_PERSONAL_SCHEMA_VERSION` 7 → 8 — this is
a column-meaning change (a writable column becomes generated, plus new
columns), per `docs/data-model.md`'s versioning policy.

### 2. App-layer types

- `src/db/types.ts`'s `PokemonInstance`: add `ivAttack: number | null`,
  `ivDefense: number | null`, `ivStamina: number | null`. `ivPercent`
  stays `number | null` but is now documented as **read-only / derived** —
  never written directly.
- `src/data/repository.ts`'s `NewPokemonInstanceBatch`: replace
  `ivPercent?: number | null` with `ivAttack?: number | null`,
  `ivDefense?: number | null`, `ivStamina?: number | null`.
- `src/data/sqlite-repository.ts`'s `createPokemonInstances` INSERT
  statement: bind the three new columns instead of `iv_percent` — SQLite
  rejects an explicit `INSERT` into a `GENERATED` column, so `iv_percent`
  must not appear in the column list at all. The read-side
  (`loadPersonalState`) needs no change beyond adding the three new
  `row.iv_attack`/etc. pass-throughs — `row.iv_percent` continues to work
  exactly as today, now reflecting the database's own computed value.
- `src/data/in-memory-store.ts`: the "iv" sort case's `ivPercent` read is
  unchanged (still reads `instance.ivPercent`, now always a correctly
  computed value or `null`).

### 3. Export/import format

`PersonalDataExport`'s `pokemonInstances` shape currently carries
`ivPercent`. This changes to carry `ivAttack`/`ivDefense`/`ivStamina`
instead (the real source data) — `importPersonalData`'s merge logic
inserts via the same `createPokemonInstances`-equivalent path, so it must
supply the three components, not a value it can no longer legally write.
This is exactly the kind of format change `CURRENT_PERSONAL_SCHEMA_VERSION`
existing for — no new conversion-on-import logic is needed beyond what a
version bump already triggers (a pre-8 export importing into a post-8 app
would have `ivPercent` but no components; per the "no legacy data to
preserve" decision above, treat a pre-8 export's `ivPercent` as simply not
carried forward — the imported instance's IV fields land `null` until
re-entered, which is honest given the source export never had real
component data either).

### 4. UI: `IvComponentInput.vue` (new, shared component)

One new component, used three times (Attack/Defense/Stamina) in
`LogCatchPage.vue`'s "Full details" mode, replacing the single `IV %`
field in the existing `.input-grid`:

- **Props:** `modelValue: number | null`, `label: string`. **Emits:**
  `update:modelValue`.
- **Desktop (`min-width: 720px`, the app's existing breakpoint token —
  see `src/style.css`):** a range slider (`<input type="range" min="0"
  max="15">`) with a `<datalist>` at values 5 and 10 for tick marks,
  shown alongside a number input (`<input type="number" min="0" max="15">`,
  native up/down step arrows) — both bound to the same `v-model`, so
  dragging, typing, or clicking the arrows all work interchangeably.
- **Mobile (below 720px):** a `<select>` with options 0 through 15,
  replacing the slider — a 16-value drag gesture on a small touchscreen is
  imprecise; a dropdown is faster and exact. The number-input/type-to-enter
  option is not needed on mobile once the dropdown exists (a `<select>`
  is already directly tappable-to-a-value).
- Use CSS (`@media (min-width: 720px)`), not JS viewport detection, to
  switch between the two layouts, matching every other responsive
  decision already in this codebase.

### 5. Live IV% preview

`LogCatchPage.vue`'s "Full details" section computes a live preview next
to the three inputs as the user adjusts them:

```ts
const livePreviewIv = computed(() => {
  if (ivAttack.value === null || ivDefense.value === null || ivStamina.value === null) return null;
  return Math.round(((ivAttack.value + ivDefense.value + ivStamina.value) * 100 / 45) * 10) / 10;
});
```

Same rounding rule as the SQL generated column (round to 1 decimal place)
so the preview never disagrees with what's actually saved.

## Out of scope

- Any edit UI for an already-logged specimen's IV (none exists today; not
  being added here).
- CP computation (blocked on base-stat data, unrelated to this sub-project).
- Any change to Quick-mode logging (it never collected IV/CP at all).

## Testing approach

- A `node:test` unit test for the generated column's SQL expression
  directly (insert rows with known Attack/Defense/Stamina combinations,
  including a null-component case, and assert the read-back `iv_percent`
  matches the expected rounded value) — this is real, mechanically
  verifiable logic worth a fast unit test, not just an e2e check.
- A Playwright e2e test for `LogCatchPage.vue`: log a catch with specific
  Attack/Defense/Stamina values via "Full details" mode, confirm the live
  preview matches expectations, save, and confirm the Collection page
  displays the correct computed IV% for that specimen.
- Confirm the existing `readPersonalDataFile`/import round-trip tests
  (`test/personal-data-transfer.test.ts`, `test/export-import-round-trip.test.ts`)
  are updated for the new `pokemonInstances` shape (no more `ivPercent` in
  the export type).
