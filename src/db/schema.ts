// SQL DDL for GoBuddy's reference-table schema (personal tables' DDL moved
// to src/db/schema/personal.ts's Drizzle definitions — see
// docs/data-model.md's "Migration runner (Drizzle)" section). Consumed by
// scripts/build-dummy-db.ts and src/db/reference-sync.ts's wholesale
// drop/recreate. Column names are snake_case to match SQLite/dumping-tool
// conventions; src/db/types.ts holds the camelCase TS mirror used by
// application code for these reference tables.

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

CREATE INDEX IF NOT EXISTS idx_species_region_slug ON species(region_slug);

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

-- completion-stats-sql.ts's per-lens queries correlate a subquery over the
-- form table for every species row in scope (region or global) — without
-- this, each of those subqueries does a full scan of every form row
-- (~8,000+) per species, which is what made the Stats page slow to load.
CREATE INDEX IF NOT EXISTS idx_form_species_slug ON form(species_slug);

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

CREATE TABLE IF NOT EXISTS move (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('fast', 'charged')),
  type_slug TEXT NOT NULL REFERENCES types(slug),
  power INTEGER,
  energy_delta INTEGER,
  duration_ms INTEGER,
  pvp_power INTEGER,
  pvp_energy_delta INTEGER,
  pvp_turns INTEGER
);

-- Which forms can learn which moves, and whether it's a legacy/Elite-TM
-- move for that form specifically. Sourced from pogoapi.net's "Normal" form
-- movesets only — its form vocabulary doesn't match our costume/region form
-- slugs, so costume-specific learnsets aren't modeled (base movesets don't
-- usually differ by costume in practice).
CREATE TABLE IF NOT EXISTS form_move (
  form_slug TEXT NOT NULL REFERENCES form(slug),
  move_slug TEXT NOT NULL REFERENCES move(slug),
  is_elite INTEGER NOT NULL DEFAULT 0 CHECK (is_elite IN (0, 1)),
  PRIMARY KEY (form_slug, move_slug)
);

CREATE TABLE IF NOT EXISTS species_evolution (
  from_species_slug TEXT NOT NULL REFERENCES species(slug),
  to_species_slug TEXT NOT NULL REFERENCES species(slug),
  candy_required INTEGER,
  item_required TEXT,
  PRIMARY KEY (from_species_slug, to_species_slug)
);

CREATE TABLE IF NOT EXISTS type_effectiveness (
  attacking_type_slug TEXT NOT NULL REFERENCES types(slug),
  defending_type_slug TEXT NOT NULL REFERENCES types(slug),
  multiplier REAL NOT NULL,
  PRIMARY KEY (attacking_type_slug, defending_type_slug)
);

CREATE TABLE IF NOT EXISTS weather_boost (
  weather TEXT NOT NULL,
  type_slug TEXT NOT NULL REFERENCES types(slug),
  PRIMARY KEY (weather, type_slug)
);

CREATE TABLE IF NOT EXISTS player_level (
  level INTEGER PRIMARY KEY,
  cumulative_xp INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS player_level_reward (
  level INTEGER NOT NULL REFERENCES player_level(level),
  sort_order INTEGER NOT NULL,
  item_name TEXT NOT NULL,
  amount INTEGER NOT NULL,
  PRIMARY KEY (level, sort_order)
);

-- pogoapi.net's "badges" -- named medal here, not badge, to avoid colliding
-- with the unrelated Gym Badge Tracker roadmap item (gym-visit badges, a
-- different in-game concept entirely).
CREATE TABLE IF NOT EXISTS medal (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  is_event_medal INTEGER NOT NULL CHECK (is_event_medal IN (0, 1))
);

CREATE TABLE IF NOT EXISTS medal_tier (
  medal_slug TEXT NOT NULL REFERENCES medal(slug),
  rank INTEGER NOT NULL,
  target INTEGER,
  PRIMARY KEY (medal_slug, rank)
);

CREATE TABLE IF NOT EXISTS friendship_level (
  level INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  points_required INTEGER NOT NULL,
  xp_reward INTEGER NOT NULL,
  attack_bonus REAL NOT NULL,
  trading_discount REAL NOT NULL,
  raid_ball_bonus REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS pvp_rank_reward (
  league_rank INTEGER NOT NULL,
  track TEXT NOT NULL CHECK (track IN ('free', 'premium')),
  sort_order INTEGER NOT NULL,
  reward_type TEXT NOT NULL,
  item_name TEXT,
  amount INTEGER,
  PRIMARY KEY (league_rank, track, sort_order)
);

CREATE TABLE IF NOT EXISTS pvp_rank_requirement (
  rank INTEGER PRIMARY KEY,
  additional_battles_required INTEGER,
  additional_battle_wins_required INTEGER
);

-- "Current rotation" snapshot data, same wholesale-replace-on-sync model as
-- other reference tables — just refreshed more often in practice.
CREATE TABLE IF NOT EXISTS raid_boss (
  tier TEXT NOT NULL,
  form_slug TEXT NOT NULL REFERENCES form(slug),
  min_cp INTEGER NOT NULL,
  max_cp INTEGER NOT NULL,
  min_boosted_cp INTEGER NOT NULL,
  max_boosted_cp INTEGER NOT NULL,
  possible_shiny INTEGER NOT NULL CHECK (possible_shiny IN (0, 1)),
  PRIMARY KEY (tier, form_slug)
);

CREATE TABLE IF NOT EXISTS raid_boss_weather_boost (
  tier TEXT NOT NULL,
  form_slug TEXT NOT NULL,
  weather TEXT NOT NULL,
  PRIMARY KEY (tier, form_slug, weather),
  FOREIGN KEY (tier, form_slug) REFERENCES raid_boss(tier, form_slug)
);

CREATE TABLE IF NOT EXISTS community_day (
  number INTEGER PRIMARY KEY,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS community_day_bonus (
  community_day_number INTEGER NOT NULL REFERENCES community_day(number),
  bonus TEXT NOT NULL,
  PRIMARY KEY (community_day_number, bonus)
);

CREATE TABLE IF NOT EXISTS community_day_species (
  community_day_number INTEGER NOT NULL REFERENCES community_day(number),
  species_slug TEXT NOT NULL REFERENCES species(slug),
  PRIMARY KEY (community_day_number, species_slug)
);

CREATE TABLE IF NOT EXISTS community_day_event_move (
  community_day_number INTEGER NOT NULL REFERENCES community_day(number),
  species_slug TEXT NOT NULL REFERENCES species(slug),
  move_slug TEXT NOT NULL REFERENCES move(slug),
  PRIMARY KEY (community_day_number, species_slug, move_slug)
);
`;

export const CURRENT_PERSONAL_SCHEMA_VERSION = 6;

// id=1 is the implicit single profile every table's profile_id column
// defaults to today — every fresh install and every migrated existing
// install gets exactly this row, so that default is always valid.
export const DEFAULT_PROFILE_ID = 1;
export const DEFAULT_PROFILE_USERNAME = "Trainer";
