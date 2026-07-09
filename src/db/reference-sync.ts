// Reference-table refresh: on every startup, wipes and reloads only the
// reference tables (species/form/etc.) from the bundled src/data/reference.json
// asset if its content has changed since the last run — personal tables are
// never touched here except for the slug-rename remap below. Mirrors
// CLAUDE.md's "wholesale replaceable reference tables, upsert by slug" design.
//
// Runs after runPersonalMigrations() — it depends on app_settings existing to
// store the last-synced version marker.

import type { SQLiteDBConnection } from "@capacitor-community/sqlite";
import { REFERENCE_SCHEMA_SQL } from "./schema";
import type { ReferenceData } from "./reference-data";
import { SLUG_RENAMES } from "./slug-renames";

const VERSION_SETTING_KEY = "reference_data_version";

// Not cryptographic — just needs to change whenever reference.json's content
// does, so a plain string hash (FNV-1a) is plenty.
function hashContent(content: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < content.length; i++) {
    hash ^= content.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16);
}

async function getStoredReferenceVersion(db: SQLiteDBConnection): Promise<string | null> {
  const result = await db.query("SELECT value FROM app_settings WHERE key = ?", [VERSION_SETTING_KEY]);
  const row = result.values?.[0] as { value: string } | undefined;
  return row?.value ?? null;
}

async function applySlugRenames(db: SQLiteDBConnection): Promise<void> {
  for (const rename of SLUG_RENAMES) {
    if (rename.table === "form_personal") {
      await db.run("UPDATE form_personal SET form_slug = ? WHERE form_slug = ?", [rename.to, rename.from], false);
    } else {
      await db.run("UPDATE form_background_personal SET form_slug = ? WHERE form_slug = ?", [rename.to, rename.from], false);
    }
  }
}

// Moves any row that fails `isValid` into personal_data_quarantine (see
// schema.ts) instead of leaving it in place for the deferred FK check at
// COMMIT to trip over — a real orphan (a slug reference-sync can't resolve,
// not covered by a SLUG_RENAMES entry) would otherwise fail the *entire*
// sync transaction, rolling back a legitimate reference-data update just
// because one stale personal row exists. One DELETE per orphaned row rather
// than a bulk "WHERE slug NOT IN (...)" — form_personal alone can have
// thousands of valid slugs, past SQLite's default bound parameter limit.
async function quarantineOrphans(
  db: SQLiteDBConnection,
  table: string,
  pkColumns: string[],
  isValid: (row: Record<string, unknown>) => boolean,
): Promise<void> {
  const result = await db.query(`SELECT * FROM ${table}`);
  const now = new Date().toISOString();
  for (const row of (result.values ?? []) as Record<string, unknown>[]) {
    if (isValid(row)) continue;
    await db.run(
      "INSERT INTO personal_data_quarantine (source_table, slug, payload_json, quarantined_at) VALUES (?, ?, ?, ?)",
      [table, String(row[pkColumns[0]]), JSON.stringify(row), now],
      false,
    );
    const whereClause = pkColumns.map((c) => `${c} = ?`).join(" AND ");
    await db.run(`DELETE FROM ${table} WHERE ${whereClause}`, pkColumns.map((c) => row[c]), false);
  }
}

const b = (value: boolean) => (value ? 1 : 0);

