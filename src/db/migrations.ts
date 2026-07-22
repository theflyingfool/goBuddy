// Personal-schema migration runner. Schema changes only ever touch personal
// tables (reference tables are wholesale-replaced, never migrated — see
// reference-sync.ts) so a version bump here should never need to run
// alongside a reference-data change.
//
// On a brand-new database, `PERSONAL_SCHEMA_SQL` creates every personal
// table already at CURRENT_PERSONAL_SCHEMA_VERSION — there is nothing to
// "migrate" from. MIGRATIONS only matters for a device that already has an
// older `schema_version` row than the version bundled in the app update.
//
// To add a migration: bump CURRENT_PERSONAL_SCHEMA_VERSION in schema.ts and
// append a `{ version, up }` entry here. `up` receives the open connection
// and should leave the DB at exactly that version's shape — the runner
// updates `schema_version` itself after each step succeeds. The runner wraps
// each migration's `up` + its `schema_version` bump in one transaction, so
// `up`'s own statements should pass `transaction: false` to db.run/db.execute
// (see reference-sync.ts for the same pattern) rather than opening their own.

import type { SQLiteDBConnection } from "@capacitor-community/sqlite";
import { CURRENT_PERSONAL_SCHEMA_VERSION, DEFAULT_PROFILE_ID, DEFAULT_PROFILE_USERNAME, PERSONAL_SCHEMA_SQL } from "./schema";

interface Migration {
  version: number;
  up: (db: SQLiteDBConnection) => Promise<void>;
}

const MIGRATIONS: Migration[] = [
  {
    // Adds personal_data_quarantine (see schema.ts) for devices that synced
    // reference data under v1, before reference-sync.ts's orphan quarantine
    // existed. IF NOT EXISTS makes this safe even if a v1 device somehow
    // already has the table (it doesn't, but matches the defensive style of
    // the rest of the schema).
    version: 2,
    up: async (db) => {
      await db.execute(
        `CREATE TABLE IF NOT EXISTS personal_data_quarantine (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          source_table TEXT NOT NULL,
          slug TEXT NOT NULL,
          payload_json TEXT NOT NULL,
          quarantined_at TEXT NOT NULL
        )`,
        false,
      );
    },
  },
  {
    // Adds updated_at to every personal collection table, needed for
    // merge-on-import (see importPersonalData in in-memory-store.ts) to
    // decide which side of a conflicting row is newer. The fixed epoch
    // default means every pre-existing row reads as "older than anything a
    // real import could carry" — an incoming row with a real timestamp
    // always wins against one that predates this migration, which is the
    // conservative direction to default (an import can only add/refresh
    // data this way, never appear to erase something newer by comparison).
    version: 3,
    up: async (db) => {
      // All four have existed since v1 on any real device — the existence
      // check is defensive (matches the IF NOT EXISTS style used elsewhere
      // in this file) rather than a scenario expected to actually happen;
      // SQLite has no ALTER TABLE ... ADD COLUMN IF NOT EXISTS of its own.
      for (const table of ["species_personal", "form_personal", "form_background_personal", "mega_personal"]) {
        if (await tableExists(db, table)) {
          await db.execute(`ALTER TABLE ${table} ADD COLUMN updated_at TEXT NOT NULL DEFAULT '1970-01-01T00:00:00.000Z'`, false);
        }
      }
    },
  },
  {
    // Adds the profile table (plus the seeded id=1 default row every
    // existing table's profile_id column defaults to), a profile_id column
    // on every pre-existing personal table, mega_personal.current_mega_level,
    // and the new pokemon_instance/tag/pokemon_instance_tag/dynamax_personal/
    // player_progress_personal tables. See schema.ts's comments on `profile`
    // and `pokemon_instance` for what's deliberately NOT done here yet
    // (profile_id isn't part of any PRIMARY KEY — real multi-profile support
    // is a later, separate change, not implied by this migration).
    version: 4,
    up: async (db) => {
      await db.execute(
        `CREATE TABLE IF NOT EXISTS profile (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT NOT NULL,
          friend_code TEXT,
          created_at TEXT NOT NULL
        )`,
        false,
      );
      await db.run(
        "INSERT OR IGNORE INTO profile (id, username, friend_code, created_at) VALUES (?, ?, NULL, ?)",
        [DEFAULT_PROFILE_ID, DEFAULT_PROFILE_USERNAME, new Date().toISOString()],
        false,
      );

      for (const table of ["species_personal", "form_personal", "form_background_personal", "mega_personal"]) {
        if (await tableExists(db, table)) {
          await db.execute(`ALTER TABLE ${table} ADD COLUMN profile_id INTEGER NOT NULL DEFAULT ${DEFAULT_PROFILE_ID} REFERENCES profile(id)`, false);
        }
      }
      if (await tableExists(db, "mega_personal")) {
        await db.execute("ALTER TABLE mega_personal ADD COLUMN current_mega_level INTEGER", false);
      }

      await db.execute(
        `CREATE TABLE IF NOT EXISTS pokemon_instance (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          form_slug TEXT NOT NULL REFERENCES form(slug),
          profile_id INTEGER NOT NULL REFERENCES profile(id),
          status TEXT NOT NULL DEFAULT 'kept' CHECK (status IN ('kept', 'traded', 'released', 'evolved')),
          recorded_at TEXT NOT NULL,
          caught_at TEXT,
          updated_at TEXT NOT NULL,
          cp INTEGER,
          iv_percent REAL,
          shiny INTEGER NOT NULL DEFAULT 0 CHECK (shiny IN (0, 1)),
          lucky INTEGER NOT NULL DEFAULT 0 CHECK (lucky IN (0, 1)),
          shadow INTEGER NOT NULL DEFAULT 0 CHECK (shadow IN (0, 1)),
          purified INTEGER NOT NULL DEFAULT 0 CHECK (purified IN (0, 1)),
          hearts_earned INTEGER,
          nickname TEXT,
          background_slug TEXT REFERENCES backgrounds(slug)
        )`,
        false,
      );
      await db.execute(
        `CREATE TABLE IF NOT EXISTS tag (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          profile_id INTEGER NOT NULL REFERENCES profile(id),
          name TEXT NOT NULL,
          UNIQUE (profile_id, name)
        )`,
        false,
      );
      await db.execute(
        `CREATE TABLE IF NOT EXISTS pokemon_instance_tag (
          pokemon_instance_id INTEGER NOT NULL REFERENCES pokemon_instance(id),
          tag_id INTEGER NOT NULL REFERENCES tag(id),
          PRIMARY KEY (pokemon_instance_id, tag_id)
        )`,
        false,
      );
      await db.execute(
        `CREATE TABLE IF NOT EXISTS dynamax_personal (
          form_slug TEXT NOT NULL REFERENCES form(slug),
          profile_id INTEGER NOT NULL REFERENCES profile(id),
          move_slot TEXT NOT NULL,
          level INTEGER,
          updated_at TEXT NOT NULL,
          PRIMARY KEY (form_slug, profile_id, move_slot)
        )`,
        false,
      );
      await db.execute(
        `CREATE TABLE IF NOT EXISTS player_progress_personal (
          profile_id INTEGER PRIMARY KEY REFERENCES profile(id),
          current_level INTEGER REFERENCES player_level(level),
          total_xp INTEGER,
          updated_at TEXT NOT NULL
        )`,
        false,
      );
    },
  },
];

