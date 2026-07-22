# Drizzle Schema & Migration Runner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `src/db/schema.ts`'s hand-written personal-table DDL and `src/db/migrations.ts`'s hand-rolled versioned runner with Drizzle schema definitions + drizzle-kit generated migrations, executed through `drizzle-orm/sqlite-proxy`, while safely bootstrapping already-shipped v6 devices into the new migration-tracking table without replaying DDL against tables that already have those columns.

**Architecture:** Personal tables move to a Drizzle `sqliteTable()` schema (`src/db/schema/personal.ts`) that drizzle-kit diffs to generate SQL migration files under `src/db/migrations/`. Reference tables get a parallel Drizzle schema (`src/db/schema/reference.ts`) for typed queries only — excluded from drizzle-kit's config, since they're wholesale-replaced by `reference-sync.ts`, never migrated. A new `src/db/drizzle-client.ts` wraps the existing `SQLiteDBConnection` (from `src/db/sqlite-client.ts`, unchanged) in Drizzle's `sqlite-proxy` driver. `src/db/migrations.ts` is rewritten to run `drizzle-orm/sqlite-proxy/migrator`'s `migrate()`, with a one-time bootstrap step that seeds Drizzle's `__drizzle_migrations` tracking table for devices already at personal-schema v6, so they're treated as caught up to migration `0000` without replaying it.

**Tech Stack:** `drizzle-orm` (stable `0.44.x`), `drizzle-kit` (dev dependency), existing `@capacitor-community/sqlite` connection, existing `node:sqlite`-backed test adapter (`test/node-sqlite-connection.ts`).

## Global Constraints

- Pin `drizzle-orm` to a stable `0.44.x` release (not the `1.0.0-rc` prerelease line) and `drizzle-kit@0.31.x`.
- `drizzle.config.ts`'s `schema` path covers **only** `src/db/schema/personal.ts` — reference tables must never appear in a generated migration.
- Every personal-table timestamp column (`created_at`, `updated_at`, `recorded_at`, `caught_at`, `quarantined_at`) uses Drizzle's `integer({ mode: 'timestamp_ms' })` — stores/reads as Unix epoch milliseconds, replacing today's ISO-string `TEXT` columns. This is a real on-disk format change requiring a data-converting migration for existing devices (Task 6), not just a schema-declaration change.
- Every existing `INTEGER ... CHECK (x IN (0,1))` boolean column becomes `integer({ mode: 'boolean' })` **plus** an explicit `check()` constraint reproducing the same `IN (0, 1)` SQL — Drizzle's boolean mode only affects the JS↔SQLite encode/decode boundary, it does not emit a CHECK constraint on its own, and the design spec requires migration `0000` to reproduce today's schema exactly.
- `payload_json` (`personal_data_quarantine`) uses `integer`-free `text({ mode: 'json' })`.
- Columns that reference a **reference table** (`species.slug`, `form.slug`, `mega_variant.slug`, `backgrounds.slug`, `medal.slug`, `player_level.level`) are declared as plain columns in `schema/personal.ts` **without** Drizzle's `.references()` — the referenced tables live in `schema/reference.ts`, deliberately outside drizzle-kit's schema path, and `.references()` requires the target table to be part of the same generate run. The `REFERENCES` SQL clause for these columns is added back by hand-editing the generated migration file (Task 4) so runtime FK enforcement is unchanged.
- No change to `src/db/sqlite-client.ts`, the native/web platform split, or `src/data/in-memory-store.ts`.
- `src/db/types.ts` (the hand-written camelCase mirror) is **not deleted** in this plan, despite the original design note — it's still the type source for `in-memory-store.ts`, `defaults.ts`, `personal-demo-seed.ts`, `field-groups.ts`, and `repository.ts`, none of which this plan touches. Only the Drizzle-facing modules built in this plan (`migrations.ts`, and Plan 2's `completion-stats-sql.ts`/`reference-sync.ts`) use Drizzle's `$inferSelect`/`$inferInsert` types. Reconciling `types.ts` fully into Drizzle's inferred types, if wanted later, is a separate follow-up plan.

---

## Task 1: Add Drizzle tooling

**Files:**
- Modify: `package.json`
- Create: `drizzle.config.ts`

**Interfaces:**
- Produces: `npm run db:generate` script; `drizzle.config.ts` default export consumed by drizzle-kit's CLI (not imported by app code).

- [ ] **Step 1: Install pinned packages**

```bash
npm install drizzle-orm@0.44.6
npm install -D drizzle-kit@0.31.10
```

- [ ] **Step 2: Add the `db:generate` script**

Edit `package.json`'s `scripts` block, adding this line after `"version:bump"`:

```json
    "db:generate": "drizzle-kit generate",
```

- [ ] **Step 3: Write `drizzle.config.ts`**

```ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema/personal.ts",
  out: "./src/db/migrations",
});
```

- [ ] **Step 4: Verify the CLI resolves the (not-yet-created) config without crashing on the missing schema file**

Run: `npx drizzle-kit generate`
Expected: fails with a "Cannot find module './src/db/schema/personal.ts'" or similar — confirms the config itself loads. This is expected to fail; Task 2 creates that file.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json drizzle.config.ts
git commit -m "Add drizzle-orm/drizzle-kit tooling"
```

---

## Task 2: Write the personal-table Drizzle schema

**Files:**
- Create: `src/db/schema/personal.ts`

**Interfaces:**
- Produces: `sqliteTable` exports — `appSettings`, `profile`, `speciesPersonal`, `formPersonal`, `formBackgroundPersonal`, `megaPersonal`, `pokemonInstance`, `tag`, `pokemonInstanceTag`, `pokemonInstanceMaxMove`, `playerProgressPersonal`, `medalProgressPersonal`, `playerProgressLog`, `personalDataQuarantine` — each with Drizzle's inferred `.$inferSelect`/`.$inferInsert` types, consumed by Task 5 (migrations.ts) and Plan 2.

- [ ] **Step 1: Write the schema file**

```ts
// Drizzle schema for GoBuddy's personal tables — the sole input to
// `npm run db:generate` (see drizzle.config.ts). Column names stay
// snake_case to match the existing on-disk schema; Drizzle's inferred
// $inferSelect/$inferInsert types are camelCase automatically.
//
// Columns that reference a row in a *reference* table (species.slug,
// form.slug, mega_variant.slug, backgrounds.slug, medal.slug,
// player_level.level) are plain columns here, not Drizzle `.references()`
// calls — those tables live in schema/reference.ts, deliberately excluded
// from drizzle-kit's schema path (they're wholesale-replaced by
// reference-sync.ts, never migrated). The REFERENCES SQL for these columns
// is restored by hand in the generated migration file — see
// src/db/migrations/0000_baseline.sql's header comment.

