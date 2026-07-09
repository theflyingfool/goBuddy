// Core read logic for main.ts's boot-failure rescue path, split out from
// boot-rescue.ts so it has no dependency on ../db/sqlite-client (which pulls
// in jeep-sqlite — fine in a browser, but makes this otherwise-pure function
// unable to run under a plain Node fixture for testing). See boot-rescue.ts
// for how this is actually wired up against the real on-device connection.

import type { SQLiteDBConnection } from "@capacitor-community/sqlite";
import { CURRENT_PERSONAL_SCHEMA_VERSION } from "../db/schema";
import { FORM_PERSONAL_BOOLEAN_FIELDS, FORM_PERSONAL_FIELD_COLUMNS, type FormPersonal, type SpeciesPersonal } from "../db/types";
import type { PersonalDataExport } from "./repository";

async function tableExists(db: SQLiteDBConnection, table: string): Promise<boolean> {
  const result = await db.query("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?", [table]);
  return (result.values?.length ?? 0) > 0;
}

// Reads each personal table directly and as defensively as possible: a
// failure reading any single table (e.g. a half-applied migration left it in
// an unexpected shape) doesn't abort the whole rescue — whatever tables *did*
// read successfully still get exported.
//
// Deliberately reuses the same PersonalDataExport shape personal-data-transfer.ts
// writes in the normal export flow (so the same Settings import path can read
// a rescue file back in later) — which means it shares that format's known
// gap (no megaPersonal/formBackgroundPersonal fields yet, see
// docs/v1-tasks/04-mega-and-gigantamax.md). This is a rescue of what the
// normal export already covers, not a more-complete backup.
export async function readPersonalDataBestEffort(db: SQLiteDBConnection): Promise<PersonalDataExport> {
  let schemaVersion = CURRENT_PERSONAL_SCHEMA_VERSION;
  try {
    if (await tableExists(db, "schema_version")) {
      const result = await db.query("SELECT version FROM schema_version LIMIT 1");
      const row = result.values?.[0] as { version: number } | undefined;
      // Report whatever's actually stamped on this DB, not this build's
      // CURRENT_PERSONAL_SCHEMA_VERSION — a partial/failed migration is
      // exactly the scenario this path exists for, so the two can disagree.
      if (row) schemaVersion = row.version;
    }
  } catch {
    // best-effort — fall back to CURRENT_PERSONAL_SCHEMA_VERSION above
  }

  const speciesPersonal: Record<string, SpeciesPersonal> = {};
  try {
    if (await tableExists(db, "species_personal")) {
      for (const row of (await db.query("SELECT * FROM species_personal")).values ?? []) {
        speciesPersonal[row.species_slug] = {
          speciesSlug: row.species_slug,
          registered: !!row.registered,
          xxl: !!row.xxl,
          xxs: !!row.xxs,
          purified: !!row.purified,
        };
      }
    }
  } catch (err) {
    console.error("Boot-rescue: couldn't read species_personal:", err);
  }

  const formPersonal: Record<string, FormPersonal> = {};
  try {
    if (await tableExists(db, "form_personal")) {
      for (const row of (await db.query("SELECT * FROM form_personal")).values ?? []) {
        const fp = { formSlug: row.form_slug, bestShiny: row.best_shiny ?? null, bestNonShiny: row.best_non_shiny ?? null, bestLucky: row.best_lucky ?? null } as FormPersonal;
        for (const field of FORM_PERSONAL_BOOLEAN_FIELDS) {
          fp[field] = !!row[FORM_PERSONAL_FIELD_COLUMNS[field]];
        }
        formPersonal[row.form_slug] = fp;
      }
    }
  } catch (err) {
    console.error("Boot-rescue: couldn't read form_personal:", err);
  }

  const appSettings: Record<string, string> = {};
  try {
    if (await tableExists(db, "app_settings")) {
      for (const row of (await db.query("SELECT * FROM app_settings")).values ?? []) {
        appSettings[row.key] = row.value;
      }
    }
  } catch (err) {
    console.error("Boot-rescue: couldn't read app_settings:", err);
  }

  return { exportedAt: new Date().toISOString(), schemaVersion, speciesPersonal, formPersonal, appSettings };
}
