import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";

import { runPersonalMigrations } from "../src/db/migrations";
import { CURRENT_PERSONAL_SCHEMA_VERSION } from "../src/db/schema";
import { nodeSqliteConnection } from "./node-sqlite-connection";

function freshDb(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  return db;
}

function storedVersion(db: DatabaseSync): number {
  const row = db.prepare("SELECT version FROM schema_version LIMIT 1").get() as { version: number };
  return row.version;
}

function tableExists(db: DatabaseSync, table: string): boolean {
  const row = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(table);
  return row !== undefined;
}

test("runPersonalMigrations on a brand-new database creates every table at the current version", async () => {
  const db = freshDb();
  await runPersonalMigrations(nodeSqliteConnection(db));

  assert.equal(storedVersion(db), CURRENT_PERSONAL_SCHEMA_VERSION);
  for (const table of ["species_personal", "form_personal", "app_settings", "mega_personal", "form_background_personal", "personal_data_quarantine"]) {
    assert.ok(tableExists(db, table), `expected ${table} to exist on a fresh install`);
  }
});

test("runPersonalMigrations replays only pending migrations for a device stamped at an older version", async () => {
  const db = freshDb();
  // Simulate a v1 device: schema_version exists and is stamped 1, but
  // personal_data_quarantine (added by the version-2 migration) doesn't
  // exist yet — mirrors migrations.ts's own comment about what a v1 device
  // looks like.
  db.exec(`
    CREATE TABLE schema_version (version INTEGER NOT NULL);
    CREATE TABLE species_personal (species_slug TEXT PRIMARY KEY, registered INTEGER NOT NULL DEFAULT 0, xxl INTEGER NOT NULL DEFAULT 0, xxs INTEGER NOT NULL DEFAULT 0, purified INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE form_personal (form_slug TEXT PRIMARY KEY, caught INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE form_background_personal (form_slug TEXT NOT NULL, achievement_field TEXT NOT NULL, background_slug TEXT NOT NULL, PRIMARY KEY (form_slug, achievement_field, background_slug));
    CREATE TABLE mega_personal (mega_variant_slug TEXT PRIMARY KEY, evolved INTEGER NOT NULL DEFAULT 0, shiny_evolved INTEGER NOT NULL DEFAULT 0);
  `);
  db.prepare("INSERT INTO schema_version (version) VALUES (?)").run(1);

  await runPersonalMigrations(nodeSqliteConnection(db));

  assert.equal(storedVersion(db), CURRENT_PERSONAL_SCHEMA_VERSION);
  assert.ok(tableExists(db, "personal_data_quarantine"), "version-2 migration should have created personal_data_quarantine");
  // Migrating shouldn't have touched a table that already existed pre-migration.
  assert.ok(tableExists(db, "species_personal"));
});

test("runPersonalMigrations is a no-op replay for a device already at the current version", async () => {
  const db = freshDb();
  await runPersonalMigrations(nodeSqliteConnection(db));
  // Running again against an already-migrated database shouldn't throw or
  // change the stamped version (pending filter finds nothing to apply).
  await runPersonalMigrations(nodeSqliteConnection(db));
  assert.equal(storedVersion(db), CURRENT_PERSONAL_SCHEMA_VERSION);
});

test("runPersonalMigrations refuses to boot against a newer-than-known stamped version", async () => {
  const db = freshDb();
  await runPersonalMigrations(nodeSqliteConnection(db));
  db.prepare("UPDATE schema_version SET version = ?").run(CURRENT_PERSONAL_SCHEMA_VERSION + 1);

  await assert.rejects(
    () => runPersonalMigrations(nodeSqliteConnection(db)),
    /newer than this app build/,
  );
});