async function tableExists(db: SQLiteDBConnection, table: string): Promise<boolean> {
  const result = await db.query("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?", [table]);
  return (result.values?.length ?? 0) > 0;
}

async function getStoredVersion(db: SQLiteDBConnection): Promise<number | null> {
  const result = await db.query("SELECT version FROM schema_version LIMIT 1");
  const row = result.values?.[0] as { version: number } | undefined;
  return row ? row.version : null;
}

export async function runPersonalMigrations(db: SQLiteDBConnection): Promise<void> {
  const hasSchemaVersionTable = await tableExists(db, "schema_version");

  if (!hasSchemaVersionTable) {
    // Fresh database: create every personal table at the current version in
    // one shot, no incremental migrations to replay. Every table's
    // profile_id column defaults to DEFAULT_PROFILE_ID, so that row must
    // exist before anything else gets written.
    await db.execute(PERSONAL_SCHEMA_SQL);
    await db.run("INSERT INTO profile (id, username, friend_code, created_at) VALUES (?, ?, NULL, ?)", [
      DEFAULT_PROFILE_ID,
      DEFAULT_PROFILE_USERNAME,
      new Date().toISOString(),
    ]);
    await db.run("INSERT INTO schema_version (version) VALUES (?)", [CURRENT_PERSONAL_SCHEMA_VERSION]);
    return;
  }

  const storedVersion = (await getStoredVersion(db)) ?? 0;

  // Downgrade guard: a stored version newer than this build knows about means
  // either a stamping bug or the user installed an older APK over a newer
  // one's data. The `pending` filter below would silently find nothing to
  // run (nothing is > storedVersion), which would look like a clean boot
  // while actually leaving tables/columns this build doesn't understand
  // unaccounted for. Refuse to boot instead — src/main.ts's boot-failure
  // rescue path still offers a raw personal-data export.
  if (storedVersion > CURRENT_PERSONAL_SCHEMA_VERSION) {
    throw new Error(
      `Personal data is at schema version ${storedVersion}, newer than this app build (${CURRENT_PERSONAL_SCHEMA_VERSION}). Refusing to boot to avoid misreading it — update the app, or restore an older backup.`,
    );
  }

  const pending = MIGRATIONS.filter((m) => m.version > storedVersion).sort((a, b) => a.version - b.version);

  for (const migration of pending) {
    await db.beginTransaction();
    try {
      await migration.up(db);
      await db.run("UPDATE schema_version SET version = ?", [migration.version], false);
      await db.commitTransaction();
    } catch (err) {
      await db.rollbackTransaction();
      throw err;
    }
  }
}
