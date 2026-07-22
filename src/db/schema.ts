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

export const PERSONAL_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Local-only trainer profile — never an auth account (this app talks to no
-- server), just an identity to hang personal data on. friend_code is
-- captured here (rather than left for later) since it's effectively
-- immutable in-game and cheap to ask for once, up front. Every other
-- personal table gets a profile_id column (below) so a future "send my
-- collection to another trainer's install" feature has something to key
-- on — deliberately NOT yet part of any table's PRIMARY KEY, since nothing
-- in the app switches between profiles today; making that real (composite
-- keys, a repository-layer "current profile" concept) is deferred until
-- multi-profile is an actual feature, not just schema groundwork.
CREATE TABLE IF NOT EXISTS profile (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL,
  friend_code TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS species_personal (
  species_slug TEXT PRIMARY KEY REFERENCES species(slug),
  profile_id INTEGER NOT NULL DEFAULT 1 REFERENCES profile(id),
  registered INTEGER NOT NULL DEFAULT 0 CHECK (registered IN (0, 1)),
  xxl INTEGER NOT NULL DEFAULT 0 CHECK (xxl IN (0, 1)),
  xxs INTEGER NOT NULL DEFAULT 0 CHECK (xxs IN (0, 1)),
  purified INTEGER NOT NULL DEFAULT 0 CHECK (purified IN (0, 1)),
  updated_at TEXT NOT NULL DEFAULT '1970-01-01T00:00:00.000Z'
);

CREATE TABLE IF NOT EXISTS form_personal (
  form_slug TEXT PRIMARY KEY REFERENCES form(slug),
  profile_id INTEGER NOT NULL DEFAULT 1 REFERENCES profile(id),

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
  best_lucky TEXT,

  updated_at TEXT NOT NULL DEFAULT '1970-01-01T00:00:00.000Z'
);

-- A background can be linked to any specific tracked variant of a form
-- (achievement_field is one of form_personal's boolean column names, e.g.
-- 'caught', 'lucky', 'shiny', 'shadow_shundo') since each variant represents
-- a distinct individually-owned Pokémon that can carry its own background.
-- Always optional: no row means no background recorded for that variant.
CREATE TABLE IF NOT EXISTS form_background_personal (
  form_slug TEXT NOT NULL REFERENCES form(slug),
  profile_id INTEGER NOT NULL DEFAULT 1 REFERENCES profile(id),
  achievement_field TEXT NOT NULL,
  background_slug TEXT NOT NULL REFERENCES backgrounds(slug),
  updated_at TEXT NOT NULL DEFAULT '1970-01-01T00:00:00.000Z',
  PRIMARY KEY (form_slug, achievement_field, background_slug)
);

CREATE TABLE IF NOT EXISTS mega_personal (
  mega_variant_slug TEXT PRIMARY KEY REFERENCES mega_variant(slug),
  profile_id INTEGER NOT NULL DEFAULT 1 REFERENCES profile(id),
  evolved INTEGER NOT NULL DEFAULT 0 CHECK (evolved IN (0, 1)),
  shiny_evolved INTEGER NOT NULL DEFAULT 0 CHECK (shiny_evolved IN (0, 1)),
  updated_at TEXT NOT NULL DEFAULT '1970-01-01T00:00:00.000Z'
);

-- Individual caught-specimen log — the "I have 30 random Pikachu" case
-- form_personal's achievement flags can't answer (those track "have I ever
-- obtained this tier", not "how many do I currently hold"). Everything but
-- form_slug/profile_id/recorded_at is optional on purpose, so bulk-adding a
-- pile of low-value catches without filling in details stays fast.
--
-- current_mega_level lives here, NOT on mega_personal: Mega Level turned
-- out to be per-INDIVIDUAL, not species-wide (confirmed directly by the
-- owner — two caught Charizard can be at different Mega Levels from each
-- other). mega_personal.evolved/shiny_evolved stay species-wide, since
-- "have I ever Mega Evolved this species at all" genuinely is a one-time
-- achievement regardless of which individual did it; only the *level*
-- progress is per-individual. Whether a species caps at level 3 or 4 is
-- still an unverified real-game fact, not modeled here.
CREATE TABLE IF NOT EXISTS pokemon_instance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  form_slug TEXT NOT NULL REFERENCES form(slug),
  profile_id INTEGER NOT NULL REFERENCES profile(id),
  status TEXT NOT NULL DEFAULT 'kept' CHECK (status IN ('kept', 'traded', 'released', 'evolved')),
  -- When this row was actually created (always known, defaulted in code) --
  -- distinct from caught_at, the real in-game catch date, which is often
  -- unknown for backfilled specimens.
  recorded_at TEXT NOT NULL,
  caught_at TEXT,
  updated_at TEXT NOT NULL,
  cp INTEGER,
  iv_percent REAL,
  shiny INTEGER NOT NULL DEFAULT 0 CHECK (shiny IN (0, 1)),
  lucky INTEGER NOT NULL DEFAULT 0 CHECK (lucky IN (0, 1)),
  shadow INTEGER NOT NULL DEFAULT 0 CHECK (shadow IN (0, 1)),
  purified INTEGER NOT NULL DEFAULT 0 CHECK (purified IN (0, 1)),
  -- Buddy Level is based on cumulative hearts earned with this specific
  -- individual (only one Pokémon is ever your buddy at a time) -- storing
  -- the raw count rather than a derived tier, since the exact hearts-per-
  -- tier thresholds haven't been confirmed against a real source yet.
  hearts_earned INTEGER,
  -- Only meaningful for an individual that's actually been Mega Evolved
  -- (see the table comment above for why this isn't on mega_personal).
  current_mega_level INTEGER,
  nickname TEXT,
  background_slug TEXT REFERENCES backgrounds(slug)
);

CREATE TABLE IF NOT EXISTS tag (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id INTEGER NOT NULL REFERENCES profile(id),
  name TEXT NOT NULL,
  UNIQUE (profile_id, name)
);

CREATE TABLE IF NOT EXISTS pokemon_instance_tag (
  pokemon_instance_id INTEGER NOT NULL REFERENCES pokemon_instance(id),
  tag_id INTEGER NOT NULL REFERENCES tag(id),
  PRIMARY KEY (pokemon_instance_id, tag_id)
);

-- Max Move levels — per INDIVIDUAL, same correction as current_mega_level
-- above (confirmed by the owner: two Dynamax-capable individuals of the
-- same species level their Max Moves independently), so this is keyed by
-- pokemon_instance, not form_slug. Still NOT gated on
-- form.dynamax_available/species.can_gigantamax -- some forms (e.g.
-- Zacian's Crowned Sword) have Max Move access without being flagged
-- Dynamax-capable the normal way, so a row here shouldn't be assumed to
-- imply that flag either. move_slot is a provisional free-text identifier
-- (not a verified enum): the exact Max Move mechanic (how many slots,
-- whether a slot's move type is fixed or follows whatever fast/charged
-- moves are currently equipped) hasn't been confirmed against a real
-- source yet -- don't build UI assuming a specific slot count or naming
-- until that's verified.
CREATE TABLE IF NOT EXISTS pokemon_instance_max_move (
  pokemon_instance_id INTEGER NOT NULL REFERENCES pokemon_instance(id),
  move_slot TEXT NOT NULL,
  level INTEGER,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (pokemon_instance_id, move_slot)
);

-- Deliberately separate from the profile table (identity) -- level/XP
-- changes constantly, identity doesn't. References player_level (this
-- file's Tier-1 reference table) for the XP-per-level lookup.
CREATE TABLE IF NOT EXISTS player_progress_personal (
  profile_id INTEGER PRIMARY KEY REFERENCES profile(id),
  current_level INTEGER REFERENCES player_level(level),
  total_xp INTEGER,
  updated_at TEXT NOT NULL
);

-- Landing zone for personal rows reference-sync.ts finds orphaned (their
-- slug no longer exists in a freshly-synced reference.json, and wasn't
-- covered by a src/db/slug-renames.ts entry) — holds the row's full data as
-- JSON so it isn't silently lost, without the FK constraints the real
-- personal tables carry (a quarantined row's slug is, by definition, one
-- reference-sync can't resolve). Inert: nothing reads this table back today
-- — it's a manual-recovery/debugging aid, not a feature.
CREATE TABLE IF NOT EXISTS personal_data_quarantine (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_table TEXT NOT NULL,
  slug TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  quarantined_at TEXT NOT NULL
);
`;

export const CURRENT_PERSONAL_SCHEMA_VERSION = 4;

// id=1 is the implicit single profile every table's profile_id column
// defaults to today — every fresh install and every migrated existing
// install gets exactly this row, so that default is always valid.
export const DEFAULT_PROFILE_ID = 1;
export const DEFAULT_PROFILE_USERNAME = "Trainer";