import { check, integer, primaryKey, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import type { AnySQLiteColumn } from "drizzle-orm/sqlite-core";

// Builds one check() constraint per boolean column, named `<table>_<column>_bool`,
// reproducing today's `CHECK (x IN (0, 1))` — used inline in each table's
// constraints callback below.
function boolChecks(tableName: string, columns: Record<string, AnySQLiteColumn>): Record<string, ReturnType<typeof check>> {
  return Object.fromEntries(
    Object.entries(columns).map(([name, col]) => [`${name}Check`, check(`${tableName}_${name}_bool`, sql`${col} IN (0, 1)`)]),
  );
}

export const appSettings = sqliteTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const profile = sqliteTable("profile", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull(),
  friendCode: text("friend_code"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const speciesPersonal = sqliteTable(
  "species_personal",
  {
    speciesSlug: text("species_slug").primaryKey(),
    profileId: integer("profile_id").notNull().default(1),
    registered: integer("registered", { mode: "boolean" }).notNull().default(false),
    xxl: integer("xxl", { mode: "boolean" }).notNull().default(false),
    xxs: integer("xxs", { mode: "boolean" }).notNull().default(false),
    purified: integer("purified", { mode: "boolean" }).notNull().default(false),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => boolChecks("species_personal", { registered: table.registered, xxl: table.xxl, xxs: table.xxs, purified: table.purified }),
);

export const formPersonal = sqliteTable(
  "form_personal",
  {
    formSlug: text("form_slug").primaryKey(),
    profileId: integer("profile_id").notNull().default(1),

    caught: integer("caught", { mode: "boolean" }).notNull().default(false),
    shiny: integer("shiny", { mode: "boolean" }).notNull().default(false),
    floor: integer("floor", { mode: "boolean" }).notNull().default(false),
    fourStar: integer("four_star", { mode: "boolean" }).notNull().default(false),
    shundo: integer("shundo", { mode: "boolean" }).notNull().default(false),

    lucky: integer("lucky", { mode: "boolean" }).notNull().default(false),
    luckyShiny: integer("lucky_shiny", { mode: "boolean" }).notNull().default(false),
    luckyFloor: integer("lucky_floor", { mode: "boolean" }).notNull().default(false),
    luckyFourStar: integer("lucky_four_star", { mode: "boolean" }).notNull().default(false),
    luckyShundo: integer("lucky_shundo", { mode: "boolean" }).notNull().default(false),

    shadow: integer("shadow", { mode: "boolean" }).notNull().default(false),
    shadowShiny: integer("shadow_shiny", { mode: "boolean" }).notNull().default(false),
    shadowFloor: integer("shadow_floor", { mode: "boolean" }).notNull().default(false),
    shadowFourStar: integer("shadow_four_star", { mode: "boolean" }).notNull().default(false),
    shadowShundo: integer("shadow_shundo", { mode: "boolean" }).notNull().default(false),

    dynamax: integer("dynamax", { mode: "boolean" }).notNull().default(false),
    dynamaxFloor: integer("dynamax_floor", { mode: "boolean" }).notNull().default(false),
    dynamaxShiny: integer("dynamax_shiny", { mode: "boolean" }).notNull().default(false),
    dynamaxFourStar: integer("dynamax_four_star", { mode: "boolean" }).notNull().default(false),
    dynamaxShundo: integer("dynamax_shundo", { mode: "boolean" }).notNull().default(false),

    luckyDynamax: integer("lucky_dynamax", { mode: "boolean" }).notNull().default(false),
    luckyDynamaxFloor: integer("lucky_dynamax_floor", { mode: "boolean" }).notNull().default(false),
    luckyDynamaxShiny: integer("lucky_dynamax_shiny", { mode: "boolean" }).notNull().default(false),
    luckyDynamaxFourStar: integer("lucky_dynamax_four_star", { mode: "boolean" }).notNull().default(false),
    luckyDynamaxShundo: integer("lucky_dynamax_shundo", { mode: "boolean" }).notNull().default(false),

    bestShiny: text("best_shiny"),
    bestNonShiny: text("best_non_shiny"),
    bestLucky: text("best_lucky"),

    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) =>
    boolChecks("form_personal", {
      caught: table.caught,
      shiny: table.shiny,
      floor: table.floor,
      fourStar: table.fourStar,
      shundo: table.shundo,
      lucky: table.lucky,
      luckyShiny: table.luckyShiny,
      luckyFloor: table.luckyFloor,
      luckyFourStar: table.luckyFourStar,
      luckyShundo: table.luckyShundo,
      shadow: table.shadow,
      shadowShiny: table.shadowShiny,
      shadowFloor: table.shadowFloor,
      shadowFourStar: table.shadowFourStar,
      shadowShundo: table.shadowShundo,
      dynamax: table.dynamax,
      dynamaxFloor: table.dynamaxFloor,
      dynamaxShiny: table.dynamaxShiny,
      dynamaxFourStar: table.dynamaxFourStar,
      dynamaxShundo: table.dynamaxShundo,
      luckyDynamax: table.luckyDynamax,
      luckyDynamaxFloor: table.luckyDynamaxFloor,
      luckyDynamaxShiny: table.luckyDynamaxShiny,
      luckyDynamaxFourStar: table.luckyDynamaxFourStar,
      luckyDynamaxShundo: table.luckyDynamaxShundo,
    }),
);

export const formBackgroundPersonal = sqliteTable(
  "form_background_personal",
  {
    formSlug: text("form_slug").notNull(),
    profileId: integer("profile_id").notNull().default(1),
    achievementField: text("achievement_field").notNull(),
    backgroundSlug: text("background_slug").notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.formSlug, table.achievementField, table.backgroundSlug] }),
  }),
);

