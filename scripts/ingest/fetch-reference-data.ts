// V2 sourcing spike: pulls every pogoapi.net endpoint and pokemon-go-api's
// pokedex/raid/type data into scripts/ingest/.cache-v2/, comprehensively —
// not just the fields the parity build (v2-build-reference.ts) currently
// consumes. This cache is the raw material for both this pass and the
// later schema-extension work (docs/v2-schema-design.md Tier 1/2).
//
// Not part of the real ingestion pipeline. Run with: npm run ingest:v2:fetch
// (safe to re-run — already-downloaded files are skipped).

import { resolve } from "node:path";
import { CACHE_V2_ROOT, fetchToCache } from "./http-cache";

const POGOAPI_ENDPOINTS = [
  "alolan_pokemon", "api_hashes", "baby_pokemon", "badges", "charged_moves",
  "community_days", "cp_multiplier", "current_pokemon_moves", "fast_moves",
  "friendship_level_settings", "galarian_pokemon", "gobattle_league_rewards",
  "gobattle_ranking_settings", "levelup_rewards", "mega_evolution_settings",
  "mega_pokemon", "nesting_pokemon", "photobomb_exclusive_pokemon",
  "player_xp_requirements", "pokemon_buddy_distances",
  "pokemon_candy_to_evolve", "pokemon_encounter_data", "pokemon_evolutions",
  "pokemon_forms", "pokemon_genders", "pokemon_generations",
  "pokemon_height_weight_scale", "pokemon_max_cp", "pokemon_names",
  "pokemon_powerup_requirements", "pokemon_rarity", "pokemon_stats",
  "pokemon_types", "possible_ditto_pokemon", "pvp_charged_moves",
  "pvp_exclusive_pokemon", "pvp_fast_moves", "raid_bosses",
  "raid_exclusive_pokemon", "raid_settings", "released_pokemon",
  "research_task_exclusive_pokemon", "shadow_pokemon", "shiny_pokemon",
  "time_limited_shiny_pokemon", "type_effectiveness", "weather_boosts",
] as const;

const PGAPI_BASE = "https://pokemon-go-api.github.io/pokemon-go-api/api";
const PGAPI_FILES: Record<string, string> = {
  "pgapi/pokedex.json": `${PGAPI_BASE}/pokedex.json`,
  "pgapi/raidboss.json": `${PGAPI_BASE}/raidboss.json`,
  "pgapi/types.json": `${PGAPI_BASE}/types.json`,
  "pgapi/mega.json": `${PGAPI_BASE}/pokedex/mega.json`,
};

async function main() {
  console.log("pogoapi.net:");
  for (const name of POGOAPI_ENDPOINTS) {
    const path = resolve(CACHE_V2_ROOT, "pogoapi", `${name}.json`);
    await fetchToCache(`https://pogoapi.net/api/v1/${name}.json`, path);
    console.log(`  ${name}.json`);
  }

  console.log("pokemon-go-api:");
  for (const [relPath, url] of Object.entries(PGAPI_FILES)) {
    await fetchToCache(url, resolve(CACHE_V2_ROOT, relPath));
    console.log(`  ${relPath}`);
  }

  console.log(`\nDone. Cache root: ${CACHE_V2_ROOT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
