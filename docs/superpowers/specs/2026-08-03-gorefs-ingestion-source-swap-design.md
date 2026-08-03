# GoRefs Ingestion Source Swap — Design

> Sequencing: this plan → screenshot/OCR-based dex-onboarding plan (next) →
> reference.sqlite bundling switch (flagged high-priority, its own plan
> after that). Not three concurrent efforts.

## Goal

Replace GoBuddy's current reference-data ingestion — direct fetches of
GAME_MASTER (`alexelgt/game_masters`), pokemon-go-api's pokedex/types/mega
files, and the pokemongo-shiny sheet, transformed in
`scripts/ingest/transform/*.ts` — with querying the vendored
[GoRefs](https://github.com/theflyingfool/GoRefs) project
(`vendor/reference/GoRefs`, a git subtree) instead. GoRefs consolidates its own 7
upstream sources into a single queryable database and is meant to
eventually be a real, independently-hosted service; this swap is built
against that target shape from day one — local `--serve` today, a published
URL later — not a one-off export format.

`reference.json`'s shape (`src/db/reference-data.ts`'s `ReferenceData`
interface) and everything downstream of it (`reference-sync.ts`,
`reference.sqlite`, the app itself) are unchanged by this plan. Only how
`ReferenceData` gets assembled changes.

## Background: parity finding

GoRefs' own team ran a coverage analysis one day before this plan
(`.superpowers/sdd/2026-07-30-generic-ingestion-engine/reference-json-coverage-report.md`
in the GoRefs repo) comparing `reference.json` against GoRefs' **canonical**
tables (species, forms, moves, etc. — built from GoRefs' 7 independent
sources, not from `reference.json`). Verdict: not a 100% replacement as-is —
real gaps in `formMoves` (11,131 rows, no canonical equivalent at all),
`speciesEvolutions` (479 rows, same), a badge `badge_id` collision merging
382 badges into 184, missing Mewtwo X/Y in `mega_species`, and total gaps in
`pvpRankRewards`/`backgrounds`.

Separately, GoRefs has a `refjson_*` shim (`src/reference_shim.py`, built
2026-08-03) that wholesale-dumps GoBuddy's own `reference.json` into
`refjson_<table>`-prefixed tables, as a stopgap. Verified directly against
the live `output/GoRefs_Master.duckdb`: **every domain the coverage report
called a gap is fully present in the `refjson_*` shim**, with exact matching
row counts (`refjson_form_moves`: 11,131; `refjson_species_evolutions`: 479;
`refjson_medals`: 583, uncollided; `refjson_pvp_rank_rewards`: 240;
`refjson_backgrounds`: 2). So nothing is actually missing from the vendored
database today — it's split between GoRefs' independent canonical tables
(ahead of `reference.json` on `raidBosses`/`communityDays`/`friendshipLevels`)
and a frozen mirror of GoBuddy's own last `reference.json` snapshot for the
domains GoRefs hasn't modeled natively yet. 100% parity holds functionally,
with the honest caveat that the shim-covered domains aren't independent
GoRefs data yet.

**Full-database size check:** exporting every one of `GoRefs_Master.duckdb`'s
51 tables to JSON totals 22.5MB, against `reference.json`'s current 2.4MB —
but ~17.9MB of that is GoRefs-internal bookkeeping (`game_master_templates`
raw passthrough, `_claims_ledger` provenance, `change_history`/
`discrepancies`) and the `refjson_*` mirror (~2.2MB, a duplicate of
`reference.json` itself) that a real export would never carry. The domains
GoBuddy would actually query total roughly 2.1MB — in line with today's
size. This ~9x-if-taken-naively number was still enough of a signal to flag
the `reference.sqlite`-bundling switch as its own high-priority near-term
plan (see sequencing note above) — but it is **not** in scope for this plan.

## Architecture / data flow

`scripts/ingest/ingest.ts`'s `fetch` and `build` steps are replaced by one
new step:

1. **Verify (don't blindly (re)start) a GoRefs server is reachable.** Probe
   the expected port with a real query (not just "is the TCP port open") —
   if a `go_refs.py --serve` instance is already running (e.g. a developer
   has it up for the web explorer), use it as-is and never touch its
   lifecycle. If nothing answers, spawn `uv run go_refs.py --serve --port
   <port>` as a child process from `vendor/reference/GoRefs`, poll until it
   responds, and remember that *this run* owns it.
2. Connect via a Node DuckDB client's `httpfs` extension: `ATTACH
   'http://localhost:<port>/output/GoRefs_Master.duckdb' AS gorefs
   (READ_ONLY)`.
3. Run one SQL query per `ReferenceData` domain against `gorefs.<table>`,
   per the domain mapping below.
4. If this run spawned the server itself in step 1, terminate it. If it
   found one already running, leave it alone.
5. Everything downstream — slug-check, sprites, sqlite, manifest — runs
   unchanged, consuming the same `ReferenceData` value as today.

Refreshing GoRefs' own upstream data (`uv run go_refs.py --build` inside the
vendored subtree) is **not** triggered automatically by `npm run ingest` —
that stays GoRefs' own deliberate, occasional act (analogous to re-pulling
the subtree), documented as a manual pre-step, not orchestrated from
GoBuddy. `npm run ingest` only ever re-derives `reference.json` from
whatever GoRefs' database currently contains.

**Sprites stay carved out, and need a new standalone piece.** GoRefs doesn't
model sprite assets at all (see the `assets` TODO logged in GoRefs' own
`TODO.md` — only 20 placeholder icons exist there today, not usable). GoBuddy
still fetches pokemon-go-api's raw `pokedex.json` directly for sprite URLs —
`fetch-sprites.ts` already does this with its own inline types, independent
of `sources/pokemon-go-api.ts` entirely, so nothing changes there.

What *does* need new code: `write/sprite-manifest.ts` needs a
`slug -> AssetPair` mapping (which sprite URL belongs to which of GoBuddy's
own slugs) to hand to `build-sprites.ts`. Today that mapping is a byproduct
of `buildSpecies()` (removed from the default pipeline, see above) — it's
built by re-deriving each entry's slug via `slugFor()`/`formTokenFromFormId()`
(the same functions GoBuddy's own slugs have always come from — see
[v2-schema-design.md](v2-schema-design.md)) and pairing it with that pokedex
entry's asset URLs. This slice never actually depended on GAME_MASTER or the
shiny sheet, so it should be extracted into its own pure function —
`buildSpriteManifest(pokedex: PokedexSource): Record<string, AssetPair>` —
called from the new default pipeline, independent of the now-dormant
`buildSpecies`.

**This creates two independent slug-generation paths that can silently
drift**: the frozen `refjson_forms.slug` values (baked into GoRefs) and the
live `slugFor()` re-derivation over a freshly-fetched `pokedex.json`. They
agree today only because `refjson_*` was built by this exact pipeline. The
moment pokemon-go-api renames or adds an id, sprites silently go missing (a
form exists in `refjson_forms` but has no sprite-manifest entry — falls back
to species-level art) or orphan `.webp` files accumulate — the existing
slug-stability check won't catch this, since it only diffs `reference.json`
against itself. This plan adds a new check: after assembling `ReferenceData`
and building the sprite manifest, assert every species/form slug in
`ReferenceData` has a sprite-manifest entry (or explicitly document the
species-level-art fallback as acceptable) and log a warning for any
sprite-manifest key that doesn't correspond to a real slug — loud enough to
notice, not necessarily a hard failure on day one.

## Domain mapping

| `ReferenceData` domain | GoRefs source | Why |
|---|---|---|
| `species` | `refjson_species` | canonical `species` was re-checked at implementation-planning time and rejected: its `slug` format (`"1-bulbasaur"`) doesn't match GoBuddy's own (`"bulbasaur"`), and it's missing `familySlug`/`rarity`/`regionSlug`/`hasMale`/`hasFemale` entirely. The coverage report's "full parity" verdict only spot-checked field *values* (dex, gen, base stats), not slug format or full shape. |
| `typeEffectiveness` | `refjson_type_effectiveness` | canonical `type_effectiveness` is independently-verified correct too, but needs a `LOWER()` transform (capitalized type names) for no real benefit over the shim right now — using the shim keeps every domain on one uniform query pattern for this first cut. Revisit as a one-line swap to canonical later, same as every other shim-fallback row below. |
| `weatherBoosts` | `refjson_weather_boosts` | same reasoning as `typeEffectiveness` — canonical needs an unnest + `LOWER()` for no current benefit |
| `raidBosses`, `raidBossWeatherBoosts` | **dropped — ships empty**, same as before this plan | re-checked at implementation-planning time: canonical `raid_bosses.form` uses GAME_MASTER-style identifiers (`"AGGRON_MEGA"`, `"KYUREM"`); verified against GoBuddy's actual `forms.slug` values — **0 of 17 rows match**. Populating `formSlug` from this would create dangling FKs. The "GoRefs is ahead" framing no longer holds; needs a real species/form crosswalk before this can be revisited, out of scope here. |
| `communityDays` (+ 3 sub-tables) | **dropped — ships empty**, same as before this plan | re-checked at implementation-planning time: all 80 rows are empty placeholders (`event_id: "cd-None"` — a single non-unique value across every row, blank `date`, null `featured_pokemon`). Row *count* looked ahead of GoBuddy's empty tables; row *content* is unusable. |
| `forms`, `formTypes` | `refjson_forms` / `refjson_form_types` | canonical `forms` collapses gender (89% `"unknown"`) — real regression vs. today; use the shim until GoRefs fixes it |
| `megaVariants` | `refjson_mega_variants` | canonical `mega_species` is missing Mewtwo X/Y (confirmed real gap) |
| `moves` | `refjson_moves` | canonical `moves` is missing ~9-11 real moves + has naming/duplicate issues |
| `playerLevels`, `playerLevelRewards` | `refjson_player_levels` / `refjson_player_level_rewards` | canonical `progression` lacks `cumulativeXp` entirely; no reward table at all |
| `medals`, `medalTiers` | `refjson_medals` / `refjson_medal_tiers` | canonical `badges` has the confirmed `badge_id` collision (382 → 184) |
| `friendshipLevels` | `refjson_friendship_levels` | canonical has a real newer tier but a modeling bug (NULL/duplicate milestone rows); shim is clean and matches today |
| `formMoves` | `refjson_form_moves` | total gap in canonical schema |
| `speciesEvolutions` | `refjson_species_evolutions` | total gap in canonical schema |
| `pvpRankRewards`, `pvpRankRequirements` | `refjson_pvp_rank_rewards` / `refjson_pvp_rank_requirements` | total/near-total gap in canonical schema |
| `regions`, `types` | unchanged — derived in TS from other domains, as today | trivial static mapping, not real sourced data either way |
| `backgrounds` | **dropped — ships empty** (`refjson_backgrounds`/canonical both unused) | the 2 rows GoBuddy currently hardcodes (`spring-2024`, `anniversary-2016`) aren't real sourced data — stop faking them, same treatment as `raidBosses`/`communityDays`'s prior empty state. The `Background` type, table, and `FormBackgroundPersonal`'s FK relationship all stay intact for whenever a real source exists — this only removes the fake literal from `build()`. |

Every `refjson_*` row above is a documented, revisit-later decision: once
GoRefs' own team promotes a domain into its canonical schema (tracked in
GoRefs' own `TODO.md`/`KNOWN_ISSUES.md`), GoBuddy's query for that domain
switches from the shim table to the canonical one — a one-line change per
domain, no shape change, since `refjson_*` and canonical tables should
converge in row shape once fixed.

Worth naming plainly: right now `refjson_*` is circular — GoBuddy processed
all its own sources to produce `reference.json`, and GoRefs is just
re-serving that same processed output back. The real target (flagged in
GoRefs' `TODO.md`, 2026-08-03: "Port GoBuddy's transform logic into GoRefs'
own canonical processing") is GoRefs independently achieving the same
processing quality on its own 7 sources, not GoBuddy perpetually consuming
its own old output through an extra hop. This plan intentionally accepts
that circularity for now — the win here is the *plumbing* (querying GoRefs
over HTTP instead of direct fetches), not a data-quality upgrade on day one.

## Frozen-data consequence, and why nothing is deleted

Tracing the loop: after this swap, every domain GoBuddy ingests comes from
`refjson_*` — a committed snapshot of a *past* GoBuddy build, frozen inside
GoRefs. The only process that could ever produce a newer `reference.json` is
the GAME_MASTER/pokemon-go-api/shiny-sheet pipeline this plan would otherwise
delete. So this isn't just "no data-quality upgrade on day one" — it's a real
functional regression: **no new species, forms, moves, or medals can enter
the dataset** until GoRefs promotes each domain to an independently-correct
canonical table. `npm run ingest` would go from "picks up a real game update"
to "produces byte-identical output forever," and `ingest:check` becomes
vacuous.

**Decision: accept this trade-off, but don't delete the old pipeline —
leave it dormant and unwired instead.** `sources/game-master.ts`,
`sources/shiny-sheet.ts`, `sources/pogoapi-badges.ts`,
`sources/pokemon-go-api.ts`, and `transform/species.ts`, `transform/moves.ts`,
`transform/evolutions.ts`, `transform/player-progression.ts`, `transform/pvp.ts`
all stay in the repo, completely unchanged, along with their existing tests.
Only `scripts/ingest/ingest.ts`'s default pipeline changes: its `fetchAll`/
`build` steps are renamed (e.g. `fetchAllFromGameMaster`/`buildFromGameMaster`)
and no longer wired into the default `PipelineStep[]` list — replaced by new
`fetchAndAttachGoRefs`/`buildFromGoRefs`-style steps. The old functions stay
exported and callable, as a manual reactivation path per-domain if the freeze
becomes a real problem before GoRefs' promotion catches up. This keeps the
implementation diff far smaller (no test-file surgery, no need to
carefully split `transform/species.ts`'s comparative-gap constants away from
its GAME_MASTER-parsing logic) and keeps the door open without committing to
using it.

## Manifest / freshness checking

Today's `ingest:check` diffs upstream fetch fingerprints (GAME_MASTER commit
SHA, file hashes for the pokemon-go-api files and shiny sheet) against a
committed manifest, to answer "has anything upstream changed" without a
full rebuild. This plan deletes the code that does that fingerprinting
(`sources/game-master.ts` etc., per "Removed entirely" above) — but the
*capability* itself doesn't just disappear: it needs to move to GoRefs,
which is now the thing actually touching those upstream sources. Concretely,
this plan requires (and has flagged in GoRefs' own `TODO.md`, 2026-08-03):

- GoRefs gains its own upstream-change detection — `--fetch`/`--build`
  should skip re-fetching a source whose upstream hasn't changed, instead of
  always fetching fresh (this is also what keeps `raw_dumps/`'s committed
  snapshot growth in check, see the retention-policy TODO already there).
- GoRefs exposes a last-built/updated signal cheaply — without
  downloading/querying the whole database — so a downstream consumer's
  freshness check stays cheap. Confirmed small: every
  `raw_dumps/<source>/<timestamp>/.meta.json` already records
  `{source, etag, timestamp}` per fetch, and `builder.py` already computes a
  build timestamp (`src/builder.py:1380`) — a new small table (e.g. `_meta`:
  one row per source with its last-pulled-at, plus one row for
  last-built-at) is mostly just persisting data that already exists on disk.
  Flagged concretely in GoRefs' `TODO.md`.

On GoBuddy's side, `ingest:check`'s replacement becomes: query that
GoRefs-exposed signal (once it exists) instead of re-deriving fingerprints
for sources GoBuddy no longer touches directly. Until GoRefs ships that,
GoBuddy's own manifest can fall back to a content hash of the assembled
`ReferenceData` (the same mechanism `reference-version.ts` already computes)
as an interim measure — exact wiring left to the implementation plan, but
the GoRefs-side signal is the real target, not a permanent GoBuddy-side
workaround.

## Unverified assumption (verify first in implementation)

This design assumes a Node DuckDB client's `httpfs` extension can `ATTACH`
a remote `.duckdb` file over plain HTTP against `go_refs.py --serve`'s
custom range-request handler, the same way DuckDB-WASM does in a browser.
This has not been empirically tested. First implementation step is a
throwaway spike that must verify three things, not just "a query runs":

1. `ATTACH` over HTTP against `--serve` actually works.
2. **BigInt handling end-to-end.** DuckDB's Node bindings return `BIGINT`
   columns (and nearly every `refjson_*` table has them — `dexNumber`,
   `level`, `rank`, `sortOrder`, `amount`, `target`, ...) as JS `BigInt`, but
   `write/reference-json.ts` calls `JSON.stringify(referenceData)`, which
   throws `TypeError: Do not know how to serialize a BigInt` on any `BigInt`
   value. The spike must round-trip one real domain's query result all the
   way through `JSON.stringify` so the casting strategy (e.g. `Number()` on
   read, with an explicit overflow check) lands in the query layer by design,
   not as a mid-implementation surprise.
3. **Real-world latency**, not just correctness. Time a `SELECT *` across
   several tables, including `refjson_form_moves` (11,131 rows) — that's a
   meaningful slice of a 109MB file read over HTTP range requests. If
   `httpfs` ends up pulling large byte ranges per query, `npm run ingest`
   could go from seconds to minutes even though the spike "passed"
   correctness-wise.

If any of these fail, the fallback isn't Parquet or a different client
library first — it's simpler than that: **`fetchToCache` the `.duckdb` file
itself over plain HTTP (a plain GET, no `httpfs` needed) and `ATTACH` the
local copy.** This is still just a static-file GET against `--serve` today
and a `raw.githubusercontent.com`/Release URL later — it preserves the exact
"survives to real hosting unchanged" property that ruled out FastAPI, needs
no `httpfs` extension at all, and reuses `http-cache.ts`'s existing fetch
machinery. Reading Parquet exports instead is a further fallback only if
even that doesn't work out.

**Considered and rejected: a FastAPI (or similar) REST/JSON layer instead**,
which would remove this assumption entirely (plain `fetch()` + `JSON.parse()`
in GoBuddy, no DuckDB client, nothing to spike). Rejected because GoRefs'
actual end goal is being served statically from GitHub Pages (per its own
README's "Git as a Database" philosophy) — GitHub Pages cannot run a server
process at all, so anything built on FastAPI would have to be thrown away
before real deployment. The `httpfs`/`ATTACH`-over-static-file approach is
the only one of the two that survives unchanged from local `--serve` today
to real static hosting later, which is the whole point of building against
the target shape from day one. (Separately, real deployment will likely need
to serve the `.duckdb`/Parquet files from `raw.githubusercontent.com` or a
Release asset rather than Pages itself — Pages has a documented bug
mishandling range requests on binary files — but that doesn't change this
plan's local `--serve` target.)

## Error handling

- GoRefs server unreachable (neither already running nor able to be
  spawned/reached within a timeout) fails the whole `npm run ingest` run
  loudly — same philosophy as today's fetch failures.
- The probe in architecture step 1 must confirm the responder is actually
  GoRefs (a real query succeeds), not merely that some process holds the
  port.

## Testing

- Downstream step tests (`writeReferenceJson`, sqlite, manifest, slug-check)
  are unaffected.
- New: the GoRefs-query layer should be testable against a fixture
  `.duckdb` file via a direct file-path `ATTACH` (no HTTP server needed) for
  fast unit tests, reserving the real `--serve` + HTTP path for actual
  `npm run ingest` runs and a slower integration-style check.

## Closing phase (after implementation + a passing test run)

- Remove now-dead ingestion scripts (the "Removed entirely" list above).
- Update `docs/architecture.md`'s Scripts table, `docs/ingestion-runbook.md`,
  `docs/data-model.md` if it describes source provenance, and
  `docs/roadmap.md`'s Phase 0 entry to describe the GoRefs-sourced pipeline
  instead of the retired direct fetchers.

## Out of scope (logged elsewhere, not this branch)

- **`reference.sqlite` bundling switch** (shipping a prebuilt sqlite file
  with releases instead of `reference.json` + `reference-sync.ts`'s runtime
  load) — flagged high-priority given the size trajectory, but its own plan,
  sequenced *after* the screenshot-onboarding plan below.
- **Screenshot/OCR-based dex onboarding** (parsing screenshots to bulk-populate
  a user's collection instead of manual entry — motivated by accounts with
  thousands of already-caught Pokémon) — the *next* plan after this one,
  before the sqlite-bundling switch.
- **Settings-page "check for database updates"** — TODO only. Cuts against
  the app's local-first principle; owner is not committed to it.
