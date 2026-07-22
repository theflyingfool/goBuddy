// Personal-schema migration runner. Now a thin wrapper around
// drizzle-orm/sqlite-proxy's migrate(), with a one-time bootstrap for
// devices that shipped before this change (already at hand-rolled
// personal-schema v6 — see schema.ts's old CURRENT_PERSONAL_SCHEMA_VERSION
// and the removed MIGRATIONS array, preserved in git history).
//
// Bootstrap: a v6 device has a `schema_version` table (version = 6) but no
// `__drizzle_migrations` table yet. On first boot under this code, seed
// `__drizzle_migrations` with a row matching migration 0000's own
// timestamp *before* calling migrate() — this tells Drizzle "this device is
// already caught up through 0000", so 0000's CREATE TABLE statements are
// never replayed against tables that already exist. migration 0000
// deliberately encodes the schema v6 devices actually have on disk (TEXT
// timestamps) — not the final INTEGER-timestamp shape — precisely so this
// bootstrap step can be this simple: migration 0001 (not skipped here) then
// does the real TEXT->INTEGER conversion via a table-rebuild, applied
// through the normal migrate() path below, identically for fresh installs
// (a no-op over empty tables) and upgrading v6 devices (the real
// conversion). See src/db/migrations/0000_baseline.sql's header comment and
// this plan's Architecture note for the full reasoning — an earlier draft
// of this file tried to convert timestamp values in place via UPDATE
// without rebuilding the table, which does not work: SQLite column
// affinity is fixed at CREATE TABLE time, so a value written into a
// TEXT-affinity column is always re-stored as text regardless of what type
// was bound, silently corrupting every timestamp the first time Drizzle's
// timestamp_ms mode tried to read it back as a Date.
//
// The old `schema_version` table is left in place afterward — unread,
// harmless.

import type { SQLiteDBConnection } from "@capacitor-community/sqlite";
import { migrate } from "drizzle-orm/sqlite-proxy/migrator";
import { getDrizzleDb } from "./drizzle-client";
import { DEFAULT_PROFILE_ID, DEFAULT_PROFILE_USERNAME } from "./schema";
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

async function bootstrapDrizzleTrackingForExistingDevice(db: SQLiteDBConnection): Promise<void> {
  const oldVersion = await getOldSchemaVersion(db);
  if (oldVersion === null) return; // fresh install — nothing to bootstrap
  if (await tableExists(db, MIGRATIONS_TABLE)) return; // already bootstrapped

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

// Drizzle-kit only ever generates schema DDL, never seed data — the profile
// table's id=1 row (every other personal table's profile_id column defaults
// to this id, several of them via a FK into profile(id)) has to be inserted
// by app code. An upgrading v6 device already has a real profile row
// (migration 0001's table-rebuild carries it across); this only matters for
// a genuinely fresh install. Must run after migrate() completes (the
// profile table doesn't exist before then) and before any other write to a
// personal table, since profile_id defaults/FKs depend on this row existing
// — runPersonalMigrations is the right place, as the last thing it does.
async function seedDefaultProfileIfMissing(db: SQLiteDBConnection): Promise<void> {
  const result = await db.query("SELECT COUNT(*) as c FROM profile");
  const row = result.values?.[0] as { c: number } | undefined;
  if ((row?.c ?? 0) > 0) return;
  await db.run(
    "INSERT INTO profile (id, username, friend_code, created_at) VALUES (?, ?, NULL, ?)",
    [DEFAULT_PROFILE_ID, DEFAULT_PROFILE_USERNAME, Date.now()],
    false,
  );
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

  // PRAGMA foreign_keys is a documented no-op when issued inside an active
  // transaction (SQLite refuses to change enforcement mid-transaction) — the
  // migrate() callback below wraps every pending migration's statements in
  // one transaction, so migration 0001's own embedded `PRAGMA
  // foreign_keys=OFF/ON` (see 0001_timestamps_to_epoch_ms.sql's header
  // comment) has no effect there; it's correct SQL, just inert under this
  // runner. FK enforcement must instead be toggled OFF here, before that
  // transaction ever opens — every table 0001 rebuilds carries a REFERENCES
  // clause into tables that don't exist yet on first boot (reference tables
  // are created by syncReferenceData(), which runs AFTER this function
  // returns), and SQLite validates a REFERENCES target's existence at
  // INSERT time whenever enforcement is on, regardless of row count.
  // Restored to ON only after migrate() fully completes, matching the app's
  // normal enforced-FK operating state. Verified empirically: issuing this
  // PRAGMA inside a transaction leaves `PRAGMA foreign_keys` reading back
  // as still-enabled and a dangling-FK insert still fails — confirm this
  // still holds for whatever SQLite build backs the connection under test
  // before trusting this fix.
  await db.run("PRAGMA foreign_keys = OFF", [], false);
  try {
    const drizzleDb = getDrizzleDb(db);
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
  } finally {
    await db.run("PRAGMA foreign_keys = ON", [], false);
  }

  await seedDefaultProfileIfMissing(db);
}
