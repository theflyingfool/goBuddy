// The shape of the bundled src/data/reference.json asset — every reference
// table as a flat array, keyed by slug per CLAUDE.md's schema design.
// Personal tables are never part of this file.

import type {
  Background,
  CommunityDay,
  CommunityDayBonus,
  CommunityDayEventMove,
  CommunityDaySpecies,
  FriendshipLevel,
  Form,
  FormMove,
  FormType,
  MedalTier,
  Medal,
  MegaVariant,
  Move,
  PlayerLevel,
  PlayerLevelReward,
  PokemonType,
  PvpRankRequirement,
  PvpRankReward,
  RaidBoss,
  RaidBossWeatherBoost,
  Region,
  Species,
  SpeciesEvolution,
  TypeEffectiveness,
  WeatherBoost,
} from "./types";

export interface ReferenceData {
  regions: Region[];
  types: PokemonType[];
  backgrounds: Background[];
  species: Species[];
  forms: Form[];
  formTypes: FormType[];
  megaVariants: MegaVariant[];
  moves: Move[];
  formMoves: FormMove[];
  speciesEvolutions: SpeciesEvolution[];
  typeEffectiveness: TypeEffectiveness[];
  weatherBoosts: WeatherBoost[];
  playerLevels: PlayerLevel[];
  playerLevelRewards: PlayerLevelReward[];
  medals: Medal[];
  medalTiers: MedalTier[];
  friendshipLevels: FriendshipLevel[];
  pvpRankRewards: PvpRankReward[];
  pvpRankRequirements: PvpRankRequirement[];
  raidBosses: RaidBoss[];
  raidBossWeatherBoosts: RaidBossWeatherBoost[];
  communityDays: CommunityDay[];
  communityDayBonuses: CommunityDayBonus[];
  communityDaySpecies: CommunityDaySpecies[];
  communityDayEventMoves: CommunityDayEventMove[];
}

// Side file (reference-gaps.json) the Coverage Report reads — things worth
// a human double-checking, not hard ingestion failures.
export interface ReferenceGap {
  kind:
    | "mega-discrepancy"
    | "unverified-gender"
    | "missing-types"
    | "inherited-availability"
    | "possible-bogus-form"
    | "guessed-costume-name"
    | "missing-species"
    | "gigantamax-mismatch"
    | "family-root-mismatch";
  speciesSlug: string;
  formSlug?: string;
  note: string;
}
