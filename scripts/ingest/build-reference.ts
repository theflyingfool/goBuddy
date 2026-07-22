// V2 sourcing spike — the parity build. Consumes ONLY scripts/ingest/.cache-v2
// data (pokemon-go-api + pogoapi.net) — no PokeAPI, no CSVs, no wikitext —
// and produces a candidate reference.json in the same shape
// build-reference.ts produces today, to see how close the new sources get
// before extending to any new tables. See docs/v2-schema-design.md and the
// V2 ingestion plan for context.
//
// Several fields in the current schema are hand-curated tracker data (per-
// form shiny/shadow/dynamax availability) that neither new source exposes
// directly — these are approximated here (documented inline) and are
// expected to show up as differences in v2-compare-reference.ts's report,
// not silently treated as correct.
//
// Requires: npm run ingest:v2:fetch (and, for full parity checking,
// ingest:v2:fetch-assets). Run with: npm run ingest:v2:build

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { CACHE_V2_ROOT } from "./http-cache";
import { slugify, formSlug, megaVariantSlug } from "./slug";
import { detectStatelessGaps } from "./gap-detection";
import type {
  Species,
  Form,
  FormType,
  MegaVariant,
  Gender,
  Rarity,
  Move,
  FormMove,
  SpeciesEvolution,
  TypeEffectiveness,
  WeatherBoost,
  PlayerLevel,
  PlayerLevelReward,
  Medal,
  MedalTier,
  FriendshipLevel,
  PvpRankReward,
  PvpRankRequirement,
  RaidBoss,
  RaidBossWeatherBoost,
  CommunityDay,
  CommunityDayBonus,
  CommunityDaySpecies,
  CommunityDayEventMove,
} from "../../src/db/types";
import type { ReferenceData, ReferenceGap } from "../../src/db/reference-data";
import { execFileSync } from "node:child_process";

const REPO_ROOT = resolve(process.cwd());
const GAPS_OUT = resolve(REPO_ROOT, "src/data/reference-gaps.json");

function loadCommittedReferenceData(): ReferenceData | null {
  try {
    const content = execFileSync("git", ["show", "HEAD:src/data/reference.json"], { cwd: REPO_ROOT, encoding: "utf-8", maxBuffer: 32 * 1024 * 1024 });
    return JSON.parse(content) as ReferenceData;
  } catch {
    return null; // brand-new repo, nothing to compare against yet
  }
}

// Comparative gaps: things the V2 sources can't (yet) reproduce from the
// last committed reference.json. Unlike the other ReferenceGap kinds (which
// are a pure function of the current data), these need something to compare
// against — falls back to no gaps at all on a repo with no prior commit.
function buildComparativeGaps(candidate: ReferenceData, previouslyMismatchedFamilyRootDex: Map<number, string>): ReferenceGap[] {
  const previous = loadCommittedReferenceData();
  if (!previous) return [];

  const gaps: ReferenceGap[] = [];
  const candidateDex = new Set(candidate.species.map((s) => s.dexNumber));
  for (const s of previous.species) {
    if (!candidateDex.has(s.dexNumber)) {
      gaps.push({
        kind: "missing-species",
        speciesSlug: s.slug,
        note: `${s.name} (#${s.dexNumber}, previously "${s.slug}") is not reproducible from the current V2 sources — see docs/v2-data-source-findings.md.`,
      });
    }
  }

  const candidateGmaxByDex = new Map(candidate.species.map((s) => [s.dexNumber, s.canGigantamax]));
  for (const s of previous.species) {
    if (s.canGigantamax && candidateGmaxByDex.get(s.dexNumber) === false) {
      const current = candidate.species.find((c) => c.dexNumber === s.dexNumber);
      gaps.push({
        kind: "gigantamax-mismatch",
        speciesSlug: current?.slug ?? s.slug,
        note: `${s.name} (#${s.dexNumber}) can Gigantamax previously, but pokemon-go-api's hasGigantamaxEvolution flag says no — see docs/v2-data-source-findings.md §11.`,
      });
    }
  }

  for (const [dex, note] of previouslyMismatchedFamilyRootDex) {
    const current = candidate.species.find((c) => c.dexNumber === dex);
    if (current) gaps.push({ kind: "family-root-mismatch", speciesSlug: current.slug, note });
  }

  return gaps;
}

function loadPogoapi<T>(name: string): T {
  return JSON.parse(readFileSync(resolve(CACHE_V2_ROOT, "pogoapi", `${name}.json`), "utf-8")) as T;
}

interface MoveRecord {
  move_id: number;
  name: string;
  power: number;
  energy_delta: number;
  duration: number;
  type: string;
}
interface PvpMoveRecord {
  move_id: number;
  power: number;
  energy_delta: number;
  turn_duration: number;
}

