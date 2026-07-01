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
// updates `schema_version` itself after each step succeeds.

import type { SQLiteDBConnection } from "@capacitor-community/sqlite";
import { CURRENT_PERSONAL_SCHEMA_VERSION, PERSONAL_SCHEMA_SQL } from "./schema";

interface Migration {
  version: number;
  up: (db: SQLiteDBConnection) => Promise<void>;
}

// Empty today — v1 is the baseline every fresh DB starts at. Real entries
// (e.g. `{ version: 2, up: (db) => db.execute("ALTER TABLE ...") }`) get
// appended here as the personal schema grows.
const MIGRATIONS: Migration[] = [];

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
    // one shot, no incremental migrations to replay.
    await db.execute(PERSONAL_SCHEMA_SQL);
    await db.run("INSERT INTO schema_version (version) VALUES (?)", [CURRENT_PERSONAL_SCHEMA_VERSION]);
    return;
  }

  const storedVersion = (await getStoredVersion(db)) ?? 0;
  const pending = MIGRATIONS.filter((m) => m.version > storedVersion).sort((a, b) => a.version - b.version);

  for (const migration of pending) {
    await migration.up(db);
    await db.run("UPDATE schema_version SET version = ?", [migration.version]);
  }
}
