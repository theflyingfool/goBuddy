import { test } from "node:test";
import assert from "node:assert/strict";
import { DOMAIN_TABLE_MAP, buildReferenceDataFromGoRefs } from "../scripts/ingest/gorefs/domains";
import type { GoRefsConnection } from "../scripts/ingest/gorefs/query";

function fakeConnection(tables: Record<string, unknown[]>): GoRefsConnection {
  return {
    queryTable: async (name) => (tables[name] ?? []) as never,
    close: async () => {},
  };
}

test("DOMAIN_TABLE_MAP sends every ReferenceData domain (except regions/types/backgrounds) to its refjson_* table", () => {
  assert.equal(DOMAIN_TABLE_MAP.species, "refjson_species");
  assert.equal(DOMAIN_TABLE_MAP.forms, "refjson_forms");
  assert.equal(DOMAIN_TABLE_MAP.formMoves, "refjson_form_moves");
  assert.equal(DOMAIN_TABLE_MAP.pvpRankRewards, "refjson_pvp_rank_rewards");
  assert.equal("regions" in DOMAIN_TABLE_MAP, false);
  assert.equal("types" in DOMAIN_TABLE_MAP, false);
  assert.equal("backgrounds" in DOMAIN_TABLE_MAP, false);
});

test("buildReferenceDataFromGoRefs assembles every mapped domain from its table", async () => {
  const conn = fakeConnection({
    refjson_species: [{ slug: "bulbasaur", dexNumber: 1 }],
    refjson_forms: [{ slug: "bulbasaur-standard" }],
    refjson_form_types: [],
    refjson_mega_variants: [],
    refjson_moves: [],
    refjson_form_moves: [],
    refjson_species_evolutions: [],
    refjson_type_effectiveness: [],
    refjson_weather_boosts: [],
    refjson_player_levels: [],
    refjson_player_level_rewards: [],
    refjson_medals: [],
    refjson_medal_tiers: [],
    refjson_friendship_levels: [],
    refjson_pvp_rank_rewards: [],
    refjson_pvp_rank_requirements: [],
  });

  const result = await buildReferenceDataFromGoRefs(conn);

  assert.deepEqual(result.species, [{ slug: "bulbasaur", dexNumber: 1 }]);
  assert.deepEqual(result.forms, [{ slug: "bulbasaur-standard" }]);
  assert.deepEqual(result.raidBosses, []);
  assert.deepEqual(result.raidBossWeatherBoosts, []);
  assert.deepEqual(result.communityDays, []);
  assert.deepEqual(result.communityDayBonuses, []);
  assert.deepEqual(result.communityDaySpecies, []);
  assert.deepEqual(result.communityDayEventMoves, []);
});