// Returns the built moves plus a name -> slug lookup (form_move/
// community_day_event_move reference moves by name, not move_id).
function buildMoves(): { moves: Move[]; slugByName: Map<string, string> } {
  const fast = loadPogoapi<MoveRecord[]>("fast_moves");
  const charged = loadPogoapi<MoveRecord[]>("charged_moves");
  const pvpFast = new Map(loadPogoapi<PvpMoveRecord[]>("pvp_fast_moves").map((m) => [m.move_id, m]));
  const pvpCharged = new Map(loadPogoapi<PvpMoveRecord[]>("pvp_charged_moves").map((m) => [m.move_id, m]));

  const moves: Move[] = [];
  const slugByName = new Map<string, string>();
  for (const m of fast) {
    const slug = slugify(`${m.name}-fast`);
    const pvp = pvpFast.get(m.move_id);
    slugByName.set(m.name, slug);
    moves.push({
      slug, name: m.name, category: "fast", typeSlug: slugify(m.type),
      power: m.power, energyDelta: m.energy_delta, durationMs: m.duration,
      pvpPower: pvp?.power ?? null, pvpEnergyDelta: pvp?.energy_delta ?? null, pvpTurns: pvp?.turn_duration ?? null,
    });
  }
  for (const m of charged) {
    const slug = slugify(`${m.name}-charged`);
    const pvp = pvpCharged.get(m.move_id);
    slugByName.set(m.name, slug);
    moves.push({
      slug, name: m.name, category: "charged", typeSlug: slugify(m.type),
      power: m.power, energyDelta: m.energy_delta, durationMs: m.duration,
      pvpPower: pvp?.power ?? null, pvpEnergyDelta: pvp?.energy_delta ?? null, pvpTurns: pvp?.turn_duration ?? null,
    });
  }
  return { moves, slugByName };
}

interface SpeciesMovesRecord {
  pokemon_id: number;
  form: string;
  fast_moves: string[];
  charged_moves: string[];
  elite_fast_moves: string[];
  elite_charged_moves: string[];
}

// Only pogoapi.net's "Normal" form record per species — its `form` token
// vocabulary doesn't match our costume/region form slugs, so there's no
// reliable way to apply this to costume-specific forms. Base/Standard-form
// move pools (the common case) are still worth having.
function buildFormMoves(forms: Form[], species: Species[], moveSlugByName: Map<string, string>): FormMove[] {
  const standardFormSlugsByDex = new Map<number, string[]>();
  const dexBySpeciesSlug = new Map(species.map((s) => [s.slug, s.dexNumber]));
  for (const f of forms) {
    if (f.formName !== "Standard" || f.costumeName) continue;
    const dex = dexBySpeciesSlug.get(f.speciesSlug);
    if (dex === undefined) continue;
    const list = standardFormSlugsByDex.get(dex) ?? [];
    list.push(f.slug);
    standardFormSlugsByDex.set(dex, list);
  }

  const records = loadPogoapi<SpeciesMovesRecord[]>("current_pokemon_moves");
  const formMoves: FormMove[] = [];
  for (const rec of records) {
    if (rec.form !== "Normal") continue;
    const formSlugs = standardFormSlugsByDex.get(rec.pokemon_id);
    if (!formSlugs) continue;
    for (const fSlug of formSlugs) {
      for (const name of rec.fast_moves) {
        const moveSlug = moveSlugByName.get(name);
        if (moveSlug) formMoves.push({ formSlug: fSlug, moveSlug, isElite: false });
      }
      for (const name of rec.charged_moves) {
        const moveSlug = moveSlugByName.get(name);
        if (moveSlug) formMoves.push({ formSlug: fSlug, moveSlug, isElite: false });
      }
      for (const name of rec.elite_fast_moves) {
        const moveSlug = moveSlugByName.get(name);
        if (moveSlug) formMoves.push({ formSlug: fSlug, moveSlug, isElite: true });
      }
      for (const name of rec.elite_charged_moves) {
        const moveSlug = moveSlugByName.get(name);
        if (moveSlug) formMoves.push({ formSlug: fSlug, moveSlug, isElite: true });
      }
    }
  }
  return formMoves;
}

// Same regionForms-evolutions fix as the family-grouping pass above (see
// parentDexOf) — an evolution edge declared only on a regional form still
// counts. Matches by `id`, not `formId`, for the same reason documented on
// familySlugFor.
function buildSpeciesEvolutions(pokedex: PokedexEntry[], species: Species[]): SpeciesEvolution[] {
  const slugByDex = new Map(species.map((s) => [s.dexNumber, s.slug]));
  const evolutions: SpeciesEvolution[] = [];
  for (const entry of pokedex) {
    const fromSlug = slugByDex.get(entry.dexNr);
    if (!fromSlug) continue;
    const sources = [entry, ...Object.values(entry.regionForms ?? {})];
    for (const source of sources) {
      for (const evo of source.evolutions ?? []) {
        const target = pokedex.find((e) => e.id === evo.id);
        const toSlug = target ? slugByDex.get(target.dexNr) : undefined;
        if (!toSlug) continue;
        evolutions.push({ fromSpeciesSlug: fromSlug, toSpeciesSlug: toSlug, candyRequired: evo.candies ?? null, itemRequired: evo.item?.id ?? null });
      }
    }
  }
  return evolutions;
}

function buildTypeEffectivenessAndWeather(): { typeEffectiveness: TypeEffectiveness[]; weatherBoosts: WeatherBoost[] } {
  const typeEff = loadPogoapi<Record<string, Record<string, number>>>("type_effectiveness");
  const typeEffectiveness: TypeEffectiveness[] = [];
  for (const [attacking, row] of Object.entries(typeEff)) {
    for (const [defending, multiplier] of Object.entries(row)) {
      typeEffectiveness.push({ attackingTypeSlug: slugify(attacking), defendingTypeSlug: slugify(defending), multiplier });
    }
  }
  const weather = loadPogoapi<Record<string, string[]>>("weather_boosts");
  const weatherBoosts: WeatherBoost[] = [];
  for (const [weatherName, types] of Object.entries(weather)) {
    for (const t of types) weatherBoosts.push({ weather: weatherName, typeSlug: slugify(t) });
  }
  return { typeEffectiveness, weatherBoosts };
}