export async function syncReferenceData(db: SQLiteDBConnection, referenceData: ReferenceData): Promise<void> {
  await db.execute(REFERENCE_SCHEMA_SQL);

  const content = JSON.stringify(referenceData);
  const newVersion = hashContent(content);
  const storedVersion = await getStoredReferenceVersion(db);
  if (storedVersion === newVersion) return;

  await db.beginTransaction();
  try {
    // Defer foreign-key enforcement to COMMIT. Personal tables
    // (species_personal, form_personal, …) hold FKs into the reference
    // tables we're about to drop/recreate; without deferral, the implicit
    // row-delete of a DROP TABLE (or a DELETE FROM) trips "FOREIGN KEY
    // constraint failed" the moment any personal data references a reference
    // row — which is every returning user the first time an app update
    // changes reference.json. Because we re-insert the same slugs below, the
    // constraints are satisfied again by commit time. Resets automatically
    // at the end of the transaction.
    await db.run("PRAGMA defer_foreign_keys = true", [], false);

    // Renames must land before the old form rows disappear below, or the
    // personal rows they'd otherwise remap would just get orphaned instead.
    await applySlugRenames(db);

    // Quarantine any personal row a rename didn't account for — must run
    // after renames land (so a just-renamed row reads as valid, not
    // orphaned) and before the DROP TABLE below (so these rows are gone
    // before the deferred FK check at COMMIT would otherwise trip on them).
    const speciesSlugs = new Set(referenceData.species.map((s) => s.slug));
    const formSlugs = new Set(referenceData.forms.map((f) => f.slug));
    const backgroundSlugs = new Set(referenceData.backgrounds.map((bg) => bg.slug));
    const megaVariantSlugs = new Set(referenceData.megaVariants.map((m) => m.slug));
    await quarantineOrphans(db, "species_personal", ["species_slug"], (row) => speciesSlugs.has(row.species_slug as string));
    await quarantineOrphans(db, "form_personal", ["form_slug"], (row) => formSlugs.has(row.form_slug as string));
    await quarantineOrphans(
      db,
      "form_background_personal",
      ["form_slug", "achievement_field", "background_slug"],
      (row) => formSlugs.has(row.form_slug as string) && backgroundSlugs.has(row.background_slug as string),
    );
    await quarantineOrphans(db, "mega_personal", ["mega_variant_slug"], (row) => megaVariantSlugs.has(row.mega_variant_slug as string));

    // Drop (not just delete-from) in FK-safe order (children before
    // parents), then recreate from REFERENCE_SCHEMA_SQL below. A plain
    // DELETE FROM would leave a stale table object in place if a reference
    // table's *column shape* changed (a column added/removed/renamed) since
    // the last sync — CREATE TABLE IF NOT EXISTS at the top of this
    // function is a no-op against an already-existing table, so the old
    // columns would silently stick around forever on any device that had
    // already initialized its DB before the shape changed. Dropping and
    // recreating makes every future DDL change to these tables safe by
    // default, not just this one. `transaction: false` on every statement
    // below — we're already inside the manual begin/commit above and don't
    // want each call opening its own.
    for (const table of ["form_types", "mega_variant", "form", "species", "backgrounds", "types", "regions"]) {
      await db.run(`DROP TABLE IF EXISTS ${table}`, [], false);
    }
    await db.execute(REFERENCE_SCHEMA_SQL, false);

    for (const region of referenceData.regions) {
      await db.run("INSERT INTO regions (slug, name) VALUES (?, ?)", [region.slug, region.name], false);
    }
    for (const type of referenceData.types) {
      await db.run("INSERT INTO types (slug, name) VALUES (?, ?)", [type.slug, type.name], false);
    }
    for (const bg of referenceData.backgrounds) {
      await db.run("INSERT INTO backgrounds (slug, name) VALUES (?, ?)", [bg.slug, bg.name], false);
    }
    for (const s of referenceData.species) {
      await db.run(
        `INSERT INTO species (slug, dex_number, name, family_slug, gen, rarity, region_slug, has_male, has_female, can_mega_evolve, can_gigantamax)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [s.slug, s.dexNumber, s.name, s.familySlug, s.gen, s.rarity, s.regionSlug, b(s.hasMale), b(s.hasFemale), b(s.canMegaEvolve), b(s.canGigantamax)],
        false,
      );
    }
    for (const f of referenceData.forms) {
      await db.run(
        `INSERT INTO form (slug, species_slug, form_name, costume_name, gender, evolves, shiny_available, shadow_available, dynamax_available, regional_exclusive, image_ref)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          f.slug,
          f.speciesSlug,
          f.formName,
          f.costumeName,
          f.gender,
          b(f.evolves),
          b(f.shinyAvailable),
          b(f.shadowAvailable),
          b(f.dynamaxAvailable),
          b(f.regionalExclusive),
          f.imageRef,
        ],
        false,
      );
    }
    for (const ft of referenceData.formTypes) {
      await db.run("INSERT INTO form_types (form_slug, type_slug) VALUES (?, ?)", [ft.formSlug, ft.typeSlug], false);
    }
    for (const m of referenceData.megaVariants) {
      await db.run("INSERT INTO mega_variant (slug, species_slug, variant) VALUES (?, ?, ?)", [m.slug, m.speciesSlug, m.variant], false);
    }

    await db.run(
      `INSERT INTO app_settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [VERSION_SETTING_KEY, newVersion],
      false,
    );

    await db.commitTransaction();
  } catch (err) {
    await db.rollbackTransaction();
    throw err;
  }
}
