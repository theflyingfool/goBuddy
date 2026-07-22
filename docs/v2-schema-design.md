# V2 Reference Schema — Design Sketch

Draft, not final DDL. Follows Phase 0's sourcing decision
([v2-data-source-findings.md](v2-data-source-findings.md) §10): species/
forms/costumes/mega from `pokemon-go-api`, everything else from pogoapi.net.
Conventions match the existing schema (`src/db/schema.ts`): `snake_case`
columns, `slug` text primary keys where the source gives us a stable
identity, boolean columns as `INTEGER CHECK (col IN (0, 1))`, reference
tables wholesale-replaced on content-hash diff (`reference-sync.ts`), never
migrated — only personal tables go through `migrations.ts`.

Two-tier split, to balance "keep almost all data" against not building
tables nobody uses yet ([CLAUDE.md](/home/nick/Repos/GoBuddy/CLAUDE.md):
don't design for hypothetical requirements): **Tier 1** is real schema,
sketched below with DDL. **Tier 2** is data we should keep fetching and
caching in the ingestion pipeline's intermediate layer, but not promote to
a DB table until a specific feature is scheduled to consume it — listed at
the end without DDL.

---

## 1. Existing tables — extended, not replaced

`species`, `form`, `form_types`, `mega_variant` keep their current shape and
gain columns. No renames — `reference-sync.ts`'s wholesale-replace model
means old columns can just stop being populated if ever dropped, but adding
columns is the common case here.

```sql
-- form: add battle stats (Mega/regional forms have different stats than
-- their base form, so these belong on `form`, not `species`).
ALTER TABLE form ADD COLUMN base_attack INTEGER;
ALTER TABLE form ADD COLUMN base_defense INTEGER;
ALTER TABLE form ADD COLUMN base_stamina INTEGER;

-- form_types: preserve primary/secondary order pokemon-go-api gives us.
-- The existing (form_slug, type_slug) join already supports 1-2 types per
-- form; this just keeps which one is primary for display purposes.
ALTER TABLE form_types ADD COLUMN type_order INTEGER NOT NULL DEFAULT 1
  CHECK (type_order IN (1, 2));

-- mega_variant: energy cost and stats, sourced from pokemon-go-api's
-- megaEvolutions{} (57/57 exact match against our current data, see
-- v2-pokemon-go-api-full-pull.md §3).
ALTER TABLE mega_variant ADD COLUMN base_attack INTEGER;
ALTER TABLE mega_variant ADD COLUMN base_defense INTEGER;
ALTER TABLE mega_variant ADD COLUMN base_stamina INTEGER;
ALTER TABLE mega_variant ADD COLUMN energy_cost INTEGER;
ALTER TABLE mega_variant ADD COLUMN first_time_energy_cost INTEGER;
```

**Gigantamax stays as-is** — already modeled as ordinary `form` rows
(`dynamax_available`), a settled decision per
[roadmap.md §4](roadmap.md#4-v2-watchlist-deferred-with-rationale). No new
table. The `canGigantamax` vs. `hasGigantamaxEvolution` discrepancy (32 vs.
15, [findings §11](v2-data-source-findings.md#11-gigantamax-discrepancy--full-diff))
is a data-correction to `species.can_gigantamax`, not a schema change.

**`pokemonClass`/rarity reconciliation**: keep `species.rarity` as the
source of truth (it already models legendary/mythical/ultra_beast);
cross-check pokemon-go-api's `pokemonClass` against it during ingestion as a
validation step, don't add a second column for the same concept.

**Multi-language names — default: skip.** `pokemon-go-api` gives 7
languages on nearly every object; our schema is English-only today and
nothing in the roadmap has asked for i18n. Treating this as a deliberate
"not doing this" rather than silently dropping the data on ingest — revisit
only if a real localization ask shows up.

---

## 2. New tables — Tier 1

### Moves

```sql
CREATE TABLE IF NOT EXISTS move (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('fast', 'charged')),
  type_slug TEXT NOT NULL REFERENCES types(slug),
  power INTEGER NOT NULL,
  energy_delta INTEGER NOT NULL,
  duration_ms INTEGER NOT NULL,
  pvp_power INTEGER,
  pvp_energy_delta INTEGER,
  pvp_turns INTEGER
);

-- Which forms can learn which moves, and whether it's a legacy/Elite-TM
-- move for that form specifically (the same move can be standard for one
-- species and legacy for another, so this belongs on the join, not `move`).
CREATE TABLE IF NOT EXISTS form_move (
  form_slug TEXT NOT NULL REFERENCES form(slug),
  move_slug TEXT NOT NULL REFERENCES move(slug),
  is_elite INTEGER NOT NULL DEFAULT 0 CHECK (is_elite IN (0, 1)),
  PRIMARY KEY (form_slug, move_slug)
);
```

### Evolutions

Currently only `species.family_slug` groups a whole evolution line under one
slug — no stage order or candy cost. This is genuinely new capability, and
directly backs the already-planned **Evolution Candy Calculator** roadmap
item.

```sql
CREATE TABLE IF NOT EXISTS species_evolution (
  from_species_slug TEXT NOT NULL REFERENCES species(slug),
  to_species_slug TEXT NOT NULL REFERENCES species(slug),
  candy_required INTEGER,
  item_required TEXT,
  PRIMARY KEY (from_species_slug, to_species_slug)
);
```

### Type effectiveness & weather

```sql
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
```

### Player progression (the previously-uncovered category)

```sql
CREATE TABLE IF NOT EXISTS player_level (
  level INTEGER PRIMARY KEY,
  cumulative_xp INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS player_level_reward (
  level INTEGER NOT NULL REFERENCES player_level(level),
  item_name TEXT NOT NULL,
  amount INTEGER NOT NULL,
  PRIMARY KEY (level, item_name)
);

-- pogoapi.net's "badges" — named `medal` here, not `badge`, to avoid
-- colliding with the unrelated Gym Badge Tracker roadmap item (gym-visit
-- badges, a different in-game concept entirely).
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
  raid_ball_bonus INTEGER NOT NULL
);
```

### PvP

```sql
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
```

### Raids & events

Both are naturally "current snapshot, wholesale-replaced" data — the same
sync model reference tables already use, just refreshed more often in
practice than species data.

```sql
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
  form_slug TEXT NOT NULL REFERENCES form(slug),
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
```

---

## 3. Tier 2 — cache in the pipeline, don't table yet

Available from pogoapi.net, genuinely useful, but each backs a specific
*not-yet-scheduled* calculator/tracker roadmap item. Keep fetching and
caching these in the ingestion pipeline's intermediate layer (so nothing
has to be re-scraped later) but hold off on a permanent table until the
owning feature is actually scheduled:

| Data | Backs | Endpoint |
| :--- | :--- | :--- |
| Height/weight/scale, XS/XL thresholds | Showcase Score Calculator | `pokemon_height_weight_scale.json` |
| Capture/flee rate, action frequency | Catch Rate Calculator | `pokemon_encounter_data.json` |
| Power-up stardust/candy cost per level | (supports CP calculators generally) | `pokemon_powerup_requirements.json` |
| Buddy walking distance | Buddy Heart Daily Tracker | `pokemon_buddy_distances.json` |
| CP multiplier per level | Wild 100% IV CP Lookup, PVP Rank Calculator | `cp_multiplier.json` |
| Max CP at level 40 | Wild 100% IV CP Lookup | `pokemon_max_cp.json` |

---

## 4. Personal-table implications (not built now — flagging for later)

New reference categories that track *progress against a definition* (player
level, medals, friendship) will eventually need personal-table counterparts
once Phase 1 (timestamps + migration backfill) and Phase 2 (multi-account)
land — e.g. `player_progress_personal` (current level/XP per profile),
`medal_progress_personal` (current count per medal per profile). Out of
scope for this Tier 1 sketch, which is reference data only, but the two
phases should account for these when they're designed for real.

---

## 5. Open questions before this becomes real migrations

1. `raid_boss`/`community_day` refresh more often than species data — does
   the existing reference-sync hash-diff mechanism handle that refresh
   cadence fine as-is, or does it need its own sync path?
2. `species_evolution`'s `item_required` is a free-text column for now
   (e.g. "King's Rock") — fine until an Item reference table exists to
   normalize against; not building one speculatively per the Tier 2 split
   above.
3. Confirm `form_move`/`move` actually gets consumed by a real feature
   before writing the ingestion code for it — right now nothing on the
   roadmap directly needs move data yet (PVP/PVE Team Builder and Raid
   Counter Simulator would, but neither is scheduled).
