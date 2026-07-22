-- Reproduces a real shipped v1.0.0 device: personal-schema v6 exactly as
-- src/db/schema.ts's PERSONAL_SCHEMA_SQL defined it (git history, pre-Drizzle),
-- with ISO-string TEXT timestamps — not the new Drizzle epoch-ms shape.
CREATE TABLE schema_version (version INTEGER NOT NULL);
INSERT INTO schema_version (version) VALUES (6);

CREATE TABLE app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);

CREATE TABLE profile (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL,
  friend_code TEXT,
  created_at TEXT NOT NULL
);
INSERT INTO profile (id, username, friend_code, created_at) VALUES (1, 'Trainer', NULL, '2026-01-01T00:00:00.000Z');

CREATE TABLE species_personal (
  species_slug TEXT PRIMARY KEY,
  profile_id INTEGER NOT NULL DEFAULT 1,
  registered INTEGER NOT NULL DEFAULT 0,
  xxl INTEGER NOT NULL DEFAULT 0,
  xxs INTEGER NOT NULL DEFAULT 0,
  purified INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT '1970-01-01T00:00:00.000Z'
);
INSERT INTO species_personal (species_slug, registered, xxl, updated_at) VALUES ('bulbasaur', 1, 1, '2026-06-15T10:30:00.000Z');

-- Full column set matching 0000_baseline.sql exactly (not the abbreviated
-- version in the task brief) — migration 0001's rebuild SELECTs every one
-- of these columns by name, and a real v6 device has all of them.
CREATE TABLE form_personal (
  form_slug TEXT PRIMARY KEY,
  profile_id INTEGER NOT NULL DEFAULT 1,
  caught INTEGER NOT NULL DEFAULT 0,
  shiny INTEGER NOT NULL DEFAULT 0,
  floor INTEGER NOT NULL DEFAULT 0,
  four_star INTEGER NOT NULL DEFAULT 0,
  shundo INTEGER NOT NULL DEFAULT 0,
  lucky INTEGER NOT NULL DEFAULT 0,
  lucky_shiny INTEGER NOT NULL DEFAULT 0,
  lucky_floor INTEGER NOT NULL DEFAULT 0,
  lucky_four_star INTEGER NOT NULL DEFAULT 0,
  lucky_shundo INTEGER NOT NULL DEFAULT 0,
  shadow INTEGER NOT NULL DEFAULT 0,
  shadow_shiny INTEGER NOT NULL DEFAULT 0,
  shadow_floor INTEGER NOT NULL DEFAULT 0,
  shadow_four_star INTEGER NOT NULL DEFAULT 0,
  shadow_shundo INTEGER NOT NULL DEFAULT 0,
  dynamax INTEGER NOT NULL DEFAULT 0,
  dynamax_floor INTEGER NOT NULL DEFAULT 0,
  dynamax_shiny INTEGER NOT NULL DEFAULT 0,
  dynamax_four_star INTEGER NOT NULL DEFAULT 0,
  dynamax_shundo INTEGER NOT NULL DEFAULT 0,
  lucky_dynamax INTEGER NOT NULL DEFAULT 0,
  lucky_dynamax_floor INTEGER NOT NULL DEFAULT 0,
  lucky_dynamax_shiny INTEGER NOT NULL DEFAULT 0,
  lucky_dynamax_four_star INTEGER NOT NULL DEFAULT 0,
  lucky_dynamax_shundo INTEGER NOT NULL DEFAULT 0,
  best_shiny TEXT,
  best_non_shiny TEXT,
  best_lucky TEXT,
  updated_at TEXT NOT NULL DEFAULT '1970-01-01T00:00:00.000Z'
);
INSERT INTO form_personal (form_slug, caught, shiny, updated_at) VALUES ('bulbasaur-standard-male', 1, 1, '2026-06-15T10:31:00.000Z');

CREATE TABLE form_background_personal (
  form_slug TEXT NOT NULL,
  profile_id INTEGER NOT NULL DEFAULT 1,
  achievement_field TEXT NOT NULL,
  background_slug TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT '1970-01-01T00:00:00.000Z',
  PRIMARY KEY (form_slug, achievement_field, background_slug)
);

CREATE TABLE mega_personal (
  mega_variant_slug TEXT PRIMARY KEY,
  profile_id INTEGER NOT NULL DEFAULT 1,
  evolved INTEGER NOT NULL DEFAULT 0,
  shiny_evolved INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT '1970-01-01T00:00:00.000Z'
);

-- Full column set matching 0000_baseline.sql exactly (not the abbreviated
-- version in the task brief) — migration 0001's rebuild SELECTs every one
-- of these columns by name, and a real v6 device has all of them.
CREATE TABLE pokemon_instance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  form_slug TEXT NOT NULL,
  profile_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'kept',
  recorded_at TEXT NOT NULL,
  caught_at TEXT,
  updated_at TEXT NOT NULL,
  cp INTEGER,
  iv_percent REAL,
  shiny INTEGER NOT NULL DEFAULT 0,
  lucky INTEGER NOT NULL DEFAULT 0,
  shadow INTEGER NOT NULL DEFAULT 0,
  purified INTEGER NOT NULL DEFAULT 0,
  hearts_earned INTEGER,
  current_mega_level INTEGER,
  nickname TEXT,
  background_slug TEXT
);
INSERT INTO pokemon_instance (form_slug, profile_id, recorded_at, caught_at, updated_at, cp, shiny)
  VALUES ('bulbasaur-standard-male', 1, '2026-06-15T10:31:00.000Z', '2026-06-14T18:00:00.000Z', '2026-06-15T10:31:00.000Z', 1200, 1);

CREATE TABLE tag (id INTEGER PRIMARY KEY AUTOINCREMENT, profile_id INTEGER NOT NULL, name TEXT NOT NULL, UNIQUE(profile_id, name));
CREATE TABLE pokemon_instance_tag (pokemon_instance_id INTEGER NOT NULL, tag_id INTEGER NOT NULL, PRIMARY KEY (pokemon_instance_id, tag_id));
CREATE TABLE pokemon_instance_max_move (pokemon_instance_id INTEGER NOT NULL, move_slot TEXT NOT NULL, level INTEGER, updated_at TEXT NOT NULL, PRIMARY KEY (pokemon_instance_id, move_slot));
CREATE TABLE player_progress_personal (profile_id INTEGER PRIMARY KEY, current_level INTEGER, total_xp INTEGER, updated_at TEXT NOT NULL);
CREATE TABLE medal_progress_personal (medal_slug TEXT NOT NULL, profile_id INTEGER NOT NULL DEFAULT 1, current_rank INTEGER NOT NULL DEFAULT 0, current_count INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL, PRIMARY KEY (medal_slug, profile_id));
CREATE TABLE player_progress_log (id INTEGER PRIMARY KEY AUTOINCREMENT, profile_id INTEGER NOT NULL DEFAULT 1, recorded_at TEXT NOT NULL, current_level INTEGER, total_xp INTEGER);
CREATE TABLE personal_data_quarantine (id INTEGER PRIMARY KEY AUTOINCREMENT, source_table TEXT NOT NULL, slug TEXT NOT NULL, payload_json TEXT NOT NULL, quarantined_at TEXT NOT NULL);
