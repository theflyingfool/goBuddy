# Drizzle ORM migration — design

Adopts Drizzle for GoBuddy's DB layer: schema definitions, migration generation
and execution, and the completion-stats query layer. Motivations: easier
schema upgrades, richer field-type modeling than raw SQLite gives natively,
and a single typed schema source instead of hand-mirroring `schema.ts` DDL
into `types.ts` by hand.

Context this design assumes (see [docs/data-model.md](../../data-model.md) and
[docs/architecture.md](../../architecture.md) for the full current picture):
reference tables are wholesale-replaced on every reference-data update
(`src/db/reference-sync.ts`); personal tables are migrated in place by a
hand-rolled versioned runner (`src/db/migrations.ts`, `schema_version` table,
`CURRENT_PERSONAL_SCHEMA_VERSION` = 6); the app runs the same
`@capacitor-community/sqlite` connection on native Android and, on Web, via
`jeep-sqlite` + `sql.js` + IndexedDB (`src/db/sqlite-client.ts`).

**Live-data constraint driving this whole design**: v1.0.0 shipped
2026-07-19 to real sideloaded devices already sitting at personal-schema v6.
Any migration-runner change must not corrupt or lose their data on next boot.

## 1. Tooling & packages

- Add `drizzle-orm` (pinned to a stable `0.44.x` release — not the `1.0.0-rc`
  prerelease line) to `dependencies`, and `drizzle-kit` to `devDependencies`.
- New `drizzle.config.ts` at repo root. `schema` points **only** at
  `src/db/schema/personal.ts` (see §2) — drizzle-kit only ever diffs/generates
  migrations for personal tables. `out` is `src/db/migrations/`.
- New npm script `db:generate` → `drizzle-kit generate`, run by hand after
  editing `schema/personal.ts`, same workflow shape as today's "hand-write a
  MIGRATIONS entry" step but with generated SQL instead.
- Document `db:generate` in [docs/commands.md](../../commands.md).

## 2. Schema definition split

Replace the DDL template strings in `src/db/schema.ts` with a
`src/db/schema/` directory:

- **`schema/reference.ts`** — Drizzle `sqliteTable()` defs for `species`,
  `form`, `form_types`, `mega_variant`, `move`, `regions`, `types`,
  `backgrounds`, etc. Used for typed queries (§4) only. **Not** referenced by
  `drizzle.config.ts`, so drizzle-kit never generates migrations for these —
  they stay wholesale-replaced by `reference-sync.ts` exactly as today.
- **`schema/personal.ts`** — Drizzle table defs for `species_personal`,
  `form_personal`, `form_background_personal`, `mega_personal`, `profile`,
  `pokemon_instance`, `tag`, `pokemon_instance_tag`,
  `pokemon_instance_max_move`, `player_progress_personal`,
  `medal_progress_personal`, `player_progress_log`,
  `personal_data_quarantine`. This is the sole input to `drizzle-kit
  generate` and the sole source of truth for these tables' shape going
  forward — `src/db/types.ts`'s hand-written camelCase mirror is deleted in
  favor of `$inferSelect`/`$inferInsert` on these table defs.

Concrete field-type wins (the "field types SQLite doesn't support" goal):

- `integer({ mode: 'boolean' })` replaces every
  `INTEGER NOT NULL CHECK (x IN (0,1))` column. Drizzle handles the JS
  boolean ↔ SQLite 0/1 conversion at the query-builder boundary.
- `text({ mode: 'json' })` for `payload_json` (on
  `personal_data_quarantine`) — typed JSON in/out instead of manual
  `JSON.parse`/`JSON.stringify` at call sites.
- **Deliberately not changed**: `updated_at`/`recorded_at`/`created_at`/
  `caught_at`/`quarantined_at` stay plain `text()` ISO-string columns, not
  Drizzle's `integer({ mode: 'timestamp' })`. Switching would change the
  on-disk representation (epoch integer vs ISO text) and require its own
  data migration — out of scope for this change, which should not alter any
  stored value, only how the schema is declared and diffed.

## 3. Migration execution & the v6 bootstrap

`src/db/migrations.ts` is rewritten around `drizzle-orm/sqlite-proxy/migrator`'s
`migrate(db, callback, config)`, where `callback` executes the SQL Drizzle
hands it through the existing `SQLiteDBConnection` obtained from
`src/db/sqlite-client.ts` (`getDb()`) — no changes to `sqlite-client.ts` or
the native/web platform split; the proxy driver is just another consumer of
the same connection object `sqlite-repository.ts` already uses.

- **Migration `0000`**: generated once, then hand-verified to reproduce
  today's `PERSONAL_SCHEMA_SQL` exactly — same tables, same `CHECK`
  constraints, same defaults. This is the baseline every device, new or
  existing, converges to.
