// Gating test for the Drizzle migration plan: replays a real shipped v1.0.0
// device (personal-schema v6, ISO-string TEXT timestamps — see
// test/fixtures/v6-personal-schema.sql) through runPersonalMigrations() and
// confirms every existing row survives and every TEXT timestamp column is
// genuinely converted to epoch-ms INTEGER, not just cosmetically readable.
//
// getDrizzleDb() (src/db/drizzle-client.ts) takes the SQLiteDBConnection as a
// parameter and holds no module-level singleton, so this file builds a fresh
// Drizzle instance directly against the fixture connection — no
// mock.module() gymnastics needed (contrast with the superseded
// .superpowers/sdd/verify-migration-bootstrap.test.ts, written against an
// earlier getDrizzleDb() that cached a connection internally).
import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { runPersonalMigrations } from "../src/db/migrations";
import { getDrizzleDb } from "../src/db/drizzle-client";
import { profile, speciesPersonal, pokemonInstance } from "../src/db/schema/personal";
import { eq } from "drizzle-orm";
import { nodeSqliteConnection } from "./node-sqlite-connection";

const __dirname = dirname(fileURLToPath(import.meta.url));

function v6FixtureDb(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(readFileSync(resolve(__dirname, "fixtures/v6-personal-schema.sql"), "utf8"));
  return db;
}

test("bootstrapping a real v6 device preserves every existing row and correctly converts timestamps", async () => {
  const db = v6FixtureDb();
  const maxExistingInstanceId = (db.prepare("SELECT MAX(id) as m FROM pokemon_instance").get() as { m: number }).m;

  const conn = nodeSqliteConnection(db);
  await runPersonalMigrations(conn);

  // node:sqlite's .get() returns a null-prototype object, so these are
  // spread into plain objects before comparing — assert.deepEqual under
  // node:assert/strict is deepStrictEqual, which checks prototypes too.
  const afterSpecies = { ...db.prepare("SELECT species_slug, registered, xxl FROM species_personal WHERE species_slug = 'bulbasaur'").get() };
  assert.deepEqual(afterSpecies, { species_slug: "bulbasaur", registered: 1, xxl: 1 });

  const afterInstance = { ...db.prepare("SELECT form_slug, cp, shiny FROM pokemon_instance WHERE form_slug = 'bulbasaur-standard-male'").get() };
  assert.deepEqual(afterInstance, { form_slug: "bulbasaur-standard-male", cp: 1200, shiny: 1 });

  // The column's actual on-disk storage class changed, not just its display value.
  const rawType = db.prepare("SELECT typeof(updated_at) as t FROM species_personal WHERE species_slug = 'bulbasaur'").get() as { t: string };
  assert.equal(rawType.t, "integer");

  // A real Drizzle read (the same path the app uses) returns a valid Date, not Invalid Date.
  const drizzleDb = getDrizzleDb(conn);
  const [speciesRow] = await drizzleDb.select().from(speciesPersonal).where(eq(speciesPersonal.speciesSlug, "bulbasaur"));
  assert.ok(speciesRow.updatedAt instanceof Date && !Number.isNaN(speciesRow.updatedAt.getTime()), "expected a valid Date, not Invalid Date");
  assert.equal(speciesRow.updatedAt.getTime(), new Date("2026-06-15T10:30:00.000Z").getTime());

  const [instanceRow] = await drizzleDb.select().from(pokemonInstance).where(eq(pokemonInstance.formSlug, "bulbasaur-standard-male"));
  assert.equal(instanceRow.caughtAt?.getTime(), new Date("2026-06-14T18:00:00.000Z").getTime());
  assert.equal(instanceRow.recordedAt.getTime(), new Date("2026-06-15T10:31:00.000Z").getTime());

  const [profileRow] = await drizzleDb.select().from(profile).where(eq(profile.id, 1));
  assert.equal(profileRow.createdAt.getTime(), new Date("2026-01-01T00:00:00.000Z").getTime());

  // Drizzle's tracking table reflects both migrations applied (0000's bootstrap row, 0001 applied normally).
  const migrationRows = db.prepare("SELECT COUNT(*) as c FROM __drizzle_migrations").get() as { c: number };
  assert.equal(migrationRows.c, 2);

  // A new row's id doesn't collide with any id that survived the rebuild. Note this doesn't prove
  // AUTOINCREMENT's sequence high-water mark survives a rebuild in general — with a single
  // pre-existing row, the next id is 2 regardless of whether the sequence was preserved; that would
  // only be exercised by a fixture with a gap (a previously hard-deleted row above the current max),
  // a scenario the app doesn't currently produce (pokemon_instance rows are soft-deleted via
  // `status`, never hard-deleted) — see this plan's "Known, accepted limitation" note. FK enforcement
  // is toggled off just for this insert: the
  // post-migration pokemon_instance table carries REFERENCES clauses into species/form/backgrounds
  // (reference tables the real app creates via syncReferenceData(), which runs after
  // runPersonalMigrations() and is out of scope for this test) — SQLite validates a REFERENCES
  // target's table existence at INSERT-time regardless of row/NULL values, so this insert would
  // otherwise fail on a missing reference table unrelated to what's being checked here.
  db.exec("PRAGMA foreign_keys = OFF");
  const insertResult = db.prepare("INSERT INTO pokemon_instance (form_slug, profile_id, recorded_at, updated_at) VALUES ('bulbasaur-standard-male', 1, 0, 0)").run();
  db.exec("PRAGMA foreign_keys = ON");
  assert.ok(Number(insertResult.lastInsertRowid) > maxExistingInstanceId, "new row's id should not collide with a pre-migration id");
});

test("a second boot after bootstrapping is a no-op", async () => {
  const db = v6FixtureDb();
  const conn = nodeSqliteConnection(db);
  await runPersonalMigrations(conn);
  const countAfterFirst = (db.prepare("SELECT COUNT(*) as c FROM __drizzle_migrations").get() as { c: number }).c;

  await runPersonalMigrations(conn);
  const countAfterSecond = (db.prepare("SELECT COUNT(*) as c FROM __drizzle_migrations").get() as { c: number }).c;

  assert.equal(countAfterFirst, countAfterSecond);
});