function buildPlayerProgression(): { playerLevels: PlayerLevel[]; playerLevelRewards: PlayerLevelReward[]; medals: Medal[]; medalTiers: MedalTier[]; friendshipLevels: FriendshipLevel[] } {
  const xpReq = loadPogoapi<Record<string, number>>("player_xp_requirements");
  const playerLevels = Object.entries(xpReq).map(([level, xp]) => ({ level: Number(level), cumulativeXp: xp }));

  interface LevelReward { level: number; items_received: { item: string; amount_received: number }[] }
  const rewards = loadPogoapi<LevelReward[]>("levelup_rewards");
  const playerLevelRewards: PlayerLevelReward[] = [];
  for (const r of rewards) {
    r.items_received.forEach((item, i) => {
      playerLevelRewards.push({ level: r.level, sortOrder: i, itemName: item.item, amount: item.amount_received });
    });
  }

  interface Badge { name: string; description: string; event_badge: boolean; rank?: number; targets?: number[] }
  const badges = loadPogoapi<Badge[]>("badges");
  const medals: Medal[] = [];
  const medalTiers: MedalTier[] = [];
  const seenMedalSlugs = new Set<string>();
  for (const badge of badges) {
    const slug = slugify(badge.name);
    if (!seenMedalSlugs.has(slug)) {
      seenMedalSlugs.add(slug);
      medals.push({ slug, name: badge.name, description: badge.description, isEventMedal: badge.event_badge });
    }
    if (badge.targets) {
      badge.targets.forEach((target, i) => medalTiers.push({ medalSlug: slug, rank: i + 1, target }));
    } else if (badge.rank !== undefined) {
      medalTiers.push({ medalSlug: slug, rank: badge.rank, target: null });
    }
  }

  interface FriendshipLevelRecord {
    friendship_level: number; name: string; friendship_points_required: number;
    xp_reward: number; attack_bonus: number; trading_discount: number; raid_ball_bonus: number;
  }
  const friendship = loadPogoapi<FriendshipLevelRecord[]>("friendship_level_settings");
  const friendshipLevels: FriendshipLevel[] = friendship.map((f) => ({
    level: f.friendship_level, name: f.name, pointsRequired: f.friendship_points_required,
    xpReward: f.xp_reward, attackBonus: f.attack_bonus, tradingDiscount: f.trading_discount, raidBallBonus: f.raid_ball_bonus,
  }));

  return { playerLevels, playerLevelRewards, medals, medalTiers, friendshipLevels };
}

function buildPvp(): { pvpRankRewards: PvpRankReward[]; pvpRankRequirements: PvpRankRequirement[] } {
  interface RewardItem { type: string; amount?: number; item_name?: string }
  const leagueRewards = loadPogoapi<Record<string, { free: (RewardItem | null)[]; premium: (RewardItem | null)[] }>>("gobattle_league_rewards");
  const pvpRankRewards: PvpRankReward[] = [];
  for (const [rank, tracks] of Object.entries(leagueRewards)) {
    for (const track of ["free", "premium"] as const) {
      // A handful of slots (e.g. rank 5) are genuinely null in the source
      // data — no reward defined for that slot, not a parsing error.
      tracks[track].forEach((item, i) => {
        if (!item) return;
        pvpRankRewards.push({ leagueRank: Number(rank), track, sortOrder: i, rewardType: item.type, itemName: item.item_name ?? null, amount: item.amount ?? null });
      });
    }
  }

  interface RankRequirement { rank: number; additional_battles_required?: number; additional_battle_wins_required?: number }
  const rankSettings = loadPogoapi<{ rank_requirements: RankRequirement[] }>("gobattle_ranking_settings");
  const pvpRankRequirements: PvpRankRequirement[] = rankSettings.rank_requirements.map((r) => ({
    rank: r.rank, additionalBattlesRequired: r.additional_battles_required ?? null, additionalBattleWinsRequired: r.additional_battle_wins_required ?? null,
  }));

  return { pvpRankRewards, pvpRankRequirements };
}

interface RaidBossEntry {
  id: number; form: string | null; costume: string | null;
  min_unboosted_cp: number; max_unboosted_cp: number; min_boosted_cp: number; max_boosted_cp: number;
  possible_shiny: boolean; boosted_weather: string[]; tier: string | number;
}

