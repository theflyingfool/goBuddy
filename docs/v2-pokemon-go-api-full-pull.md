# pokemon-go-api — Full Data Pull & Coverage Test

Follow-up to [v2-data-source-findings.md](v2-data-source-findings.md) §10.
Pulled every `pokemon-go-api` endpoint in full (not samples) and diffed the
species/form/mega/gigantamax coverage against our current
`src/data/reference.json`, to ground actual table design rather than
estimate it.

---

## 1. Endpoints Pulled

| Endpoint | Size | Contents |
| :--- | :--- | :--- |
| `api/pokedex.json` | 14.7 MB, 1024 entries | Full species/form roster — the primary dataset |
| `api/pokedex/mega.json` | 1.0 MB, 57 entries | Mega Evolution forms only (subset view of the same data embedded in `pokedex.json`) |
| `api/raidboss.json` | 48 KB | Current raid boss lineup by tier, plus localized graphic assets |
| `api/maxbattles.json` | 25 bytes | `{"currentList": []}` — empty at pull time, no Max Battles currently active |
| `api/quests.json` | 2 bytes | `[]` — empty at pull time |
| `api/types.json` | 17.6 KB, 18 entries | Type effectiveness + weather boost, combined, localized |
| `api/hashes.json` | 651 bytes | sha512 per file — but only covers `maxbattles.json`, `raidboss.json`, `pokedex.json`, `quests.json`. **`types.json` and `pokedex/mega.json` are not hashed** — a gap if we rely on this for staleness detection. |

`maxbattles.json` and `quests.json` being empty isn't a data-quality problem
— both are genuinely empty in the live game right now. Structure is known
(`{"currentList": []}` / `[]`) but real shape can't be confirmed until
pulled again during an active Max Battle/quest rotation.

---

## 2. Full Field Inventory — `pokedex.json`

Collected by walking a spread of ~150 sampled species (not just one), so
rarely-populated fields (megas, region forms) are included. `{}` below marks
a field that's a map keyed by an internal ID (move name, language, etc.) —
listed once since every entry has the same shape.

```text
id                              — internal species id, e.g. "BULBASAUR"
formId                          — form-specific id, e.g. "PIKACHU" or "MEOWTH_ALOLA"
dexNr                           — National Dex number (int)
generation                      — generation number (int)
names{}                         — English/German/French/Italian/Japanese/Korean/Spanish
stats.attack / .defense / .stamina
primaryType.type / .names{}
secondaryType.type / .names{}   — null if single-typed
pokemonClass                    — e.g. legendary/mythical marker, null for standard species
quickMoves{}                    — keyed by move id
  .power / .energy / .durationMs / .names{}
  .type.type / .type.names{}
  .combat.energy / .power / .turns / .buffs{activationChance, attacker/target Attack/Defense StatsChange}
cinematicMoves{}                — same shape as quickMoves{}, charged moves
eliteQuickMoves{}               — same shape, legacy/Elite-TM fast moves
eliteCinematicMoves{}           — same shape, legacy/Elite-TM charged moves
assets.image / .shinyImage      — base-form sprite URLs
assetForms[]                    — costume + form sprite variants
  .form / .costume / .isFemale / .image / .shinyImage
regionForms{}                   — keyed by formId, e.g. "MEOWTH_ALOLA"
  — full nested copy of the same per-form shape (own stats, moves, assets, evolutions, etc.)
evolutions[]
  .id / .formId / .candies / .item{id, names{}} / .quests[]{id, names{}, type}
hasMegaEvolution / hasGigantamaxEvolution   — booleans
megaEvolutions{}                — keyed by mega formId, e.g. "VENUSAUR_MEGA"
  .energyCost / .assets.image / .shinyImage / .stats / .primaryType / .secondaryType / .names{}
```

Compare against our current `reference.json` shape (`species`, `forms`,
`formTypes`, `megaVariants` — flat, normalized tables): `pokemon-go-api`
gives us the same species/form/mega/costume facts, plus full move data
(fast/charged/legacy, with both PvE and PvP `combat` stats) and localized
names in 7 languages, neither of which our current schema has any column
for today.

---

## 3. Coverage Test Results

| Check | Result |
| :--- | :--- |
| Species count | We track 1025, `pokemon-go-api` has 1024 |
| Species we have that they don't | **1**: dex #902, Basculegion. Not in their `pokedex.json` under any id — consistent with their data being GameMaster-sourced (only what's actually released in-game), while ours tracks it as a canonical species regardless of GO release status. |
| Species they have that we don't | **0** |
| Regional/region forms | 376 `regionForms` entries across all species |
| Mega Evolutions | **57 vs. our 57 — exact match.** Full 1:1 overlap, no discrepancy. |
| Gigantamax | **Discrepancy found**: `pokemon-go-api` flags 15 species `hasGigantamaxEvolution: true`; we currently flag 32 species `canGigantamax: true`. |
| Costume/form sprite variants | 1749 `assetForms` entries total, vs. 600 rows in our `forms` table with a `costumeName` set today |

**The Gigantamax discrepancy is a real, useful finding** — it lines up
exactly with the already-flagged open item in
[roadmap.md §6](roadmap.md#6-status-tbd-items-needs-an-owner-decision-v1-or-v2)
("Gigantamax availability/shiny gating: all 32 canonical G-max species are
currently marked available... but GO's real in-game rollout is a subset").
`pokemon-go-api`'s 15 is very likely the actual currently-released subset,
sourced from the live GameMaster file rather than the full canonical set.
This needs confirmation (cross-check the 15 by name against known released
G-max species) but this is exactly the kind of data-pass fix that item was
waiting on.

The costume/form gap (1749 vs. 600) reflects that our current costume
tracking (Bulbapedia-wikitext-sourced) is narrower than what
`pokemon-go-api` already has cataloged — expected, and consistent with the
whole reason for this spike.

---

## 4. Open Items for Table Design

- Confirm the 15 `hasGigantamaxEvolution` species by name against a
  known-good released-Gigantamax list before treating it as authoritative —
  don't just swap 32→15 without a sanity check.
- `regionForms` nests a **full copy** of the per-form shape (its own moves,
  evolutions, assets, even a nested empty `regionForms`) rather than a
  flat delta from the base form — table design needs to flatten this into
  row-per-form the way our current `species`/`forms` split already does,
  not store it as nested JSON.
- Decide whether move data (`quickMoves`/`cinematicMoves`/elite variants,
  with PvE `combat` stats) becomes its own reference table (`moves`,
  `species_moves`) now that we have it — this was previously sourced nowhere
  in our pipeline.
- Localized `names{}` (7 languages) on nearly every object: decide whether
  V2 wants multi-language support at all before modeling a `names` table for
  every entity — if not, this is a large amount of data to discard on
  ingest, worth deciding explicitly rather than defaulting to storing it all.
- `api/hashes.json` doesn't cover `types.json` or `pokedex/mega.json` — if
  staleness detection is built the way `reference_data_version` works today,
  either accept those two as unmonitored or hash them ourselves post-fetch.