export const megaPersonal = sqliteTable(
  "mega_personal",
  {
    megaVariantSlug: text("mega_variant_slug").primaryKey(),
    profileId: integer("profile_id").notNull().default(1),
    evolved: integer("evolved", { mode: "boolean" }).notNull().default(false),
    shinyEvolved: integer("shiny_evolved", { mode: "boolean" }).notNull().default(false),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => boolChecks("mega_personal", { evolved: table.evolved, shinyEvolved: table.shinyEvolved }),
);

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
    ivPercent: integer("iv_percent"),
    shiny: integer("shiny", { mode: "boolean" }).notNull().default(false),
    lucky: integer("lucky", { mode: "boolean" }).notNull().default(false),
    shadow: integer("shadow", { mode: "boolean" }).notNull().default(false),
    purified: integer("purified", { mode: "boolean" }).notNull().default(false),
    heartsEarned: integer("hearts_earned"),
    currentMegaLevel: integer("current_mega_level"),
    nickname: text("nickname"),
    backgroundSlug: text("background_slug"),
  },
  (table) => boolChecks("pokemon_instance", { shiny: table.shiny, lucky: table.lucky, shadow: table.shadow, purified: table.purified }),
);

export const tag = sqliteTable(
  "tag",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    profileId: integer("profile_id").notNull(),
    name: text("name").notNull(),
  },
  (table) => ({
    profileNameUnique: unique("tag_profile_id_name_unique").on(table.profileId, table.name),
  }),
);

export const pokemonInstanceTag = sqliteTable(
  "pokemon_instance_tag",
  {
    pokemonInstanceId: integer("pokemon_instance_id").notNull(),
    tagId: integer("tag_id").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.pokemonInstanceId, table.tagId] }),
  }),
);

export const pokemonInstanceMaxMove = sqliteTable(
  "pokemon_instance_max_move",
  {
    pokemonInstanceId: integer("pokemon_instance_id").notNull(),
    moveSlot: text("move_slot").notNull(),
    level: integer("level"),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.pokemonInstanceId, table.moveSlot] }),
  }),
);

export const playerProgressPersonal = sqliteTable("player_progress_personal", {
  profileId: integer("profile_id").primaryKey(),
  currentLevel: integer("current_level"),
  totalXp: integer("total_xp"),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const medalProgressPersonal = sqliteTable(
  "medal_progress_personal",
  {
    medalSlug: text("medal_slug").notNull(),
    profileId: integer("profile_id").notNull().default(1),
    currentRank: integer("current_rank").notNull().default(0),
    currentCount: integer("current_count").notNull().default(0),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.medalSlug, table.profileId] }),
  }),
);

export const playerProgressLog = sqliteTable("player_progress_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  profileId: integer("profile_id").notNull().default(1),
  recordedAt: integer("recorded_at", { mode: "timestamp_ms" }).notNull(),
  currentLevel: integer("current_level"),
  totalXp: integer("total_xp"),
});

export const personalDataQuarantine = sqliteTable("personal_data_quarantine", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sourceTable: text("source_table").notNull(),
  slug: text("slug").notNull(),
  payloadJson: text("payload_json", { mode: "json" }).notNull(),
  quarantinedAt: integer("quarantined_at", { mode: "timestamp_ms" }).notNull(),
});
```

- [ ] **Step 2: Typecheck the new file in isolation**

Run: `npx tsc --noEmit src/db/schema/personal.ts --strict --module ESNext --moduleResolution Bundler --target ES2022 --skipLibCheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/db/schema/personal.ts
git commit -m "Add Drizzle schema for personal tables"
```

---

## Task 3: Write the reference-table Drizzle schema (query-only, no migrations)

**Files:**
- Create: `src/db/schema/reference.ts`

**Interfaces:**
- Produces: `sqliteTable` exports — `regions`, `types`, `backgrounds`, `species`, `form`, `formTypes`, `megaVariant`, `move`, `formMove`, `speciesEvolution`, `typeEffectiveness`, `weatherBoost`, `playerLevel`, `playerLevelReward`, `medal`, `medalTier`, `friendshipLevel`, `pvpRankReward`, `pvpRankRequirement`, `raidBoss`, `raidBossWeatherBoost`, `communityDay`, `communityDayBonus`, `communityDaySpecies`, `communityDayEventMove` — consumed by Plan 2's query-layer rewrite. **Not** referenced by `drizzle.config.ts`.

- [ ] **Step 1: Write the schema file**

```ts
// Drizzle schema for GoBuddy's reference tables — for typed queries only
// (see Plan 2). Deliberately NOT part of drizzle.config.ts's schema path:
// these tables are wholesale dropped/recreated by src/db/reference-sync.ts
// on every reference-data update, never incrementally migrated, so
// drizzle-kit must never diff or generate migrations for them.