function buildRaidsAndEvents(
  species: Species[],
  forms: Form[],
  moveSlugByName: Map<string, string>,
): { raidBosses: RaidBoss[]; raidBossWeatherBoosts: RaidBossWeatherBoost[]; communityDays: CommunityDay[]; communityDayBonuses: CommunityDayBonus[]; communityDaySpecies: CommunityDaySpecies[]; communityDayEventMoves: CommunityDayEventMove[] } {
  const formSlugByDex = new Map<number, string>(); // Standard form only, best-effort match
  const dexBySpeciesSlug = new Map(species.map((s) => [s.slug, s.dexNumber]));
  for (const f of forms) {
    if (f.formName !== "Standard" || f.costumeName) continue;
    const dex = dexBySpeciesSlug.get(f.speciesSlug);
    if (dex !== undefined && !formSlugByDex.has(dex)) formSlugByDex.set(dex, f.slug);
  }

  // Top-level shape is { current: { [tier]: RaidBossEntry[] }, previous: {...} }
  // — only "current" is a live rotation snapshot worth tracking here.
  const raidBossData = loadPogoapi<{ current: Record<string, RaidBossEntry[]> }>("raid_bosses");
  const raidBosses: RaidBoss[] = [];
  const raidBossWeatherBoosts: RaidBossWeatherBoost[] = [];
  for (const [tier, bosses] of Object.entries(raidBossData.current)) {
    if (!Array.isArray(bosses)) continue;
    for (const boss of bosses) {
      const fSlug = formSlugByDex.get(boss.id);
      if (!fSlug) continue; // species not in our candidate set (e.g. Basculegion-style gap)
      raidBosses.push({
        tier: String(tier), formSlug: fSlug,
        minCp: boss.min_unboosted_cp, maxCp: boss.max_unboosted_cp,
        minBoostedCp: boss.min_boosted_cp, maxBoostedCp: boss.max_boosted_cp,
        possibleShiny: boss.possible_shiny,
      });
      for (const weather of boss.boosted_weather ?? []) {
        raidBossWeatherBoosts.push({ tier: String(tier), formSlug: fSlug, weather });
      }
    }
  }

  const speciesSlugByName = new Map(species.map((s) => [s.name, s.slug]));
  function resolveSpeciesName(rawName: string): string | undefined {
    // pogoapi.net encodes some regional-form boosts as "Alola:::Geodude" —
    // the part after ::: is the species name; regional forms are still
    // rows of the same species in our schema, so matching the base name is
    // correct, not a workaround.
    const name = rawName.includes(":::") ? rawName.split(":::")[1] : rawName;
    return speciesSlugByName.get(name);
  }

  interface CommunityDayRecord {
    community_day_number: number; start_date: string; end_date: string;
    bonuses: string[]; boosted_pokemon: string[];
    event_moves: { move: string; move_type: string; pokemon: string }[];
  }
  const communityDayRecords = loadPogoapi<CommunityDayRecord[]>("community_days");
  const communityDays: CommunityDay[] = communityDayRecords.map((cd) => ({ number: cd.community_day_number, startDate: cd.start_date, endDate: cd.end_date }));
  const communityDayBonuses: CommunityDayBonus[] = [];
  const communityDaySpecies: CommunityDaySpecies[] = [];
  const communityDayEventMoves: CommunityDayEventMove[] = [];
  for (const cd of communityDayRecords) {
    for (const bonus of cd.bonuses) communityDayBonuses.push({ communityDayNumber: cd.community_day_number, bonus });
    for (const rawName of cd.boosted_pokemon) {
      const slug = resolveSpeciesName(rawName);
      if (slug) communityDaySpecies.push({ communityDayNumber: cd.community_day_number, speciesSlug: slug });
    }
    for (const em of cd.event_moves) {
      const speciesSlug = resolveSpeciesName(em.pokemon);
      const moveSlug = moveSlugByName.get(em.move);
      if (speciesSlug && moveSlug) communityDayEventMoves.push({ communityDayNumber: cd.community_day_number, speciesSlug, moveSlug });
    }
  }

  return { raidBosses, raidBossWeatherBoosts, communityDays, communityDayBonuses, communityDaySpecies, communityDayEventMoves };
}

const OUT_PATH = resolve(process.cwd(), "src/data/reference.json");

const GEN_TO_REGION: Record<number, string> = {
  1: "kanto", 2: "johto", 3: "hoenn", 4: "sinnoh", 5: "unova",
  6: "kalos", 7: "alola", 8: "galar", 9: "paldea",
};

// Evolution edges pokemon-go-api's evolutions[] data simply doesn't carry
// at all (confirmed by direct inspection of the cached pokedex.json — no
// base-entry or regionForm-entry evolutions[] array names the link), so
// family grouping can't reproduce these even after the regionForms-walk fix
// below. Hitmontop is different: it's not a source-data gap, but a
// pre-existing inconsistency in *production's own* data (Tyrogue's ascending-
// dex-order pipeline linked Hitmontop, dex 237, since Tyrogue was already
// processed by then, but never linked Hitmonlee/Hitmonchan, dex 106/107,
// since they're lower-dex and Tyrogue hadn't been processed yet) — logged
// here rather than silently replicated, since the "keep current" convention
// the owner chose was about mainline-first grouping in general, not this
// specific accident of processing order.
const FAMILY_ROOT_GAP_NOTES: Map<number, string> = new Map([
  [292, "Shedinja: pokemon-go-api doesn't model a Nincada -> Shedinja evolution edge (Shedinja isn't obtained by evolving in Pokémon GO), so it roots its own family instead of Nincada's."],
  [899, "Wyrdeer: pokemon-go-api's Stantler entry has no evolutions[] data at all (Hisuian-item evolutions aren't modeled), so it roots its own family instead of Stantler's."],
  [900, "Kleavor: pokemon-go-api's Scyther entry has no evolution edge into Kleavor (Hisuian-item evolutions aren't modeled), so it roots its own family instead of Scyther's."],
  [1018, "Archaludon: pokemon-go-api's Duraludon entry has no evolutions[] data at all, so it roots its own family instead of Duraludon's."],
  [237, "Hitmontop: production's own old pipeline linked this to Tyrogue's family by processing-order accident (Tyrogue's lower dex meant Hitmonlee/Hitmonchan never got the same link) — not replicated here since it isn't a real design convention worth preserving."],
]);

