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

const b = (value: boolean) => (value ? 1 : 0);

export async function syncReferenceData(db: SQLiteDBConnection, referenceData: ReferenceData): Promise<void> {
  await db.execute(REFERENCE_SCHEMA_SQL);

  const content = JSON.stringify(referenceData);
  const newVersion = hashContent(content);
  const storedVersion = await getStoredReferenceVersion(db);
  if (storedVersion === newVersion) return;

  await db.beginTransaction();
  try {
    // Renames must land before the old form rows disappear below, or the
    // personal rows they'd otherwise remap would just get orphaned instead.
    await applySlugRenames(db);

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
