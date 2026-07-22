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
    -- Bulbasaur deliberately has BOTH a non-Gigantamax and a Gigantamax form
    -- at once — the case that exercises gigantamaxCompleteLens's EXISTS
    -- subquery correlating against the SAME "form" table reference used by
    -- the outer join, not a distinct alias like the original hand-written
    -- SQL's f/f2 split. Without this, a translation bug where the inner
    -- EXISTS accidentally bound to the outer row instead of its own
    -- correlated set would not be caught by this fixture.
    INSERT INTO form VALUES ('bulbasaur-gigantamax-male', 'bulbasaur', 'Gigantamax', NULL, 0);
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

test("gigantamaxComplete lens: denominator is species with a Gigantamax form only, EXISTS correlates correctly against its own form row not the outer join's", async () => {
  const db = nodeSqliteConnection(seededDb());
  const [result] = await getCompletionStatsSql(db, { kind: "global" }, [{ kind: "gigantamaxComplete" }], false);
  // Only bulbasaur has a Gigantamax form (alongside its non-Gigantamax
  // forms) — ivysaur has none, so it's excluded from the denominator, not
  // counted as either complete or missing.
  assert.equal(result.total, 1);
  assert.equal(result.complete, 0); // the Gigantamax form itself was never caught
  assert.deepEqual(result.missingSpecies, [{ slug: "bulbasaur", name: "Bulbasaur", dexNumber: 1 }]);
});

test("megaShinyComplete lens: not-shiny-evolved species reported missing", async () => {
  const db = nodeSqliteConnection(seededDb());
  const [result] = await getCompletionStatsSql(db, { kind: "global" }, [{ kind: "megaShinyComplete" }], false);
  assert.equal(result.total, 1);
  assert.equal(result.complete, 0);
});

test("species scope narrows every lens to a single species", async () => {
  const db = nodeSqliteConnection(seededDb());
  const [registered, gigantamax, megaShiny] = await getCompletionStatsSql(
    db,
    { kind: "species", speciesSlug: "bulbasaur" },
    [{ kind: "registered" }, { kind: "gigantamaxComplete" }, { kind: "megaShinyComplete" }],
    false,
  );
  assert.equal(registered.total, 1);
  assert.equal(registered.complete, 1);
  assert.equal(gigantamax.total, 1);
  assert.equal(gigantamax.complete, 0);
  assert.equal(megaShiny.total, 1);
  assert.equal(megaShiny.complete, 0);
});