// Nidoran♀/♂ (dex 29/32) are pokemon-go-api's only species named with a raw
// gender symbol instead of text. They are NOT a gender split of one species
// (that's a real, separate case — e.g. Meowstic, Indeedee — modeled via
// Species.hasMale/hasFemale on a single species): Nidoran♀ and Nidoran♂ have
// distinct dex numbers and completely separate evolution lines (Nidorina/
// Nidoqueen vs. Nidorino/Nidorking), same as the current schema/
// reference.json already treats them (two Species rows, "Nidoran (F)"/
// "Nidoran (M)"). This is purely a *display*-name cleanup now — slugs are no
// longer derived from names.English at all (see slugFor() below), so this
// no longer needs to dodge a slug collision, just match the existing UI
// convention for the "name" field.
const GENDER_SYMBOL_SUFFIX: Record<string, string> = { "♀": "(F)", "♂": "(M)" };

function cleanSpeciesDisplayName(name: string): string {
  for (const [symbol, suffix] of Object.entries(GENDER_SYMBOL_SUFFIX)) {
    if (name.includes(symbol)) return `${name.replace(symbol, "").trim()} ${suffix}`;
  }
  return name;
}

// Slugs are built from pokemon-go-api's `id`/`formId` enum tokens, never
// from names.English. Those enum tokens come straight off the game's own
// data (game_master), so they can't carry the kind of human-typo the old
// PokeAPI/CSV pipeline's name-derived slugs did — confirmed against the
// real reference.json, which has "revaroom"/"farigaraf" (misspelled) where
// pokemon-go-api's id is correctly "REVAVROOM"/"FARIGIRAF". A real cutover
// would still need a slug-rename mapping (src/db/slug-renames.ts) for every
// slug that changes under this scheme, not just the misspelled ones.
function slugFor(id: string): string {
  return slugify(id);
}

// Region-form formIds are `${speciesId}_${TOKEN}` (e.g. RATTATA_ALOLA under
// species id RATTATA) — the TOKEN half is itself a stable enum value, so it
// makes a typo-proof form-slug token the same way species slugs use `id`.
function formTokenFromFormId(formId: string, speciesId: string): string {
  const prefix = `${speciesId}_`;
  return formId.startsWith(prefix) ? formId.slice(prefix.length) : formId;
}

interface AssetPair {
  image?: string;
  shinyImage?: string;
}
interface AssetForm extends AssetPair {
  form: string | null;
  costume: string | null;
  isFemale: boolean;
}
interface Evolution {
  id: string;
  formId?: string;
  candies?: number;
  item?: { id: string } | null;
}
interface PokedexEntry {
  id: string;
  formId: string;
  dexNr: number;
  generation?: number;
  names: { English: string };
  pokemonClass?: string | null;
  primaryType?: { type: string };
  secondaryType?: { type: string } | null;
  assets?: AssetPair;
  assetForms?: AssetForm[];
  regionForms?: Record<string, PokedexEntry>;
  megaEvolutions?: Record<string, unknown>;
  hasGigantamaxEvolution?: boolean;
  evolutions?: Evolution[];
}

interface GenderRecord {
  pokemon_id: number;
  form: string;
  gender?: { male_percent?: number; female_percent?: number };
}

function loadJson<T>(relPath: string): T {
  return JSON.parse(readFileSync(resolve(CACHE_V2_ROOT, relPath), "utf-8")) as T;
}

function deriveRarity(pokemonClass: string | null | undefined): Rarity {
  if (pokemonClass === "POKEMON_CLASS_MYTHIC") return "mythical";
  if (pokemonClass === "POKEMON_CLASS_LEGENDARY") return "legendary";
  if (pokemonClass === "POKEMON_CLASS_ULTRA_BEAST") return "ultra_beast";
  return "standard";
}

function gendersFor(hasMale: boolean, hasFemale: boolean): Gender[] {
  if (hasMale && hasFemale) return ["male", "female"];
  if (hasMale) return ["male"];
  if (hasFemale) return ["female"];
  return ["unknown"];
}

function megaVariantKindFromId(megaFormId: string): "X" | "Y" | "Primal" | null {
  if (megaFormId.endsWith("_MEGA_X")) return "X";
  if (megaFormId.endsWith("_MEGA_Y")) return "Y";
  if (megaFormId.endsWith("_PRIMAL")) return "Primal";
  return null;
}