import { integer, primaryKey, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const regions = sqliteTable("regions", {
  slug: text("slug").primaryKey(),
  name: text("name").notNull(),
});

export const types = sqliteTable("types", {
  slug: text("slug").primaryKey(),
  name: text("name").notNull(),
});

export const backgrounds = sqliteTable("backgrounds", {
  slug: text("slug").primaryKey(),
  name: text("name").notNull(),
});

export const species = sqliteTable("species", {
  slug: text("slug").primaryKey(),
  dexNumber: integer("dex_number").notNull(),
  name: text("name").notNull(),
  familySlug: text("family_slug").notNull(),
  gen: integer("gen").notNull(),
  rarity: text("rarity", { enum: ["standard", "legendary", "mythical", "ultra_beast"] }).notNull(),
  regionSlug: text("region_slug").notNull(),
  hasMale: integer("has_male", { mode: "boolean" }).notNull(),
  hasFemale: integer("has_female", { mode: "boolean" }).notNull(),
  canMegaEvolve: integer("can_mega_evolve", { mode: "boolean" }).notNull(),
  canGigantamax: integer("can_gigantamax", { mode: "boolean" }).notNull(),
});

export const form = sqliteTable("form", {
  slug: text("slug").primaryKey(),
  speciesSlug: text("species_slug").notNull(),
  formName: text("form_name").notNull(),
  costumeName: text("costume_name"),
  gender: text("gender", { enum: ["male", "female", "unknown"] }).notNull(),
  evolves: integer("evolves", { mode: "boolean" }).notNull(),
  shinyAvailable: integer("shiny_available", { mode: "boolean" }).notNull(),
  shadowAvailable: integer("shadow_available", { mode: "boolean" }).notNull(),
  dynamaxAvailable: integer("dynamax_available", { mode: "boolean" }).notNull(),
  regionalExclusive: integer("regional_exclusive", { mode: "boolean" }).notNull(),
  imageRef: text("image_ref"),
});

export const formTypes = sqliteTable(
  "form_types",
  {
    formSlug: text("form_slug").notNull(),
    typeSlug: text("type_slug").notNull(),
  },
  (table) => ({ pk: primaryKey({ columns: [table.formSlug, table.typeSlug] }) }),
);

export const megaVariant = sqliteTable("mega_variant", {
  slug: text("slug").primaryKey(),
  speciesSlug: text("species_slug").notNull(),
  variant: text("variant", { enum: ["X", "Y", "Primal"] }),
});

export const move = sqliteTable("move", {
  slug: text("slug").primaryKey(),
  name: text("name").notNull(),
  category: text("category", { enum: ["fast", "charged"] }).notNull(),
  typeSlug: text("type_slug").notNull(),
  power: integer("power"),
  energyDelta: integer("energy_delta"),
  durationMs: integer("duration_ms"),
  pvpPower: integer("pvp_power"),
  pvpEnergyDelta: integer("pvp_energy_delta"),
  pvpTurns: integer("pvp_turns"),
});

export const formMove = sqliteTable(
  "form_move",
  {
    formSlug: text("form_slug").notNull(),
    moveSlug: text("move_slug").notNull(),
    isElite: integer("is_elite", { mode: "boolean" }).notNull().default(false),
  },
  (table) => ({ pk: primaryKey({ columns: [table.formSlug, table.moveSlug] }) }),
);

export const speciesEvolution = sqliteTable(
  "species_evolution",
  {
    fromSpeciesSlug: text("from_species_slug").notNull(),
    toSpeciesSlug: text("to_species_slug").notNull(),
    candyRequired: integer("candy_required"),
    itemRequired: text("item_required"),
  },
  (table) => ({ pk: primaryKey({ columns: [table.fromSpeciesSlug, table.toSpeciesSlug] }) }),
);

export const typeEffectiveness = sqliteTable(
  "type_effectiveness",
  {
    attackingTypeSlug: text("attacking_type_slug").notNull(),
    defendingTypeSlug: text("defending_type_slug").notNull(),
    multiplier: real("multiplier").notNull(),
  },
  (table) => ({ pk: primaryKey({ columns: [table.attackingTypeSlug, table.defendingTypeSlug] }) }),
);

export const weatherBoost = sqliteTable(
  "weather_boost",
  {
    weather: text("weather").notNull(),
    typeSlug: text("type_slug").notNull(),
  },
  (table) => ({ pk: primaryKey({ columns: [table.weather, table.typeSlug] }) }),
);

export const playerLevel = sqliteTable("player_level", {
  level: integer("level").primaryKey(),
  cumulativeXp: integer("cumulative_xp").notNull(),
});

export const playerLevelReward = sqliteTable(
  "player_level_reward",
  {
    level: integer("level").notNull(),
    sortOrder: integer("sort_order").notNull(),
    itemName: text("item_name").notNull(),
    amount: integer("amount").notNull(),
  },
  (table) => ({ pk: primaryKey({ columns: [table.level, table.sortOrder] }) }),
);

export const medal = sqliteTable("medal", {
  slug: text("slug").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  isEventMedal: integer("is_event_medal", { mode: "boolean" }).notNull(),
});

export const medalTier = sqliteTable(
  "medal_tier",
  {
    medalSlug: text("medal_slug").notNull(),
    rank: integer("rank").notNull(),
    target: integer("target"),
  },
  (table) => ({ pk: primaryKey({ columns: [table.medalSlug, table.rank] }) }),
);

export const friendshipLevel = sqliteTable("friendship_level", {
  level: integer("level").primaryKey(),
  name: text("name").notNull(),
  pointsRequired: integer("points_required").notNull(),
  xpReward: integer("xp_reward").notNull(),
  attackBonus: real("attack_bonus").notNull(),
  tradingDiscount: real("trading_discount").notNull(),
  raidBallBonus: real("raid_ball_bonus").notNull(),
});

export const pvpRankReward = sqliteTable(
  "pvp_rank_reward",
  {
    leagueRank: integer("league_rank").notNull(),
    track: text("track", { enum: ["free", "premium"] }).notNull(),
    sortOrder: integer("sort_order").notNull(),
    rewardType: text("reward_type").notNull(),
    itemName: text("item_name"),
    amount: integer("amount"),
  },
  (table) => ({ pk: primaryKey({ columns: [table.leagueRank, table.track, table.sortOrder] }) }),
);

export const pvpRankRequirement = sqliteTable("pvp_rank_requirement", {
  rank: integer("rank").primaryKey(),
  additionalBattlesRequired: integer("additional_battles_required"),
  additionalBattleWinsRequired: integer("additional_battle_wins_required"),
});

export const raidBoss = sqliteTable(
  "raid_boss",
  {
    tier: text("tier").notNull(),
    formSlug: text("form_slug").notNull(),
    minCp: integer("min_cp").notNull(),
    maxCp: integer("max_cp").notNull(),
    minBoostedCp: integer("min_boosted_cp").notNull(),
    maxBoostedCp: integer("max_boosted_cp").notNull(),
    possibleShiny: integer("possible_shiny", { mode: "boolean" }).notNull(),
  },
  (table) => ({ pk: primaryKey({ columns: [table.tier, table.formSlug] }) }),
);

export const raidBossWeatherBoost = sqliteTable(
  "raid_boss_weather_boost",
  {
    tier: text("tier").notNull(),
    formSlug: text("form_slug").notNull(),
    weather: text("weather").notNull(),
  },
  (table) => ({ pk: primaryKey({ columns: [table.tier, table.formSlug, table.weather] }) }),
);

export const communityDay = sqliteTable("community_day", {
  number: integer("number").primaryKey(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
});

export const communityDayBonus = sqliteTable(
  "community_day_bonus",
  {
    communityDayNumber: integer("community_day_number").notNull(),
    bonus: text("bonus").notNull(),
  },
  (table) => ({ pk: primaryKey({ columns: [table.communityDayNumber, table.bonus] }) }),
);

export const communityDaySpecies = sqliteTable(
  "community_day_species",
  {
    communityDayNumber: integer("community_day_number").notNull(),
    speciesSlug: text("species_slug").notNull(),
  },
  (table) => ({ pk: primaryKey({ columns: [table.communityDayNumber, table.speciesSlug] }) }),
);

export const communityDayEventMove = sqliteTable(
  "community_day_event_move",
  {
    communityDayNumber: integer("community_day_number").notNull(),
    speciesSlug: text("species_slug").notNull(),
    moveSlug: text("move_slug").notNull(),
  },
  (table) => ({ pk: primaryKey({ columns: [table.communityDayNumber, table.speciesSlug, table.moveSlug] }) }),
);
```

Note: `community_day_event_move`'s original SQL has no explicit `species_slug`/`move_slug` composite beyond the 3-column PK shown in `schema.ts` — matched here as-is.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit src/db/schema/reference.ts --strict --module ESNext --moduleResolution Bundler --target ES2022 --skipLibCheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/db/schema/reference.ts
git commit -m "Add Drizzle schema for reference tables (query-only)"
```

---

## Task 4: Generate and hand-verify the baseline migration `0000`

**Files:**
- Create (generated then hand-edited): `src/db/migrations/0000_baseline.sql`, `src/db/migrations/meta/0000_snapshot.json`, `src/db/migrations/meta/_journal.json`

**Interfaces:**
- Consumes: `src/db/schema/personal.ts` (Task 2).
- Produces: the migration file set Task 6's `migrate()` call reads via `readMigrationFiles()`.

- [ ] **Step 1: Generate**

Run: `npm run db:generate -- --name baseline`
Expected: creates `src/db/migrations/0000_baseline.sql` plus `src/db/migrations/meta/0000_snapshot.json` and `meta/_journal.json`.

- [ ] **Step 2: Hand-edit the generated SQL to restore cross-schema `REFERENCES` clauses**

Open `src/db/migrations/0000_baseline.sql`. For every column listed below, add the matching `REFERENCES` clause (drizzle-kit won't have generated these — see Task 2's note on why). Add this comment at the top of the file first:

```sql
-- Hand-edited after `npm run db:generate`: restores REFERENCES clauses
-- pointing at reference tables (species, form, mega_variant, backgrounds,
-- medal, player_level), which live in src/db/schema/reference.ts and are
-- deliberately excluded from drizzle-kit's schema path. Any future
-- drizzle-kit generate that touches one of the columns below must repeat
-- this hand-edit — drizzle-kit does not know these tables exist.
```

Then amend these columns (match against whatever column order drizzle-kit emitted):

- `species_personal.species_slug` → `REFERENCES species(slug)`
- `form_personal.form_slug` → `REFERENCES form(slug)`
- `form_background_personal.form_slug` → `REFERENCES form(slug)`
- `form_background_personal.background_slug` → `REFERENCES backgrounds(slug)`
- `mega_personal.mega_variant_slug` → `REFERENCES mega_variant(slug)`
- `pokemon_instance.form_slug` → `REFERENCES form(slug)`
- `pokemon_instance.background_slug` → `REFERENCES backgrounds(slug)`
- `medal_progress_personal.medal_slug` → `REFERENCES medal(slug)`
- `player_progress_personal.current_level` → `REFERENCES player_level(level)`
- every `profile_id` column → `REFERENCES profile(id)` (this one **is** in-schema — `profile` is in `schema/personal.ts` — confirm drizzle-kit already generated it; if not, add it)
- every `pokemon_instance_id` column (`pokemon_instance_tag`, `pokemon_instance_max_move`) → `REFERENCES pokemon_instance(id)` (in-schema, confirm auto-generated)
- `pokemon_instance_tag.tag_id` → `REFERENCES tag(id)` (in-schema, confirm auto-generated)

- [ ] **Step 3: Diff against today's `PERSONAL_SCHEMA_SQL` column-by-column**

Open `src/db/schema.ts`'s `PERSONAL_SCHEMA_SQL` side by side with the hand-edited `0000_baseline.sql`. Confirm, table by table: same column set, same nullability, same defaults (note: timestamp columns' defaults change from `'1970-01-01T00:00:00.000Z'` string literals to no default — Task 6 backfills real timestamps during the bootstrap, not via a column default), same `CHECK` constraints, same primary/foreign keys. Fix any mismatch directly in `0000_baseline.sql`.

- [ ] **Step 4: Commit**

```bash
git add src/db/migrations/
git commit -m "Generate and hand-verify baseline Drizzle migration 0000"
```

---

## Task 5: Wire the sqlite-proxy Drizzle client

**Files:**
- Create: `src/db/drizzle-client.ts`

**Interfaces:**
- Consumes: `getDb()` from `src/db/sqlite-client.ts` (returns `Promise<SQLiteDBConnection>`, unchanged).
- Produces: `getDrizzleDb(): Promise<SqliteRemoteDatabase>` — the `db` instance Task 6 and Plan 2's query layer both import.

- [ ] **Step 1: Write the client**

```ts
// Wraps the existing SQLiteDBConnection (see sqlite-client.ts — same
// connection object, no change to the native/web platform split) in
// Drizzle's sqlite-proxy driver, so Drizzle's query builder and migrator
// can run against it.

import { drizzle } from "drizzle-orm/sqlite-proxy";
import type { SqliteRemoteDatabase } from "drizzle-orm/sqlite-proxy";
import { getDb } from "./sqlite-client";

let dbPromise: Promise<SqliteRemoteDatabase> | null = null;

export function getDrizzleDb(): Promise<SqliteRemoteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const conn = await getDb();
      return drizzle(async (sqlText, params, method) => {
        if (method === "run") {
          await conn.run(sqlText, params, false);
          return { rows: [] };
        }
        const result = await conn.query(sqlText, params);
        const rows = (result.values ?? []) as Record<string, unknown>[];
        return { rows: method === "values" ? rows.map((r) => Object.values(r)) : rows };
      });
    })();
  }
  return dbPromise;
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit src/db/drizzle-client.ts --strict --module ESNext --moduleResolution Bundler --target ES2022 --skipLibCheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/db/drizzle-client.ts
git commit -m "Add sqlite-proxy Drizzle client wrapping the existing SQLite connection"
```

---

## Task 6: Rewrite the migration runner with the v6 bootstrap and timestamp conversion

**Files:**
- Modify: `src/db/migrations.ts` (full rewrite)
- Modify: `test/node-sqlite-connection.ts` (add a `values`/raw-array method needed by the proxy's `"values"` case — check first if the existing shape already covers it, per Step 1 below)

**Interfaces:**
- Consumes: `getDrizzleDb()` (Task 5), migration files under `src/db/migrations/` (Task 4).
- Produces: `runPersonalMigrations(db: SQLiteDBConnection): Promise<void>` — same exported name and signature as today, so `src/main.ts`'s boot path and `reference-sync.ts`'s call site (which runs after it) don't change.

- [ ] **Step 1: Confirm the test adapter supports `db.query` returning plain rows (no change needed)**

`test/node-sqlite-connection.ts`'s `query()` already returns `{ values: rows }` from `node:sqlite`'s `.all()` — sufficient for `getDrizzleDb()`'s proxy callback above. No edit needed to this file; this step is a verification, not a code change.

- [ ] **Step 2: Write the new `migrations.ts`**

```ts
// Personal-schema migration runner. Now a thin wrapper around
// drizzle-orm/sqlite-proxy's migrate(), with a one-time bootstrap for
// devices that shipped before this change (already at hand-rolled
// personal-schema v6 — see schema.ts's old CURRENT_PERSONAL_SCHEMA_VERSION
// and the removed MIGRATIONS array, preserved in git history).
//
// Bootstrap: a v6 device has a `schema_version` table (version = 6) but no
// `__drizzle_migrations` table yet. On first boot under this code, seed
// `__drizzle_migrations` with a row matching migration 0000's own
// timestamp/hash *before* calling migrate() — this tells Drizzle "this
// device is already caught up through 0000", so 0000's CREATE TABLE
// statements are never replayed against tables that already have those
// columns (which would error, or silently duplicate work). The old
// `schema_version` table is left in place afterward — unread, harmless.
//
// Timestamp conversion: migration 0000 declares every timestamp column as
// INTEGER (Drizzle's timestamp_ms mode), but a real v6 device's rows still
// hold ISO-string TEXT in those columns (SQLite's dynamic typing let the
// old TEXT columns silently keep string values even after the bootstrap
// treats the table as "already at 0000's shape"). convertTimestampColumns()
// rewrites every existing timestamp column's stored value from an ISO
// string to epoch milliseconds, run once as part of the same bootstrap
// step, before any Drizzle query ever reads these columns.

import type { SQLiteDBConnection } from "@capacitor-community/sqlite";
import { migrate } from "drizzle-orm/sqlite-proxy/migrator";
import { getDrizzleDb } from "./drizzle-client";
import journal from "./migrations/meta/_journal.json" with { type: "json" };

const MIGRATIONS_TABLE = "__drizzle_migrations";

// migration 0000's own timestamp, read from the journal drizzle-kit
// generated (Task 4) rather than hand-copied — a hand-copied constant is
// exactly the kind of value that silently drifts from the real migration
// files. Its hash isn't read from the journal (drizzle-kit doesn't store
// per-file hashes there; it computes them from file content at runtime) —
// the bootstrap row's hash only needs to be distinct from the row Drizzle's
// own migrator writes once it applies migration 0000's *content* normally,
// so a fixed literal is enough here.
const BASELINE_ENTRY = journal.entries.find((e: { idx: number }) => e.idx === 0)!;
const BASELINE_MIGRATION_MILLIS: number = BASELINE_ENTRY.when;
const BASELINE_MIGRATION_HASH = "v6-bootstrap-baseline";
const BUNDLED_LATEST_MIGRATION_MILLIS: number = Math.max(...journal.entries.map((e: { when: number }) => e.when));

const TIMESTAMP_COLUMNS: { table: string; columns: string[] }[] = [
  { table: "profile", columns: ["created_at"] },
  { table: "species_personal", columns: ["updated_at"] },
  { table: "form_personal", columns: ["updated_at"] },
  { table: "form_background_personal", columns: ["updated_at"] },
  { table: "mega_personal", columns: ["updated_at"] },
  { table: "pokemon_instance", columns: ["recorded_at", "caught_at", "updated_at"] },
  { table: "pokemon_instance_max_move", columns: ["updated_at"] },
  { table: "player_progress_personal", columns: ["updated_at"] },
  { table: "medal_progress_personal", columns: ["updated_at"] },
  { table: "player_progress_log", columns: ["recorded_at"] },
  { table: "personal_data_quarantine", columns: ["quarantined_at"] },
];

async function tableExists(db: SQLiteDBConnection, table: string): Promise<boolean> {
  const result = await db.query("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?", [table]);
  return (result.values?.length ?? 0) > 0;
}

async function getOldSchemaVersion(db: SQLiteDBConnection): Promise<number | null> {
  if (!(await tableExists(db, "schema_version"))) return null;
  const result = await db.query("SELECT version FROM schema_version LIMIT 1");
  const row = result.values?.[0] as { version: number } | undefined;
  return row ? row.version : null;
}

// Rewrites every existing timestamp column's ISO-string value to epoch
// milliseconds, in place. NULL values and already-numeric values are left
// untouched (a second bootstrap run, or a fresh-install table with no rows
// yet, must be a safe no-op).
async function convertTimestampColumns(db: SQLiteDBConnection): Promise<void> {
  for (const { table, columns } of TIMESTAMP_COLUMNS) {
    if (!(await tableExists(db, table))) continue;
    for (const column of columns) {
      const rows = (await db.query(`SELECT rowid, ${column} FROM ${table} WHERE ${column} IS NOT NULL AND typeof(${column}) = 'text'`)).values ?? [];
      for (const row of rows as Record<string, unknown>[]) {
        const isoValue = row[column] as string;
        const epochMs = new Date(isoValue).getTime();
        // A malformed/unparseable stored value is treated as "unknown" (0 —
        // epoch start) rather than left as text, since Drizzle's
        // timestamp_ms mode requires a numeric column going forward and a
        // NaN would break every future read of this row.
        const safeValue = Number.isNaN(epochMs) ? 0 : epochMs;
        await db.run(`UPDATE ${table} SET ${column} = ? WHERE rowid = ?`, [safeValue, row.rowid], false);
      }
    }
  }
}

async function bootstrapDrizzleTrackingForExistingDevice(db: SQLiteDBConnection): Promise<void> {
  const oldVersion = await getOldSchemaVersion(db);
  if (oldVersion === null) return; // fresh install — nothing to bootstrap
  if (await tableExists(db, MIGRATIONS_TABLE)) return; // already bootstrapped

  await convertTimestampColumns(db);

  await db.execute(
    `CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hash TEXT NOT NULL,
      created_at NUMERIC
    )`,
    false,
  );
  await db.run(`INSERT INTO ${MIGRATIONS_TABLE} (hash, created_at) VALUES (?, ?)`, [BASELINE_MIGRATION_HASH, BASELINE_MIGRATION_MILLIS], false);
}

async function assertNotADowngrade(db: SQLiteDBConnection): Promise<void> {
  if (!(await tableExists(db, MIGRATIONS_TABLE))) return; // fresh install, or bootstrap just ran with nothing later than baseline
  const result = await db.query(`SELECT created_at FROM ${MIGRATIONS_TABLE} ORDER BY created_at DESC LIMIT 1`);
  const row = result.values?.[0] as { created_at: number } | undefined;
  if (!row) return;
  if (row.created_at > BUNDLED_LATEST_MIGRATION_MILLIS) {
    throw new Error(
      `Personal data is at a migration newer than this app build knows about. Refusing to boot to avoid misreading it — update the app, or restore an older backup.`,
    );
  }
}

export async function runPersonalMigrations(db: SQLiteDBConnection): Promise<void> {
  await bootstrapDrizzleTrackingForExistingDevice(db);
  await assertNotADowngrade(db);

  const drizzleDb = await getDrizzleDb();
  await migrate(drizzleDb, async (queries) => {
    await db.beginTransaction();
    try {
      for (const query of queries) {
        await db.run(query, [], false);
      }
      await db.commitTransaction();
    } catch (err) {
      await db.rollbackTransaction();
      throw err;
    }
  }, { migrationsFolder: "./src/db/migrations" });
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors (this compiles the whole `src/` tree — acceptable here since Task 4-6 together touch enough of `src/db/` that a full check is warranted before moving to tests).

- [ ] **Step 4: Commit**

```bash
git add src/db/migrations.ts
git commit -m "Rewrite migration runner around drizzle-orm/sqlite-proxy/migrator with v6 bootstrap"
```

---

## Task 7: Fresh-install test

**Files:**
- Modify: `test/migrations.test.ts`

**Interfaces:**
- Consumes: `runPersonalMigrations` (Task 6), `nodeSqliteConnection` (existing, `test/node-sqlite-connection.ts`).

- [ ] **Step 1: Replace the old fresh-install test**

The existing `test/migrations.test.ts` (read in full during design) tests the deleted hand-rolled runner directly (`CURRENT_PERSONAL_SCHEMA_VERSION`, manually-crafted v1-shape fixtures). Replace the whole file:

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

function tableExists(db: DatabaseSync, table: string): boolean {
  const row = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(table);
  return row !== undefined;
}

test("runPersonalMigrations on a brand-new database creates every personal table", async () => {
  const db = freshDb();
  await runPersonalMigrations(nodeSqliteConnection(db));

  for (const table of [
    "species_personal",
    "form_personal",
    "app_settings",
    "mega_personal",
    "form_background_personal",
    "personal_data_quarantine",
    "profile",
    "pokemon_instance",
    "tag",
  ]) {
    assert.ok(tableExists(db, table), `expected ${table} to exist on a fresh install`);
  }
  assert.ok(tableExists(db, "__drizzle_migrations"), "expected Drizzle's tracking table to exist");
});

test("runPersonalMigrations is a no-op replay for a device already at the current migration", async () => {
  const db = freshDb();
  await runPersonalMigrations(nodeSqliteConnection(db));
  await runPersonalMigrations(nodeSqliteConnection(db));
  const row = db.prepare("SELECT COUNT(*) as c FROM __drizzle_migrations").get() as { c: number };
  assert.equal(row.c, 1, "second run should not insert another migration row");
});
```

- [ ] **Step 2: Run**

Run: `npm run test -- test/migrations.test.ts`
Expected: both tests PASS.

- [ ] **Step 3: Commit**

```bash
git add test/migrations.test.ts
git commit -m "Rewrite migration tests for the drizzle-based runner"
```

---

## Task 8: The v6-fixture replay test (gates this plan)

**Files:**
- Create: `test/fixtures/v6-personal-schema.sql`
- Create: `test/drizzle-v6-bootstrap.test.ts`

**Interfaces:**
- Consumes: `runPersonalMigrations` (Task 6), `nodeSqliteConnection` (existing).

- [ ] **Step 1: Write the v6 fixture — today's exact pre-migration schema, with real-shaped ISO-string timestamps**

```sql
-- test/fixtures/v6-personal-schema.sql
-- Reproduces a real shipped v1.0.0 device: personal-schema v6 exactly as
-- src/db/schema.ts's PERSONAL_SCHEMA_SQL defined it (git history, pre-Drizzle),
-- with ISO-string TEXT timestamps — not the new Drizzle epoch-ms shape.
CREATE TABLE schema_version (version INTEGER NOT NULL);
INSERT INTO schema_version (version) VALUES (6);

CREATE TABLE app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);

CREATE TABLE profile (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL,
  friend_code TEXT,
  created_at TEXT NOT NULL
);
INSERT INTO profile (id, username, friend_code, created_at) VALUES (1, 'Trainer', NULL, '2026-01-01T00:00:00.000Z');

CREATE TABLE species_personal (
  species_slug TEXT PRIMARY KEY,
  profile_id INTEGER NOT NULL DEFAULT 1,
  registered INTEGER NOT NULL DEFAULT 0,
  xxl INTEGER NOT NULL DEFAULT 0,
  xxs INTEGER NOT NULL DEFAULT 0,
  purified INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT '1970-01-01T00:00:00.000Z'
);
INSERT INTO species_personal (species_slug, registered, xxl, updated_at) VALUES ('bulbasaur', 1, 1, '2026-06-15T10:30:00.000Z');

CREATE TABLE form_personal (
  form_slug TEXT PRIMARY KEY,
  profile_id INTEGER NOT NULL DEFAULT 1,
  caught INTEGER NOT NULL DEFAULT 0,
  shiny INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT '1970-01-01T00:00:00.000Z'
);
INSERT INTO form_personal (form_slug, caught, shiny, updated_at) VALUES ('bulbasaur-standard-male', 1, 1, '2026-06-15T10:31:00.000Z');

CREATE TABLE form_background_personal (
  form_slug TEXT NOT NULL,
  profile_id INTEGER NOT NULL DEFAULT 1,
  achievement_field TEXT NOT NULL,
  background_slug TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT '1970-01-01T00:00:00.000Z',
  PRIMARY KEY (form_slug, achievement_field, background_slug)
);

CREATE TABLE mega_personal (
  mega_variant_slug TEXT PRIMARY KEY,
  profile_id INTEGER NOT NULL DEFAULT 1,
  evolved INTEGER NOT NULL DEFAULT 0,
  shiny_evolved INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT '1970-01-01T00:00:00.000Z'
);

CREATE TABLE pokemon_instance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  form_slug TEXT NOT NULL,
  profile_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'kept',
  recorded_at TEXT NOT NULL,
  caught_at TEXT,
  updated_at TEXT NOT NULL,
  cp INTEGER,
  shiny INTEGER NOT NULL DEFAULT 0
);
INSERT INTO pokemon_instance (form_slug, profile_id, recorded_at, caught_at, updated_at, cp, shiny)
  VALUES ('bulbasaur-standard-male', 1, '2026-06-15T10:31:00.000Z', '2026-06-14T18:00:00.000Z', '2026-06-15T10:31:00.000Z', 1200, 1);

CREATE TABLE tag (id INTEGER PRIMARY KEY AUTOINCREMENT, profile_id INTEGER NOT NULL, name TEXT NOT NULL, UNIQUE(profile_id, name));
CREATE TABLE pokemon_instance_tag (pokemon_instance_id INTEGER NOT NULL, tag_id INTEGER NOT NULL, PRIMARY KEY (pokemon_instance_id, tag_id));
CREATE TABLE pokemon_instance_max_move (pokemon_instance_id INTEGER NOT NULL, move_slot TEXT NOT NULL, level INTEGER, updated_at TEXT NOT NULL, PRIMARY KEY (pokemon_instance_id, move_slot));
CREATE TABLE player_progress_personal (profile_id INTEGER PRIMARY KEY, current_level INTEGER, total_xp INTEGER, updated_at TEXT NOT NULL);
CREATE TABLE medal_progress_personal (medal_slug TEXT NOT NULL, profile_id INTEGER NOT NULL DEFAULT 1, current_rank INTEGER NOT NULL DEFAULT 0, current_count INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL, PRIMARY KEY (medal_slug, profile_id));
CREATE TABLE player_progress_log (id INTEGER PRIMARY KEY AUTOINCREMENT, profile_id INTEGER NOT NULL DEFAULT 1, recorded_at TEXT NOT NULL, current_level INTEGER, total_xp INTEGER);
CREATE TABLE personal_data_quarantine (id INTEGER PRIMARY KEY AUTOINCREMENT, source_table TEXT NOT NULL, slug TEXT NOT NULL, payload_json TEXT NOT NULL, quarantined_at TEXT NOT NULL);
```

- [ ] **Step 2: Write the replay test**

```ts
// test/drizzle-v6-bootstrap.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { runPersonalMigrations } from "../src/db/migrations";
import { nodeSqliteConnection } from "./node-sqlite-connection";

const __dirname = dirname(fileURLToPath(import.meta.url));

function v6FixtureDb(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(readFileSync(resolve(__dirname, "fixtures/v6-personal-schema.sql"), "utf8"));
  return db;
}

test("bootstrapping a real v6 device preserves every existing row untouched", async () => {
  const db = v6FixtureDb();

  const beforeSpecies = db.prepare("SELECT * FROM species_personal WHERE species_slug = 'bulbasaur'").get();
  const beforeInstance = db.prepare("SELECT * FROM pokemon_instance WHERE form_slug = 'bulbasaur-standard-male'").get() as Record<string, unknown>;

  await runPersonalMigrations(nodeSqliteConnection(db));

  const afterSpecies = db.prepare("SELECT species_slug, registered, xxl FROM species_personal WHERE species_slug = 'bulbasaur'").get();
  assert.deepEqual(afterSpecies, { species_slug: "bulbasaur", registered: 1, xxl: 1 });

  const afterInstance = db.prepare("SELECT form_slug, cp, shiny FROM pokemon_instance WHERE form_slug = 'bulbasaur-standard-male'").get();
  assert.deepEqual(afterInstance, { form_slug: "bulbasaur-standard-male", cp: 1200, shiny: 1 });

  // Timestamp columns converted from ISO text to epoch ms, not lost.
  const convertedUpdatedAt = db.prepare("SELECT updated_at FROM species_personal WHERE species_slug = 'bulbasaur'").get() as { updated_at: number };
  assert.equal(convertedUpdatedAt.updated_at, new Date("2026-06-15T10:30:00.000Z").getTime());

  const convertedCaughtAt = db.prepare("SELECT caught_at FROM pokemon_instance WHERE form_slug = 'bulbasaur-standard-male'").get() as { caught_at: number };
  assert.equal(convertedCaughtAt.caught_at, new Date("2026-06-14T18:00:00.000Z").getTime());

  // Drizzle's tracking table is seeded, not left empty or double-applying 0000.
  const migrationRows = db.prepare("SELECT COUNT(*) as c FROM __drizzle_migrations").get() as { c: number };
  assert.equal(migrationRows.c, 1);

  void beforeSpecies;
  void beforeInstance;
});

test("a second boot after bootstrapping is a no-op", async () => {
  const db = v6FixtureDb();
  await runPersonalMigrations(nodeSqliteConnection(db));
  const countAfterFirst = (db.prepare("SELECT COUNT(*) as c FROM __drizzle_migrations").get() as { c: number }).c;

  await runPersonalMigrations(nodeSqliteConnection(db));
  const countAfterSecond = (db.prepare("SELECT COUNT(*) as c FROM __drizzle_migrations").get() as { c: number }).c;

  assert.equal(countAfterFirst, countAfterSecond);
});
```

- [ ] **Step 3: Run — this must pass before this plan is considered done**

Run: `npm run test -- test/drizzle-v6-bootstrap.test.ts`
Expected: both tests PASS. If the timestamp-conversion assertions fail, fix `convertTimestampColumns()` in `src/db/migrations.ts` (Task 6) — do not weaken this test.

- [ ] **Step 4: Commit**

```bash
git add test/fixtures/v6-personal-schema.sql test/drizzle-v6-bootstrap.test.ts
git commit -m "Add gating test: replay a real v6 device through the Drizzle bootstrap"
```

---

## Task 9: Full test suite + typecheck + lint pass

**Files:** none (verification only)

- [ ] **Step 1: Run the full suite**

Run: `npm run test`
Expected: all tests PASS, including `test/reference-sync.test.ts` (untouched by this plan — should still pass unmodified since `reference-sync.ts`'s SQL-string behavior isn't changed until Plan 2).

- [ ] **Step 2: Typecheck**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 4: Commit any fixups**

```bash
git add -A
git commit -m "Fix up typecheck/lint fallout from Drizzle migration runner"
```
