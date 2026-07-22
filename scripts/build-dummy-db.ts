// Generates dummy.sqlite at the repo root: the real ingested reference data
// (src/data/reference.json) plus a small hand-written personal-table demo
// overlay (src/data/personal-demo-seed.ts) — meant to be opened directly in
// DB Browser for SQLite / the sqlite3 CLI / etc. to inspect the schema.

import { DatabaseSync } from "node:sqlite";
import { existsSync, unlinkSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { PERSONAL_SCHEMA_SQL, REFERENCE_SCHEMA_SQL, CURRENT_PERSONAL_SCHEMA_VERSION, DEFAULT_PROFILE_ID, DEFAULT_PROFILE_USERNAME } from "../src/db/schema";
import { DEFAULT_APP_SETTINGS } from "../src/db/defaults";
import { FORM_PERSONAL_BOOLEAN_FIELDS, FORM_PERSONAL_FIELD_COLUMNS } from "../src/db/types";
import type { ReferenceData } from "../src/db/reference-data";
import referenceDataJson from "../src/data/reference.json";
import { formBackgroundPersonal, formPersonal, megaPersonal, speciesPersonal } from "../src/data/personal-demo-seed";

const { regions, types, backgrounds, species, forms, formTypes, megaVariants } = referenceDataJson as unknown as ReferenceData;

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = resolve(__dirname, "../dummy.sqlite");

if (existsSync(DB_PATH)) unlinkSync(DB_PATH);

const db = new DatabaseSync(DB_PATH);
db.exec("PRAGMA foreign_keys = ON;");
db.exec(REFERENCE_SCHEMA_SQL);
db.exec(PERSONAL_SCHEMA_SQL);

const b = (value: boolean) => (value ? 1 : 0);

function insertAll<T extends object>(table: string, columns: string[], rows: T[]) {
  if (rows.length === 0) return;
  const placeholders = columns.map((c) => `@${c}`).join(", ");
  const stmt = db.prepare(`INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`);
  for (const row of rows) {
    try {
      stmt.run(row as never);
    } catch (err) {
      console.error(`Failed inserting into ${table}:`, row);
      throw err;
    }
  }
}

insertAll(
  "regions",
  ["slug", "name"],
  regions,
);

insertAll("types", ["slug", "name"], types);

insertAll("backgrounds", ["slug", "name"], backgrounds);

insertAll(
  "species",
  [
    "slug",
    "dex_number",
    "name",
    "family_slug",
    "gen",
    "rarity",
    "region_slug",
    "has_male",
    "has_female",
    "can_mega_evolve",
    "can_gigantamax",
  ],
  species.map((s) => ({
    slug: s.slug,
    dex_number: s.dexNumber,
    name: s.name,
    family_slug: s.familySlug,
    gen: s.gen,
    rarity: s.rarity,
    region_slug: s.regionSlug,
    has_male: b(s.hasMale),
    has_female: b(s.hasFemale),
    can_mega_evolve: b(s.canMegaEvolve),
    can_gigantamax: b(s.canGigantamax),
  })),
);

insertAll(
  "form",
  [
    "slug",
    "species_slug",
    "form_name",
    "costume_name",
    "gender",
    "evolves",
    "shiny_available",
    "shadow_available",
    "dynamax_available",
    "regional_exclusive",
    "image_ref",
  ],
  forms.map((f) => ({
    slug: f.slug,
    species_slug: f.speciesSlug,
    form_name: f.formName,
    costume_name: f.costumeName,
    gender: f.gender,
    evolves: b(f.evolves),
    shiny_available: b(f.shinyAvailable),
    shadow_available: b(f.shadowAvailable),
    dynamax_available: b(f.dynamaxAvailable),
    regional_exclusive: b(f.regionalExclusive),
    image_ref: f.imageRef,
  })),
);

insertAll(
  "form_types",
  ["form_slug", "type_slug"],
  formTypes.map((ft) => ({ form_slug: ft.formSlug, type_slug: ft.typeSlug })),
);

insertAll(
  "mega_variant",
  ["slug", "species_slug", "variant"],
  megaVariants.map((m) => ({ slug: m.slug, species_slug: m.speciesSlug, variant: m.variant })),
);

db.prepare("INSERT INTO schema_version (version) VALUES (?)").run(CURRENT_PERSONAL_SCHEMA_VERSION);

db.prepare("INSERT INTO profile (id, username, friend_code, created_at) VALUES (?, ?, NULL, ?)").run(
  DEFAULT_PROFILE_ID,
  DEFAULT_PROFILE_USERNAME,
  "2024-01-01T00:00:00.000Z",
);

insertAll(
  "app_settings",
  ["key", "value"],
  Object.entries(DEFAULT_APP_SETTINGS).map(([key, value]) => ({ key, value })),
);

insertAll(
  "species_personal",
  ["species_slug", "registered", "xxl", "xxs", "purified", "updated_at"],
  speciesPersonal.map((sp) => ({
    species_slug: sp.speciesSlug,
    registered: b(sp.registered),
    xxl: b(sp.xxl),
    xxs: b(sp.xxs),
    purified: b(sp.purified),
    updated_at: sp.updatedAt,
  })),
);

const formPersonalBooleanColumns = FORM_PERSONAL_BOOLEAN_FIELDS.map((field) => FORM_PERSONAL_FIELD_COLUMNS[field]);

insertAll(
  "form_personal",
  ["form_slug", ...formPersonalBooleanColumns, "best_shiny", "best_non_shiny", "best_lucky", "updated_at"],
  formPersonal.map((fp) => {
    const row: Record<string, unknown> = { form_slug: fp.formSlug };
    for (const field of FORM_PERSONAL_BOOLEAN_FIELDS) {
      row[FORM_PERSONAL_FIELD_COLUMNS[field]] = b(fp[field]);
    }
    row.best_shiny = fp.bestShiny;
    row.best_non_shiny = fp.bestNonShiny;
    row.best_lucky = fp.bestLucky;
    row.updated_at = fp.updatedAt;
    return row;
  }),
);

insertAll(
  "form_background_personal",
  ["form_slug", "achievement_field", "background_slug", "updated_at"],
  formBackgroundPersonal.map((fb) => ({
    form_slug: fb.formSlug,
    achievement_field: FORM_PERSONAL_FIELD_COLUMNS[fb.achievementField],
    background_slug: fb.backgroundSlug,
    updated_at: fb.updatedAt,
  })),
);

insertAll(
  "mega_personal",
  ["mega_variant_slug", "evolved", "shiny_evolved", "current_mega_level", "updated_at"],
  megaPersonal.map((mp) => ({
    mega_variant_slug: mp.megaVariantSlug,
    evolved: b(mp.evolved),
    shiny_evolved: b(mp.shinyEvolved),
    current_mega_level: mp.currentMegaLevel,
    updated_at: mp.updatedAt,
  })),
);

db.close();

console.log(`Wrote ${DB_PATH}`);