async function main() {
  console.log("Loading cached data...");
  const pokedex = loadJson<PokedexEntry[]>("pgapi/pokedex.json");
  const genderRecordsByBucket = loadJson<Record<string, GenderRecord[]>>("pogoapi/pokemon_genders.json");
  const shinySpeciesData = loadJson<Record<string, { id: number }>>("pogoapi/shiny_pokemon.json");
  const shadowSpeciesData = loadJson<Record<string, { id: number }>>("pogoapi/shadow_pokemon.json");

  // pokemon_id -> {hasMale, hasFemale}, derived from the "Normal" form record
  // per species (falls back to any record for that species if no "Normal").
  const genderById = new Map<number, { hasMale: boolean; hasFemale: boolean }>();
  for (const [bucket, records] of Object.entries(genderRecordsByBucket)) {
    for (const rec of records) {
      const existing = genderById.get(rec.pokemon_id);
      if (existing && rec.form !== "Normal") continue; // prefer the Normal-form record
      if (bucket === "Genderless") {
        genderById.set(rec.pokemon_id, { hasMale: false, hasFemale: false });
        continue;
      }
      const femalePercent = rec.gender?.female_percent ?? (rec.gender?.male_percent !== undefined ? 1 - rec.gender.male_percent : undefined);
      if (femalePercent === undefined) continue;
      genderById.set(rec.pokemon_id, { hasMale: femalePercent < 1, hasFemale: femalePercent > 0 });
    }
  }

  const shinySpeciesIds = new Set(Object.values(shinySpeciesData).map((v) => v.id));
  const shadowSpeciesIds = new Set(Object.values(shadowSpeciesData).map((v) => v.id));

  const species: Species[] = [];
  const forms: Form[] = [];
  const formTypes: FormType[] = [];
  const megaVariants: MegaVariant[] = [];

  // Pass 1: family grouping via evolutions[] (target dexNr -> source dexNr).
  // Match by `id` alone, not `formId` — evolutions[].formId uses a
  // different convention than the actual top-level entry's own formId
  // (e.g. Gloom's evolution into Vileplume references formId
  // "VILEPLUME_NORMAL", but Vileplume's real top-level entry has
  // formId==="VILEPLUME" — an id/formId mismatch was silently failing this
  // lookup for many species). `id` is reliably unique across all 1024
  // top-level entries (confirmed, including both Nidoran entries), so it's
  // the safe join key here.
  // Some evolution edges are only declared on a *regional form's* own
  // evolutions[] array, not the base species' (e.g. base DEERLING's
  // evolutions is empty — only DEERLING_AUTUMN/_SPRING/_SUMMER/_WINTER carry
  // the edge into SAWSBUCK; base ZIGZAGOON only evolves into LINOONE, but
  // ZIGZAGOON_GALARIAN's regionForm evolves into OBSTAGOON). Missing these
  // silently orphaned every Gen 8/9 "regional form evolves into a new
  // standalone species" chain (Obstagoon, Perrserker, Cursola, Sirfetch'd,
  // Mr. Rime, Runerigus, Wyrdeer, Kleavor, Sneasler, Overqwil, Clodsire,
  // Farigiraf, Archaludon) plus Sawsbuck — confirmed by direct inspection of
  // the cached pokedex.json, not assumed.
  // Baby Pokémon (breeding/incense-only precursors added after their
  // mainline-evolution family already existed) are deliberately NOT linked
  // as a family parent here, matching production's existing convention
  // (confirmed against src/data/reference.json: pichu.familySlug === "pichu",
  // not "pikachu" — the old pipeline's dex-ascending single pass never
  // linked these either, since a baby's dex number is higher than its
  // already-evolved form's). pokemon-go-api's evolutions[] data is complete
  // enough to link them (Pichu -> Pikachu), so without this exclusion the
  // family root would shift to the baby for ~25 species, changing existing
  // grouping behavior the owner explicitly chose to keep as-is.
  const BABY_PRECURSOR_DEX = new Set([
    172, // Pichu -> Pikachu
    173, // Cleffa -> Clefairy
    174, // Igglybuff -> Jigglypuff
    236, // Tyrogue -> Hitmonlee/Hitmonchan
    238, // Smoochum -> Jynx
    239, // Elekid -> Electabuzz
    240, // Magby -> Magmar
    298, // Azurill -> Marill
    360, // Wynaut -> Wobbuffet
    406, // Budew -> Roselia
    433, // Chingling -> Chimecho
    438, // Bonsly -> Sudowoodo
    439, // Mime Jr. -> Mr. Mime
    440, // Happiny -> Chansey
    446, // Munchlax -> Snorlax
    458, // Mantyke -> Mantine
  ]);

  const parentDexOf = new Map<number, number>();
  for (const entry of pokedex) {
    if (BABY_PRECURSOR_DEX.has(entry.dexNr)) continue;
    const evolutionSources = [entry, ...Object.values(entry.regionForms ?? {})];
    for (const source of evolutionSources) {
      for (const evo of source.evolutions ?? []) {
        const target = pokedex.find((e) => e.id === evo.id);
        if (target) parentDexOf.set(target.dexNr, entry.dexNr);
      }
    }
  }
  // The top-level pokedex array is already one entry per species/dex number
  // (confirmed: 1024 entries, 1024 unique dexNr) — regional forms only ever
  // appear nested under regionForms, never duplicated at this level. The
  // only two entries whose formId differs from id are Nidoran♀/♂
  // (id: NIDORAN_FEMALE/NIDORAN_MALE, formId: NIDORAN for both) — they are
  // genuinely distinct species (separate dex numbers 29/32, separate
  // evolution lines), not a gender-variant pair of one species, so no
  // formId===id filter belongs here at all; iterating every top-level entry
  // unconditionally is correct.
  const slugByDex = new Map<number, string>();
  for (const entry of pokedex) {
    slugByDex.set(entry.dexNr, slugFor(entry.id));
  }
  function familySlugFor(dexNr: number): string {
    let current = dexNr;
    const seen = new Set<number>();
    while (parentDexOf.has(current) && !seen.has(current)) {
      seen.add(current);
      current = parentDexOf.get(current)!;
    }
    return slugByDex.get(current) ?? slugByDex.get(dexNr) ?? String(dexNr);
  }

  let skippedGigantamaxOnly = 0;

  for (const entry of pokedex) {
    // No formId===id filter here — see the slugByDex comment above. Every
    // top-level entry is its own species; regionForms are handled below,
    // per-species, from entry.regionForms.
    const displayName = cleanSpeciesDisplayName(entry.names.English);
    const slug = slugFor(entry.id);
    const gender = genderById.get(entry.dexNr) ?? { hasMale: true, hasFemale: true };
    const rarity = deriveRarity(entry.pokemonClass);
    const canMegaEvolve = Object.keys(entry.megaEvolutions ?? {}).length > 0;
    const canGigantamax = entry.hasGigantamaxEvolution ?? false;

    species.push({
      slug,
      dexNumber: entry.dexNr,
      name: displayName,
      familySlug: familySlugFor(entry.dexNr),
      gen: entry.generation ?? 0,
      rarity,
      regionSlug: GEN_TO_REGION[entry.generation ?? 0] ?? "unidentified",
      hasMale: gender.hasMale,
      hasFemale: gender.hasFemale,
      canMegaEvolve,
      canGigantamax,
    });

    const shinyAvailable = shinySpeciesIds.has(entry.dexNr);
    const shadowAvailable = shadowSpeciesIds.has(entry.dexNr);

    // Standard form(s), one per gender.
    for (const g of gendersFor(gender.hasMale, gender.hasFemale)) {
      const fSlug = formSlug(slug, null, g);
      forms.push({
        slug: fSlug,
        speciesSlug: slug,
        formName: "Standard",
        costumeName: null,
        gender: g,
        evolves: true,
        shinyAvailable,
        shadowAvailable,
        // Not derivable from either source today — see file header comment.
        dynamaxAvailable: false,
        regionalExclusive: false,
        imageRef: null,
      });
    }

    // Costume forms, from assetForms[] — gender comes directly from
    // isFemale (genderless species always report isFemale:false; mapped to
    // "unknown" rather than mislabeled "male").
    for (const af of entry.assetForms ?? []) {
      if (!af.costume) continue;
      const g: Gender = !gender.hasMale && !gender.hasFemale ? "unknown" : af.isFemale ? "female" : "male";
      const costumeName = af.costume;
      const fSlug = formSlug(slug, af.form, g, costumeName);
      forms.push({
        slug: fSlug,
        speciesSlug: slug,
        formName: af.form ?? "Standard",
        costumeName,
        gender: g,
        evolves: false,
        shinyAvailable: Boolean(af.shinyImage),
        shadowAvailable: false,
        dynamaxAvailable: false,
        regionalExclusive: false,
        imageRef: null,
      });
    }

    // Region forms (e.g. Alolan Meowth) — own Form rows under the parent
    // species, not separate Species rows, matching the current schema.
    for (const region of Object.values(entry.regionForms ?? {})) {
      const regionToken = formTokenFromFormId(region.formId, entry.id);
      // A few region-form entries (e.g. Paldean Wooper) give names.English
      // identical to the base species' own name — no distinguishing text to
      // strip out — so falling back to the raw enum token id would be
      // uglier than necessary; title-case the token instead (PALDEA ->
      // Paldea) as a readable, if not perfectly grammatical, fallback.
      const regionDisplayLabel =
        region.names.English.replace(entry.names.English, "").trim() ||
        regionToken.charAt(0).toUpperCase() + regionToken.slice(1).toLowerCase();
      for (const g of gendersFor(gender.hasMale, gender.hasFemale)) {
        const fSlug = formSlug(slug, regionToken, g);
        forms.push({
          slug: fSlug,
          speciesSlug: slug,
          formName: regionDisplayLabel,
          costumeName: null,
          gender: g,
          evolves: true,
          shinyAvailable,
          shadowAvailable,
          dynamaxAvailable: false,
          regionalExclusive: true,
          imageRef: null,
        });
      }
    }

    // Gigantamax — synthesized per gender, mirroring the Standard form's
    // shiny availability, same heuristic as the current pipeline's
    // Obsidian-sheet-driven step, just gated on pokemon-go-api's corrected
    // hasGigantamaxEvolution instead.
    if (canGigantamax) {
      for (const g of gendersFor(gender.hasMale, gender.hasFemale)) {
        const fSlug = formSlug(slug, "Gigantamax", g);
        forms.push({
          slug: fSlug,
          speciesSlug: slug,
          formName: "Gigantamax",
          costumeName: null,
          gender: g,
          evolves: false,
          shinyAvailable,
          shadowAvailable: false,
          dynamaxAvailable: true,
          regionalExclusive: false,
          imageRef: null,
        });
      }
      skippedGigantamaxOnly++;
    }

    for (const [megaFormId] of Object.entries(entry.megaEvolutions ?? {})) {
      const variant = megaVariantKindFromId(megaFormId);
      megaVariants.push({ slug: megaVariantSlug(slug, variant), speciesSlug: slug, variant });
    }
  }

  // A handful of species (e.g. Darmanitan) model their base Kantonian
  // form as its own named regionForms entry ("DARMANITAN_STANDARD") on top
  // of the species' own top-level entry — formTokenFromFormId strips the
  // species-id prefix and gets "standard" back, colliding with the
  // always-created base Standard form above. Keep the first occurrence
  // (the base loop's own Standard form) and drop the duplicate rather than
  // let a slug collision reach the database as a silent overwrite/crash.
  const seenFormSlugs = new Set<string>();
  const dedupedForms: Form[] = [];
  let duplicateFormsDropped = 0;
  for (const f of forms) {
    if (seenFormSlugs.has(f.slug)) {
      duplicateFormsDropped++;
      continue;
    }
    seenFormSlugs.add(f.slug);
    dedupedForms.push(f);
  }
  forms.length = 0;
  forms.push(...dedupedForms);

  // Types: form-type assignment needs per-form type data, which the pokedex
  // entries don't carry directly per costume/region form beyond the base —
  // approximated here as "every form of a species shares the species' base
  // types" (pokemon-go-api doesn't expose per-costume type overrides, and
  // in practice costumes/regions rarely differ — region forms are the
  // known exception, e.g. Alolan Meowth is Dark not Normal, handled since
  // regionForms are separate pokedex entries with their own primaryType —
  // wired in below instead of the placeholder above).
  const typesByFormSlug = new Map<string, string[]>();
  function recordTypes(entry: PokedexEntry, baseSlug: string) {
    const primary = entry.primaryType?.type?.replace("POKEMON_TYPE_", "").toLowerCase();
    const secondary = entry.secondaryType?.type?.replace("POKEMON_TYPE_", "").toLowerCase();
    const types = [primary, secondary].filter((t): t is string => Boolean(t));
    typesByFormSlug.set(baseSlug, types);
  }
  for (const entry of pokedex) {
    const slug = slugFor(entry.id);
    recordTypes(entry, slug);
    for (const region of Object.values(entry.regionForms ?? {})) {
      recordTypes(region, slug); // types keyed by species slug, applied per-form below
    }
  }
  for (const f of forms) {
    const types = typesByFormSlug.get(f.speciesSlug) ?? [];
    for (const t of types) formTypes.push({ formSlug: f.slug, typeSlug: t });
  }

  console.log("Loading Tier-1 data (moves, evolutions, player progression, PvP, raids, community days)...");
  const { moves, slugByName: moveSlugByName } = buildMoves();
  const formMoves = buildFormMoves(forms, species, moveSlugByName);
  const speciesEvolutions = buildSpeciesEvolutions(pokedex, species);
  const { typeEffectiveness, weatherBoosts } = buildTypeEffectivenessAndWeather();
  const { playerLevels, playerLevelRewards, medals, medalTiers, friendshipLevels } = buildPlayerProgression();
  const { pvpRankRewards, pvpRankRequirements } = buildPvp();
  const { raidBosses, raidBossWeatherBoosts, communityDays, communityDayBonuses, communityDaySpecies, communityDayEventMoves } = buildRaidsAndEvents(species, forms, moveSlugByName);

  // Types referenced anywhere (form typing, moves, type effectiveness,
  // weather boosts) — not just formTypes — or a Tier-1 FK would dangle.
  const allTypeSlugs = new Set([
    ...formTypes.map((ft) => ft.typeSlug),
    ...moves.map((m) => m.typeSlug),
    ...typeEffectiveness.flatMap((te) => [te.attackingTypeSlug, te.defendingTypeSlug]),
    ...weatherBoosts.map((wb) => wb.typeSlug),
  ]);

  const referenceData: ReferenceData = {
    regions: [...new Set(Object.values(GEN_TO_REGION))].map((slug) => ({ slug, name: capitalize(slug) })),
    types: [...allTypeSlugs].map((slug) => ({ slug, name: capitalize(slug) })),
    backgrounds: [
      { slug: "spring-2024", name: "Spring 2024" },
      { slug: "anniversary-2016", name: "8th Anniversary" },
    ],
    species,
    forms,
    formTypes,
    megaVariants,
    moves,
    formMoves,
    speciesEvolutions,
    typeEffectiveness,
    weatherBoosts,
    playerLevels,
    playerLevelRewards,
    medals,
    medalTiers,
    friendshipLevels,
    pvpRankRewards,
    pvpRankRequirements,
    raidBosses,
    raidBossWeatherBoosts,
    communityDays,
    communityDayBonuses,
    communityDaySpecies,
    communityDayEventMoves,
  };

  writeFileSync(OUT_PATH, JSON.stringify(referenceData));

  const staticGaps = detectStatelessGaps(species, forms, formTypes);
  const comparativeGaps = buildComparativeGaps(referenceData, FAMILY_ROOT_GAP_NOTES);
  writeFileSync(GAPS_OUT, JSON.stringify([...staticGaps, ...comparativeGaps], null, 2));

  console.log(`Wrote ${species.length} species, ${forms.length} forms (${skippedGigantamaxOnly} with Gigantamax, ${duplicateFormsDropped} duplicate slug(s) dropped), ${megaVariants.length} mega variants.`);
  console.log(`Tier 1: ${moves.length} moves, ${formMoves.length} form-move links, ${speciesEvolutions.length} evolutions, ${raidBosses.length} raid bosses, ${communityDays.length} community days.`);
  console.log(`Gaps: ${staticGaps.length} stateless + ${comparativeGaps.length} comparative -> ${GAPS_OUT}`);
  console.log(`-> ${OUT_PATH}`);
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