- **Fresh installs**: no `__drizzle_migrations` table, no `schema_version`
  table → `migrate()` runs `0000` (and anything after it) from empty. The
  `profile` id=1 seed row insert (`DEFAULT_PROFILE_ID` /
  `DEFAULT_PROFILE_USERNAME`) remains explicit app code that runs once right
  after `0000` applies — drizzle-kit generates schema DDL only, never seed
  data.
- **Existing v6 devices** (the live-data case): on first boot under the new
  code, if `schema_version` exists with `version = 6` and
  `__drizzle_migrations` does **not** exist yet, insert a baseline row into
  `__drizzle_migrations` stamped with `0000`'s `folderMillis`/hash **before**
  calling `migrate()`. This makes Drizzle treat the device as already caught
  up through `0000`, so only migrations after it (genuine future schema
  changes) get applied — `0000`'s own `CREATE TABLE`/`ALTER TABLE` statements
  are never replayed against tables that already have those columns. The old
  `schema_version` table is left in place afterward, unread but harmless —
  no reason to drop it.
- **Downgrade guard**: today's "refuse to boot if the device's stored version
  is newer than this build knows about" check has no built-in equivalent in
  Drizzle's model. Re-derive it: compare the latest `created_at` in
  `__drizzle_migrations` against the newest migration timestamp bundled in
  this build's `src/db/migrations/` folder; if the device's latest is newer,
  throw the same refusal error as today (surfaced through the existing
  boot-failure rescue path in `src/main.ts`).

### Required test (gates merge)

A fixture builder that creates a real SQLite DB via today's
`PERSONAL_SCHEMA_SQL` and replays migrations 2–6 exactly as
`migrations.ts` does today (i.e., reproduces a real shipped v6 device),
then runs it through the new bootstrap-then-`migrate()` path, and asserts:
every pre-existing row and column is untouched, `__drizzle_migrations` ends
up correctly seeded with the `0000` baseline, and a subsequent boot is a
no-op. This must pass before this change ships.

## 4. Query layer

- `src/data/completion-stats-sql.ts`'s hand-written parameterized SQL is
  rewritten using Drizzle's query builder against `schema/reference.ts` +
  `schema/personal.ts`, via the same proxy `db` instance from §3. Each lens
  query becomes a typed `db.select()...` chain instead of a raw SQL string
  plus manual row-shape casting.
- `src/db/reference-sync.ts`'s wholesale-insert path (loading
  `reference.json` into reference tables) also moves to
  `db.insert(...).values(...)` batches instead of hand-built `INSERT`
  strings, for consistency with the rest of the query layer — done at the
  same time since this file is already being touched for the schema-source
  change.
- `src/data/in-memory-store.ts` is **not** touched — it doesn't talk SQL
  directly today (it's the in-app cache/filter engine behind the repository)
  and stays exactly as-is, per the agreed scope of this change.

## 5. Testing & rollout

- `test/migrations.test.ts` and `test/reference-sync.test.ts` (using the
  existing `node:sqlite`-backed `SQLiteDBConnection` test adapter) are
  updated to exercise the new `migrate()`-based runner instead of the old
  hand-rolled one.
- New test: the v6-fixture replay described in §3 (the gating test).
- New test: fresh-install path — empty DB → `migrate()` → assert resulting
  schema matches `schema/personal.ts` exactly, and the profile seed row is
  present.
- `scripts/build-dummy-db.ts` is updated to create its inspectable
  `dummy.sqlite` fixture from the Drizzle schema defs instead of the raw
  `PERSONAL_SCHEMA_SQL`/`REFERENCE_SCHEMA_SQL` strings, so the fixture stays
  a faithful mirror of what real devices get.
- Documentation updates: [docs/data-model.md](../../data-model.md) and
  [docs/architecture.md](../../architecture.md)'s "single source of truth"
  pointers move from `schema.ts` + `types.ts` to `schema/personal.ts` +
  `schema/reference.ts`; [docs/commands.md](../../commands.md) gains
  `db:generate`.
- Rollout: ships as a normal version bump per
  [docs/release-checklist.md](../../release-checklist.md) — no special
  migration-only release process needed, since the §3 bootstrap logic
  handles the v6→Drizzle transition transparently on next app open for
  existing devices.

## Explicitly out of scope

- `src/data/in-memory-store.ts` stays as a hand-written cache/filter engine,
  not rebuilt on Drizzle queries.
- No change to `src/db/sqlite-client.ts` or the native/web platform split.
- No change to on-disk timestamp representation.
- The personal/reference physical-database-file split and the slug/identity
  rework remain deferred to V2 per
  [docs/data-model.md](../../data-model.md#future-direction-deferred-not-yet-built) —
  unaffected by this change.
