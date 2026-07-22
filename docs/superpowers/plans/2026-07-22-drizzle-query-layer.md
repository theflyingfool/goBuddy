# Drizzle Query Layer & Rollout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite `src/data/completion-stats-sql.ts`'s hand-written parameterized SQL and `src/db/reference-sync.ts`'s hand-built `INSERT` statements using Drizzle's query builder, then bring `scripts/build-dummy-db.ts` and the docs in line with the new schema-source-of-truth split.

**Architecture:** Builds directly on `docs/superpowers/plans/2026-07-22-drizzle-schema-and-migrations.md` — requires `src/db/schema/reference.ts`, `src/db/schema/personal.ts`, and `src/db/drizzle-client.ts` to already exist and be merged. Each lens query in `completion-stats-sql.ts` becomes a typed `db.select()` chain against the Drizzle table objects instead of a raw SQL string. `reference-sync.ts`'s row-by-row `INSERT` loop becomes `db.insert(...).values([...])` batch calls, still inside the same manual transaction (Drizzle's proxy driver doesn't change how `beginTransaction`/`commitTransaction` work — those still go straight through `SQLiteDBConnection`).

**Tech Stack:** Same `drizzle-orm`/`drizzle-kit` versions pinned in Plan 1's Global Constraints.

## Global Constraints

- Requires Plan 1 merged first: `src/db/schema/reference.ts`, `src/db/schema/personal.ts`, `src/db/drizzle-client.ts` (`getDrizzleDb()`) must exist.
- `src/data/in-memory-store.ts` is **not** touched — unchanged from Plan 1's constraint.
- Every rewritten query in `completion-stats-sql.ts` must produce byte-identical `CompletionLensResult[]` output to today's implementation for the same inputs — verified via the existing behavioral test (Task 1) before touching the raw-SQL functions.
- `reference-sync.ts`'s transaction structure (defer_foreign_keys, slug-rename-then-quarantine-then-drop-then-recreate ordering) is unchanged — only the `INSERT` statements move to Drizzle's builder.

---

## Task 1: Lock in today's completion-stats behavior with a snapshot test

**Files:**
- Create: `test/completion-stats-sql.test.ts`

**Interfaces:**
- Consumes: `getCompletionStatsSql` (existing, `src/data/completion-stats-sql.ts`), `nodeSqliteConnection` (existing).

- [ ] **Step 1: Write a fixture-backed test covering every lens kind**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";

import { getCompletionStatsSql } from "../src/data/completion-stats-sql";
import { nodeSqliteConnection } from "./node-sqlite-connection";

