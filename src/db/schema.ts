// SQL DDL for GoBuddy's SQLite schema. Single source of truth consumed by
// both scripts/build-dummy-db.ts (real .sqlite file for external inspection)
// and, later, the on-device migration runner. Column names are snake_case to
// match SQLite/dumping-tool conventions; src/db/types.ts holds the camelCase
// TS mirror used by application code.

export const REFERENCE_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS regions (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS types (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS backgrounds (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS species (
  slug TEXT PRIMARY KEY,
  dex_number INTEGER NOT NULL,
  name TEXT NOT NULL,
  family_slug TEXT NOT NULL,
  gen INTEGER NOT NULL,
  rarity TEXT NOT NULL CHECK (rarity IN ('standard', 'legendary', 'mythical', 'ultra_beast')),
  region_slug TEXT NOT NULL REFERENCES regions(slug),
  has_male INTEGER NOT NULL CHECK (has_male IN (0, 1)),
  has_female INTEGER NOT NULL CHECK (has_female IN (0, 1)),
  can_mega_evolve INTEGER NOT NULL CHECK (can_mega_evolve IN (0, 1)),
  can_gigantamax INTEGER NOT NULL CHECK (can_gigantamax IN (0, 1))
);

CREATE TABLE IF NOT EXISTS form (
  slug TEXT PRIMARY KEY,
  species_slug TEXT NOT NULL REFERENCES species(slug),
  form_name TEXT NOT NULL,
  costume_name TEXT,
  gender TEXT NOT NULL CHECK (gender IN ('male', 'female', 'unknown')),
  evolves INTEGER NOT NULL CHECK (evolves IN (0, 1)),
  shiny_available INTEGER NOT NULL CHECK (shiny_available IN (0, 1)),
  shadow_available INTEGER NOT NULL CHECK (shadow_available IN (0, 1)),
  dynamax_available INTEGER NOT NULL CHECK (dynamax_available IN (0, 1)),
  regional_exclusive INTEGER NOT NULL CHECK (regional_exclusive IN (0, 1)),
  image_ref TEXT
);

CREATE TABLE IF NOT EXISTS form_types (
  form_slug TEXT NOT NULL REFERENCES form(slug),
  type_slug TEXT NOT NULL REFERENCES types(slug),
  PRIMARY KEY (form_slug, type_slug)
);

CREATE TABLE IF NOT EXISTS mega_variant (
  slug TEXT PRIMARY KEY,
  species_slug TEXT NOT NULL REFERENCES species(slug),
  variant TEXT CHECK (variant IN ('X', 'Y', 'Primal'))
);
`;

export const PERSONAL_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS species_personal (
  species_slug TEXT PRIMARY KEY REFERENCES species(slug),
  registered INTEGER NOT NULL DEFAULT 0 CHECK (registered IN (0, 1)),
  xxl INTEGER NOT NULL DEFAULT 0 CHECK (xxl IN (0, 1)),
  xxs INTEGER NOT NULL DEFAULT 0 CHECK (xxs IN (0, 1)),
  purified INTEGER NOT NULL DEFAULT 0 CHECK (purified IN (0, 1))
);

CREATE TABLE IF NOT EXISTS form_personal (
  form_slug TEXT PRIMARY KEY REFERENCES form(slug),

  caught INTEGER NOT NULL DEFAULT 0 CHECK (caught IN (0, 1)),
  shiny INTEGER NOT NULL DEFAULT 0 CHECK (shiny IN (0, 1)),
  floor INTEGER NOT NULL DEFAULT 0 CHECK (floor IN (0, 1)),
  four_star INTEGER NOT NULL DEFAULT 0 CHECK (four_star IN (0, 1)),
  shundo INTEGER NOT NULL DEFAULT 0 CHECK (shundo IN (0, 1)),

  lucky INTEGER NOT NULL DEFAULT 0 CHECK (lucky IN (0, 1)),
  lucky_shiny INTEGER NOT NULL DEFAULT 0 CHECK (lucky_shiny IN (0, 1)),
  lucky_floor INTEGER NOT NULL DEFAULT 0 CHECK (lucky_floor IN (0, 1)),
  lucky_four_star INTEGER NOT NULL DEFAULT 0 CHECK (lucky_four_star IN (0, 1)),
  lucky_shundo INTEGER NOT NULL DEFAULT 0 CHECK (lucky_shundo IN (0, 1)),

  shadow INTEGER NOT NULL DEFAULT 0 CHECK (shadow IN (0, 1)),
  shadow_shiny INTEGER NOT NULL DEFAULT 0 CHECK (shadow_shiny IN (0, 1)),
  shadow_floor INTEGER NOT NULL DEFAULT 0 CHECK (shadow_floor IN (0, 1)),
  shadow_four_star INTEGER NOT NULL DEFAULT 0 CHECK (shadow_four_star IN (0, 1)),
  shadow_shundo INTEGER NOT NULL DEFAULT 0 CHECK (shadow_shundo IN (0, 1)),

  dynamax INTEGER NOT NULL DEFAULT 0 CHECK (dynamax IN (0, 1)),
  dynamax_floor INTEGER NOT NULL DEFAULT 0 CHECK (dynamax_floor IN (0, 1)),
  dynamax_shiny INTEGER NOT NULL DEFAULT 0 CHECK (dynamax_shiny IN (0, 1)),
  dynamax_four_star INTEGER NOT NULL DEFAULT 0 CHECK (dynamax_four_star IN (0, 1)),
  dynamax_shundo INTEGER NOT NULL DEFAULT 0 CHECK (dynamax_shundo IN (0, 1)),

  lucky_dynamax INTEGER NOT NULL DEFAULT 0 CHECK (lucky_dynamax IN (0, 1)),
  lucky_dynamax_floor INTEGER NOT NULL DEFAULT 0 CHECK (lucky_dynamax_floor IN (0, 1)),
  lucky_dynamax_shiny INTEGER NOT NULL DEFAULT 0 CHECK (lucky_dynamax_shiny IN (0, 1)),
  lucky_dynamax_four_star INTEGER NOT NULL DEFAULT 0 CHECK (lucky_dynamax_four_star IN (0, 1)),
  lucky_dynamax_shundo INTEGER NOT NULL DEFAULT 0 CHECK (lucky_dynamax_shundo IN (0, 1)),

  best_shiny TEXT,
  best_non_shiny TEXT,
  best_lucky TEXT
);

-- A background can be linked to any specific tracked variant of a form
-- (achievement_field is one of form_personal's boolean column names, e.g.
-- 'caught', 'lucky', 'shiny', 'shadow_shundo') since each variant represents
-- a distinct individually-owned Pokémon that can carry its own background.
-- Always optional: no row means no background recorded for that variant.
CREATE TABLE IF NOT EXISTS form_background_personal (
  form_slug TEXT NOT NULL REFERENCES form(slug),
  achievement_field TEXT NOT NULL,
  background_slug TEXT NOT NULL REFERENCES backgrounds(slug),
  PRIMARY KEY (form_slug, achievement_field, background_slug)
);

CREATE TABLE IF NOT EXISTS mega_personal (
  mega_variant_slug TEXT PRIMARY KEY REFERENCES mega_variant(slug),
  evolved INTEGER NOT NULL DEFAULT 0 CHECK (evolved IN (0, 1)),
  shiny_evolved INTEGER NOT NULL DEFAULT 0 CHECK (shiny_evolved IN (0, 1))
);
`;

export const CURRENT_PERSONAL_SCHEMA_VERSION = 1;
