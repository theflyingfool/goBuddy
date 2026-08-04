// Maps every ReferenceData domain to its GoRefs table and assembles the
// result. Every domain here reads from a refjson_* shim table -- a
// deliberate, uniform, documented choice (see the design doc's Domain
// mapping section) for this first cut, not an oversight. regions/types are
// derived elsewhere (same as today); backgrounds ships empty (also
// unchanged from today's other empty domains); raidBosses/communityDays
// ship empty because GoRefs' canonical data for them was verified unusable
// (dangling form-slug FKs / placeholder rows -- see the design doc).

import type { GoRefsConnection } from "./query";
import type { ReferenceData } from "../../../src/db/reference-data";

export const DOMAIN_TABLE_MAP = {
  species: "refjson_species",
  forms: "refjson_forms",
  formTypes: "refjson_form_types",
  megaVariants: "refjson_mega_variants",
  moves: "refjson_moves",
  formMoves: "refjson_form_moves",
  speciesEvolutions: "refjson_species_evolutions",
  typeEffectiveness: "refjson_type_effectiveness",
  weatherBoosts: "refjson_weather_boosts",
  playerLevels: "refjson_player_levels",
  playerLevelRewards: "refjson_player_level_rewards",
  medals: "refjson_medals",
  medalTiers: "refjson_medal_tiers",
  friendshipLevels: "refjson_friendship_levels",
  pvpRankRewards: "refjson_pvp_rank_rewards",
  pvpRankRequirements: "refjson_pvp_rank_requirements",
} as const;

type MappedDomains = keyof typeof DOMAIN_TABLE_MAP;

export async function buildReferenceDataFromGoRefs(
  conn: GoRefsConnection,
): Promise<Omit<ReferenceData, "regions" | "types" | "backgrounds">> {
  const entries = await Promise.all(
    (Object.keys(DOMAIN_TABLE_MAP) as MappedDomains[]).map(
      async (domain) => [domain, await conn.queryTable(DOMAIN_TABLE_MAP[domain])] as const,
    ),
  );
  const mapped = Object.fromEntries(entries) as Pick<ReferenceData, MappedDomains>;

  return {
    ...mapped,
    raidBosses: [],
    raidBossWeatherBoosts: [],
    communityDays: [],
    communityDayBonuses: [],
    communityDaySpecies: [],
    communityDayEventMoves: [],
  };
}