function seededDb(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE species (slug TEXT PRIMARY KEY, dex_number INTEGER, name TEXT, region_slug TEXT);
    CREATE TABLE form (slug TEXT PRIMARY KEY, species_slug TEXT, form_name TEXT, costume_name TEXT, regional_exclusive INTEGER);
    CREATE TABLE mega_variant (slug TEXT PRIMARY KEY, species_slug TEXT, variant TEXT);
    CREATE TABLE species_personal (species_slug TEXT PRIMARY KEY, registered INTEGER);
    CREATE TABLE form_personal (form_slug TEXT PRIMARY KEY, caught INTEGER, shiny INTEGER);
    CREATE TABLE mega_personal (mega_variant_slug TEXT PRIMARY KEY, evolved INTEGER, shiny_evolved INTEGER);

    INSERT INTO species VALUES ('bulbasaur', 1, 'Bulbasaur', 'kanto');
    INSERT INTO species VALUES ('ivysaur', 2, 'Ivysaur', 'kanto');
    INSERT INTO form VALUES ('bulbasaur-standard-male', 'bulbasaur', 'Standard', NULL, 0);
    INSERT INTO form VALUES ('bulbasaur-santa-hat-male', 'bulbasaur', 'Standard', 'Santa Hat', 0);
    INSERT INTO form VALUES ('ivysaur-standard-male', 'ivysaur', 'Standard', NULL, 0);
    INSERT INTO mega_variant VALUES ('bulbasaur-mega', 'bulbasaur', NULL);

    INSERT INTO species_personal VALUES ('bulbasaur', 1);
    INSERT INTO form_personal VALUES ('bulbasaur-standard-male', 1, 1);
    INSERT INTO mega_personal VALUES ('bulbasaur-mega', 0, 0);
  `);
  return db;
}

test("registered lens: global scope", async () => {
  const db = nodeSqliteConnection(seededDb());
  const [result] = await getCompletionStatsSql(db, { kind: "global" }, [{ kind: "registered" }], false);
  assert.equal(result.total, 2);
  assert.equal(result.complete, 1);
  assert.deepEqual(result.missingSpecies, [{ slug: "ivysaur", name: "Ivysaur", dexNumber: 2 }]);
});

test("formComplete lens: costumes excluded from the denominator", async () => {
  const db = nodeSqliteConnection(seededDb());
  const [result] = await getCompletionStatsSql(db, { kind: "global" }, [{ kind: "formComplete" }], false);
  assert.equal(result.total, 2);
  assert.equal(result.complete, 1); // bulbasaur's standard form is caught; ivysaur's isn't
});

test("costumeComplete lens: denominator is species with a costume only", async () => {
  const db = nodeSqliteConnection(seededDb());
  const [result] = await getCompletionStatsSql(db, { kind: "global" }, [{ kind: "costumeComplete" }], false);
  assert.equal(result.total, 1); // only bulbasaur has a costume form
  assert.equal(result.complete, 0); // santa-hat form was never caught
});

test("megaComplete lens: not-evolved species reported missing", async () => {
  const db = nodeSqliteConnection(seededDb());
  const [result] = await getCompletionStatsSql(db, { kind: "global" }, [{ kind: "megaComplete" }], false);
  assert.equal(result.total, 1);
  assert.equal(result.complete, 0);
});

test("achievement lens: caught field", async () => {
  const db = nodeSqliteConnection(seededDb());
  const [result] = await getCompletionStatsSql(db, { kind: "global" }, [{ kind: "achievement", field: "caught" }], false);
  assert.equal(result.total, 2);
  assert.equal(result.complete, 1);
});

test("region scope filters species", async () => {
  const db = nodeSqliteConnection(seededDb());
  const [result] = await getCompletionStatsSql(db, { kind: "region", regionSlug: "kanto" }, [{ kind: "registered" }], false);
  assert.equal(result.total, 2);
});
```

- [ ] **Step 2: Run against today's implementation to confirm the fixture is well-formed**

Run: `npm run test -- test/completion-stats-sql.test.ts`
Expected: all tests PASS against the current raw-SQL implementation, before any rewrite.

- [ ] **Step 3: Commit**

```bash
git add test/completion-stats-sql.test.ts
git commit -m "Add behavioral snapshot test for completion-stats-sql.ts before Drizzle rewrite"
```

---

## Task 2: Rewrite `completion-stats-sql.ts` on Drizzle's query builder

**Files:**
- Modify: `src/data/completion-stats-sql.ts` (full rewrite)

**Interfaces:**
- Consumes: `species`, `form`, `megaVariant` from `src/db/schema/reference.ts`; `speciesPersonal`, `formPersonal`, `megaPersonal` from `src/db/schema/personal.ts`; `getDrizzleDb()` from `src/db/drizzle-client.ts`.
- Produces: same exported `getCompletionStatsSql(db: SQLiteDBConnection, scope, lenses, excludeRegionalFromFormComplete)` signature — callers (`src/data/sqlite-repository.ts`) don't change. Internally now ignores the `db` parameter's raw connection for querying (uses `getDrizzleDb()` instead) but keeps the parameter so the call site is unchanged; `db` is still the same underlying connection Drizzle's client wraps.

- [ ] **Step 1: Write the rewrite**

```ts
// Drizzle-backed implementation of the completion-stats feature (CLAUDE.md
// Feature 1) — one query per lens kind, parameterized by scope. Rewritten
// from hand-written parameterized SQL (see git history) onto Drizzle's
// query builder against src/db/schema/reference.ts + schema/personal.ts.
// src/data/in-memory-store.ts deliberately has no JS equivalent of this
// feature — this is the only implementation.

import { and, eq, exists, isNull, ne, notExists, notLike, or, sql } from "drizzle-orm";
import type { SQLiteDBConnection } from "@capacitor-community/sqlite";
import { getDrizzleDb } from "../db/drizzle-client";
import { form, megaVariant, species } from "../db/schema/reference";
import { formPersonal, megaPersonal, speciesPersonal } from "../db/schema/personal";
import { FORM_PERSONAL_BOOLEAN_FIELDS, FORM_PERSONAL_FIELD_COLUMNS, type FormPersonalBooleanField } from "../db/types";
import type { CompletionLens, CompletionLensResult, CompletionMissingSpecies, CompletionScope } from "./repository";

type DrizzleDb = Awaited<ReturnType<typeof getDrizzleDb>>;

function scopeCondition(scope: CompletionScope) {
  switch (scope.kind) {
    case "region":
      return eq(species.regionSlug, scope.regionSlug);
    case "species":
      return eq(species.slug, scope.speciesSlug);
    case "global":
      return sql`1 = 1`;
  }
}

// Mirrors field-groups.ts's isGigantamaxForm — can't call that JS predicate
// from a query builder, so this re-encodes the same "formName is always
// 'Gigantamax' or 'Gigantamax {style}'" rule. Keep the two in sync if that
// ingestion convention ever changes.
function notGigantamax(formNameColumn: typeof form.formName) {
  return and(ne(formNameColumn, "Gigantamax"), notLike(formNameColumn, "Gigantamax %"));
}

async function countSpecies(db: DrizzleDb, scopeCond: ReturnType<typeof scopeCondition>): Promise<number> {
  const rows = await db.select({ c: sql<number>`count(*)` }).from(species).where(scopeCond);
  return rows[0]?.c ?? 0;
}

function toMissing(rows: { slug: string; name: string; dexNumber: number }[]): CompletionMissingSpecies[] {
  return rows.map((r) => ({ slug: r.slug, name: r.name, dexNumber: r.dexNumber }));
}

async function registeredLens(db: DrizzleDb, scope: CompletionScope): Promise<Omit<CompletionLensResult, "lens">> {
  const scopeCond = scopeCondition(scope);
  const total = await countSpecies(db, scopeCond);
  const missingRows = await db
    .select({ slug: species.slug, name: species.name, dexNumber: species.dexNumber })
    .from(species)
    .leftJoin(speciesPersonal, eq(speciesPersonal.speciesSlug, species.slug))
    .where(and(scopeCond, or(isNull(speciesPersonal.registered), eq(speciesPersonal.registered, false))));
  const missingSpecies = toMissing(missingRows);
  return { total, complete: total - missingSpecies.length, missingSpecies };
}

async function formCompleteLens(db: DrizzleDb, scope: CompletionScope, excludeRegional: boolean): Promise<Omit<CompletionLensResult, "lens">> {
  const scopeCond = scopeCondition(scope);
  const total = await countSpecies(db, scopeCond);
  const innerConditions = [eq(form.speciesSlug, species.slug), isNull(form.costumeName), notGigantamax(form.formName)];
  if (excludeRegional) innerConditions.push(eq(form.regionalExclusive, false));
  innerConditions.push(or(isNull(formPersonal.caught), eq(formPersonal.caught, false))!);

  const missingRows = await db
    .select({ slug: species.slug, name: species.name, dexNumber: species.dexNumber })
    .from(species)
    .where(
      and(
        scopeCond,
        exists(
          db
            .select({ one: sql`1` })
            .from(form)
            .leftJoin(formPersonal, eq(formPersonal.formSlug, form.slug))
            .where(and(...innerConditions)),
        ),
      ),
    );
  const missingSpecies = toMissing(missingRows);
  return { total, complete: total - missingSpecies.length, missingSpecies };
}

async function gigantamaxCompleteLens(db: DrizzleDb, scope: CompletionScope): Promise<Omit<CompletionLensResult, "lens">> {
  const scopeCond = scopeCondition(scope);
  const totalRows = await db
    .select({ c: sql<number>`count(distinct ${species.slug})` })
    .from(species)
    .innerJoin(form, eq(form.speciesSlug, species.slug))
    .where(and(scopeCond, sql`not (${notGigantamax(form.formName)})`));
  const total = totalRows[0]?.c ?? 0;

  const missingRows = await db
    .selectDistinct({ slug: species.slug, name: species.name, dexNumber: species.dexNumber })
    .from(species)
    .innerJoin(form, eq(form.speciesSlug, species.slug))
    .where(
      and(
        scopeCond,
        sql`not (${notGigantamax(form.formName)})`,
        exists(
          db
            .select({ one: sql`1` })
            .from(form)
            .leftJoin(formPersonal, eq(formPersonal.formSlug, form.slug))
            .where(and(eq(form.speciesSlug, species.slug), sql`not (${notGigantamax(form.formName)})`, or(isNull(formPersonal.caught), eq(formPersonal.caught, false)))),
        ),
      ),
    );
  const missingSpecies = toMissing(missingRows);
  return { total, complete: total - missingSpecies.length, missingSpecies };
}

async function costumeCompleteLens(db: DrizzleDb, scope: CompletionScope): Promise<Omit<CompletionLensResult, "lens">> {
  const scopeCond = scopeCondition(scope);
  const totalRows = await db
    .select({ c: sql<number>`count(distinct ${species.slug})` })
    .from(species)
    .innerJoin(form, eq(form.speciesSlug, species.slug))
    .where(and(scopeCond, sql`${form.costumeName} is not null`));
  const total = totalRows[0]?.c ?? 0;

  const missingRows = await db
    .selectDistinct({ slug: species.slug, name: species.name, dexNumber: species.dexNumber })
    .from(species)
    .innerJoin(form, eq(form.speciesSlug, species.slug))
    .where(
      and(
        scopeCond,
        sql`${form.costumeName} is not null`,
        exists(
          db
            .select({ one: sql`1` })
            .from(form)
            .leftJoin(formPersonal, eq(formPersonal.formSlug, form.slug))
            .where(and(eq(form.speciesSlug, species.slug), sql`${form.costumeName} is not null`, or(isNull(formPersonal.caught), eq(formPersonal.caught, false)))),
        ),
      ),
    );
  const missingSpecies = toMissing(missingRows);
  return { total, complete: total - missingSpecies.length, missingSpecies };
}

async function megaCompleteLens(db: DrizzleDb, scope: CompletionScope, shiny: boolean): Promise<Omit<CompletionLensResult, "lens">> {
  const column = shiny ? megaPersonal.shinyEvolved : megaPersonal.evolved;
  const scopeCond = scopeCondition(scope);
  const totalRows = await db
    .select({ c: sql<number>`count(distinct ${species.slug})` })
    .from(species)
    .innerJoin(megaVariant, eq(megaVariant.speciesSlug, species.slug))
    .where(scopeCond);
  const total = totalRows[0]?.c ?? 0;

  const missingRows = await db
    .selectDistinct({ slug: species.slug, name: species.name, dexNumber: species.dexNumber })
    .from(species)
    .innerJoin(megaVariant, eq(megaVariant.speciesSlug, species.slug))
    .where(
      and(
        scopeCond,
        exists(
          db
            .select({ one: sql`1` })
            .from(megaVariant)
            .leftJoin(megaPersonal, eq(megaPersonal.megaVariantSlug, megaVariant.slug))
            .where(and(eq(megaVariant.speciesSlug, species.slug), or(isNull(column), eq(column, false)))),
        ),
      ),
    );
  const missingSpecies = toMissing(missingRows);
  return { total, complete: total - missingSpecies.length, missingSpecies };
}

async function achievementLens(db: DrizzleDb, scope: CompletionScope, field: FormPersonalBooleanField): Promise<Omit<CompletionLensResult, "lens">> {
  if (!FORM_PERSONAL_BOOLEAN_FIELDS.includes(field)) throw new Error(`Unknown achievement field: ${field}`);
  const column = formPersonal[field as keyof typeof formPersonal] as typeof formPersonal.caught;
  void FORM_PERSONAL_FIELD_COLUMNS; // column resolved via the typed table object directly, not a snake_case string

  const scopeCond = scopeCondition(scope);
  const total = await countSpecies(db, scopeCond);
  const missingRows = await db
    .select({ slug: species.slug, name: species.name, dexNumber: species.dexNumber })
    .from(species)
    .where(
      and(
        scopeCond,
        notExists(
          db
            .select({ one: sql`1` })
            .from(form)
            .innerJoin(formPersonal, eq(formPersonal.formSlug, form.slug))
            .where(and(eq(form.speciesSlug, species.slug), eq(column, true))),
        ),
      ),
    );
  const missingSpecies = toMissing(missingRows);
  return { total, complete: total - missingSpecies.length, missingSpecies };
}

export async function getCompletionStatsSql(
  _db: SQLiteDBConnection,
  scope: CompletionScope,
  lenses: CompletionLens[],
  excludeRegionalFromFormComplete: boolean,
): Promise<CompletionLensResult[]> {
  const db = await getDrizzleDb();
  const results: CompletionLensResult[] = [];
  for (const lens of lenses) {
    const partial =
      lens.kind === "registered"
        ? await registeredLens(db, scope)
        : lens.kind === "formComplete"
          ? await formCompleteLens(db, scope, excludeRegionalFromFormComplete)
          : lens.kind === "costumeComplete"
            ? await costumeCompleteLens(db, scope)
            : lens.kind === "gigantamaxComplete"
              ? await gigantamaxCompleteLens(db, scope)
              : lens.kind === "megaComplete"
                ? await megaCompleteLens(db, scope, false)
                : lens.kind === "megaShinyComplete"
                  ? await megaCompleteLens(db, scope, true)
                  : await achievementLens(db, scope, lens.field);
    results.push({ lens, ...partial });
  }
  return results;
}
```

- [ ] **Step 2: Re-run Task 1's snapshot test against the rewritten implementation**

Run: `npm run test -- test/completion-stats-sql.test.ts`
Expected: all tests PASS, unchanged from Task 1's baseline run — same assertions, now exercising the Drizzle implementation.

- [ ] **Step 3: Typecheck and lint**

Run: `npx tsc -b && npm run lint`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/data/completion-stats-sql.ts test/completion-stats-sql.test.ts
git commit -m "Rewrite completion-stats-sql.ts on Drizzle's query builder"
```

---

## Task 3: Rewrite `reference-sync.ts`'s insert path with Drizzle batch inserts

**Files:**
- Modify: `src/db/reference-sync.ts`

**Interfaces:**
- Consumes: every table export from `src/db/schema/reference.ts` (Plan 1, Task 3); `getDrizzleDb()` (Plan 1, Task 5).
- Produces: same exported `syncReferenceData(db: SQLiteDBConnection, referenceData: ReferenceData): Promise<void>` signature — `src/main.ts`'s boot path call site is unchanged.

- [ ] **Step 1: Replace the `for (const x of referenceData.y) { await db.run(...) }` blocks with batched inserts**

Keep everything before the insert section (hash comparison, `applySlugRenames`, `quarantineOrphans`, the `DROP TABLE`/`REFERENCE_SCHEMA_SQL` recreation, and the final `app_settings` upsert) exactly as-is — only the insert calls change. Replace each block, for example:

```ts
// Before:
for (const region of referenceData.regions) {
  await db.run("INSERT INTO regions (slug, name) VALUES (?, ?)", [region.slug, region.name], false);
}

// After:
const drizzleDb = await getDrizzleDb();
if (referenceData.regions.length > 0) {
  await drizzleDb.insert(regions).values(referenceData.regions.map((r) => ({ slug: r.slug, name: r.name }))).run();
}
```

Apply the same pattern for every reference table's insert loop (`types`, `backgrounds`, `species`, `form`, `formTypes`, `megaVariant`, `move`, `formMove`, `speciesEvolution`, `typeEffectiveness`, `weatherBoost`, `playerLevel`, `playerLevelReward`, `medal`, `medalTier`, `friendshipLevel`, `pvpRankReward`, `pvpRankRequirement`, `raidBoss`, `raidBossWeatherBoost`, `communityDay`, `communityDayBonus`, `communityDaySpecies`, `communityDayEventMove`), mapping each camelCase `ReferenceData` field to the matching Drizzle column names from `schema/reference.ts` (e.g. `s.dexNumber` → `dexNumber`, `s.hasMale` → `hasMale` as a real boolean, not the old manual `b(value)` 0/1 conversion — Drizzle's boolean mode handles that encoding now, so the local `b()` helper in this file is deleted). Guard every batch with `if (rows.length > 0)` — Drizzle's `.values([])` on an empty array throws, unlike the old loop which was simply a no-op over zero iterations.

Add the necessary imports at the top of the file:

```ts
import { getDrizzleDb } from "./drizzle-client";
import {
  backgrounds, communityDay, communityDayBonus, communityDayEventMove, communityDaySpecies,
  form, formMove, formTypes, friendshipLevel, medal, medalTier, megaVariant, move,
  playerLevel, playerLevelReward, pvpRankRequirement, pvpRankReward, raidBoss,
  raidBossWeatherBoost, regions, species, speciesEvolution, typeEffectiveness, types, weatherBoost,
} from "./schema/reference";
```

Remove the now-unused `const b = (value: boolean) => (value ? 1 : 0);` line.

- [ ] **Step 2: Run the existing reference-sync test suite**

Run: `npm run test -- test/reference-sync.test.ts`
Expected: all existing tests PASS unmodified — this task doesn't change `reference-sync.ts`'s externally observable behavior, only how the inserts are issued internally.

- [ ] **Step 3: Typecheck and lint**

Run: `npx tsc -b && npm run lint`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/db/reference-sync.ts
git commit -m "Rewrite reference-sync.ts's insert path on Drizzle's query builder"
```

---

## Task 4: Update `scripts/build-dummy-db.ts` to build from the Drizzle schema

**Files:**
- Modify: `scripts/build-dummy-db.ts`

**Interfaces:**
- Consumes: `REFERENCE_SCHEMA_SQL` is no longer the DDL source for this script's reference tables — reference tables are still wholesale-created via raw SQL (Plan 1 kept `schema/reference.ts` query-only, with no drizzle-kit-generated migration file to run instead), so this task only changes the **personal** table creation path, which now must go through `runPersonalMigrations`-equivalent logic rather than the deleted `PERSONAL_SCHEMA_SQL`.

- [ ] **Step 1: Replace the personal-schema creation call**

Change:

```ts
db.exec(REFERENCE_SCHEMA_SQL);
db.exec(PERSONAL_SCHEMA_SQL);
```

to:

```ts
import { runPersonalMigrations } from "../src/db/migrations";
import { nodeSqliteConnection } from "../test/node-sqlite-connection";
// ...
db.exec(REFERENCE_SCHEMA_SQL);
await runPersonalMigrations(nodeSqliteConnection(db));
```

This requires wrapping the rest of the script's top-level statements in an async IIFE or converting the module to top-level `await` (this repo's `tsconfig.json` already sets `"module": "ESNext"`, which supports top-level await under `tsx`) — confirm by running the script (Step 3) rather than assuming.

Remove the now-unused `PERSONAL_SCHEMA_SQL, CURRENT_PERSONAL_SCHEMA_VERSION, DEFAULT_PROFILE_ID, DEFAULT_PROFILE_USERNAME` imports from `../src/db/schema` and the two `db.prepare("INSERT INTO schema_version ...")` / `db.prepare("INSERT INTO profile ...")` calls below — `runPersonalMigrations` now seeds both.

- [ ] **Step 2: Update remaining personal-table inserts (species_personal, form_personal, etc.) to use epoch-ms timestamps**

The demo-seed data (`src/data/personal-demo-seed.ts`) supplies ISO strings for `updatedAt` fields (unchanged — that file is out of this plan's scope per Plan 1's `types.ts`-stays note). Where this script inserts those values into now-INTEGER timestamp columns, convert at the insert site:

```ts
insertAll(
  "species_personal",
  ["species_slug", "registered", "xxl", "xxs", "purified", "updated_at"],
  speciesPersonal.map((sp) => ({
    species_slug: sp.speciesSlug,
    registered: b(sp.registered),
    xxl: b(sp.xxl),
    xxs: b(sp.xxs),
    purified: b(sp.purified),
    updated_at: new Date(sp.updatedAt).getTime(),
  })),
);
```

Apply the same `new Date(x).getTime()` conversion to every other `updated_at`/`created_at` value inserted later in this script (`form_personal`, `form_background_personal`, `mega_personal`, and the `profile` row's `created_at` — note the `profile` insert is now handled by `runPersonalMigrations` from Step 1, so only `form_personal`/`form_background_personal`/`mega_personal` need this change here).

- [ ] **Step 3: Run and inspect the output**

Run: `npm run build:dummy-db`
Expected: completes without error, writes `dummy.sqlite`. Open it (`sqlite3 dummy.sqlite ".schema species_personal"`) and confirm `updated_at` is `INTEGER`, not `TEXT`.

- [ ] **Step 4: Commit**

```bash
git add scripts/build-dummy-db.ts
git commit -m "Update build-dummy-db.ts for the Drizzle-based personal schema"
```

---

## Task 5: Documentation updates

**Files:**
- Modify: `docs/architecture.md`
- Modify: `docs/data-model.md`
- Modify: `docs/commands.md`

- [ ] **Step 1: Update `docs/architecture.md`'s DB layer table**

In the `## DB layer (\`src/db/\`)` table, change the `schema.ts` row's description to note it now only holds `REFERENCE_SCHEMA_SQL` (personal DDL moved to `schema/personal.ts`), and add two new rows:

```markdown
| `schema/personal.ts` | Drizzle schema for personal tables — the sole input to `npm run db:generate`; single source of truth for these tables' shape and TS types (`$inferSelect`/`$inferInsert`). |
| `schema/reference.ts` | Drizzle schema for reference tables, for typed queries only — deliberately excluded from drizzle-kit's schema path since these tables are wholesale-replaced by `reference-sync.ts`, never migrated. |
| `drizzle-client.ts` | Wraps the existing `SQLiteDBConnection` (from `sqlite-client.ts`) in Drizzle's `sqlite-proxy` driver — `getDrizzleDb()` is what `migrations.ts` and the query layer both import. |
```

Update the `migrations.ts` row's description to: "Runs `drizzle-orm/sqlite-proxy/migrator`'s `migrate()` against generated SQL under `src/db/migrations/`, with a one-time bootstrap for devices that shipped before this system existed — see docs/data-model.md's migration-runner section."

- [ ] **Step 2: Update `docs/data-model.md`**

Add a new subsection under "Versioning policy", after the `reference_data_version` bullet:

```markdown
### Migration runner (Drizzle)

Personal-table migrations are generated by drizzle-kit (`npm run db:generate`, reading `src/db/schema/personal.ts`) and applied by `drizzle-orm/sqlite-proxy/migrator`'s `migrate()`, tracked in Drizzle's own `__drizzle_migrations` table — this replaced a hand-rolled versioned runner (`schema_version` + a manually-written `MIGRATIONS` array) that shipped through v1.0.0. Devices that installed before this change are bootstrapped once: `src/db/migrations.ts` detects the old `schema_version` table, converts every timestamp column's stored ISO-string values to epoch milliseconds (personal-table timestamps moved from `TEXT` to Drizzle's `integer({ mode: 'timestamp_ms' })`), and seeds `__drizzle_migrations` with a row matching migration `0000` (the schema as of that shipped version) before any further migration runs. See `src/db/migrations.ts`'s module comment for the exact mechanism.

Reference tables are **not** part of this migration system — `src/db/schema/reference.ts` exists only for typed queries, and drizzle-kit's config (`drizzle.config.ts`) only ever points at `schema/personal.ts`. Reference tables keep the existing wholesale drop/recreate model (`reference-sync.ts`).
```

- [ ] **Step 3: Update `docs/commands.md`**

Add `npm run db:generate` to whatever command-reference table/list already documents `npm run version:bump`/`npm run build:dummy-db`, with the description: "Generates a SQL migration file under `src/db/migrations/` from any changes to `src/db/schema/personal.ts`, via drizzle-kit. Run after editing that file; hand-verify the generated SQL before committing, per docs/data-model.md's migration-runner section."

- [ ] **Step 4: Commit**

```bash
git add docs/architecture.md docs/data-model.md docs/commands.md
git commit -m "Document the Drizzle schema/migration split"
```

---

## Task 6: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Full test suite**

Run: `npm run test`
Expected: all tests PASS, including both plans' new tests (`test/drizzle-v6-bootstrap.test.ts`, `test/completion-stats-sql.test.ts`, updated `test/migrations.test.ts`, unmodified `test/reference-sync.test.ts`, `test/export-import-round-trip.test.ts`).

- [ ] **Step 2: Typecheck**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 4: Manual smoke test — run the real app**

Run: `npm run dev`, open the app in a browser, and check: the Stats page loads and shows completion numbers for at least one lens (exercises the rewritten `completion-stats-sql.ts`), and reloading the page doesn't error (exercises `runPersonalMigrations` + `syncReferenceData` on a real `sql.js`/IndexedDB-backed connection, not just the `node:sqlite` test adapter).

- [ ] **Step 5: Commit any fixups, then this plan is done**

```bash
git add -A
git commit -m "Fix up fallout from Drizzle query-layer rewrite"
```
