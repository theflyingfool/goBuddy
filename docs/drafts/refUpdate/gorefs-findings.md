# GoRefs evaluation — wholesale replacement candidate?

Investigation date: 2026-07-30. Source: `/home/nick/Repos/GoRefs`, a local-only
repo (no git remote) implementing the brief in `gpt.md` /
`Pokemon GO Unified API - Implementation Plan v2.md` in this same folder.
Evaluated by inspecting its code, `config/sources.yml`, running the pipeline
myself (`uv run go_refs.py --build`, which re-fetched raw snapshots and
rebuilt from scratch — same 1,024/1,400/317/3 counts came out, so the gaps
below aren't a stale-build artifact), and then reading the raw upstream JSON
next to `src/builder.py`'s parsing code line-by-line for each gap, rather than
just trusting the README or the row counts.

**Verdict: not a safe wholesale replacement today.** It's a reasonable
*future candidate* for domains GoBuddy doesn't currently ingest, but several
of its canonical tables are silently empty or unpopulated in ways its own
README doesn't disclose, and its output shape doesn't match what GoBuddy's
pipeline needs regardless.

## What it actually is

A Python/uv/DuckDB pipeline (`go_refs.py --fetch/--build/--serve`) that pulls
7 upstream sources into `raw_dumps/`, merges them via a trust-tier priority
list into `output/GoRefs_Master.duckdb`, and serves a local static DuckDB-WASM
explorer. No hosted API — `.github/` doesn't exist, so there's no GitHub
Pages deployment; "pulling from an API" would mean running the pipeline
yourself, not hitting a live endpoint anywhere.

## Data quality, verified against source code and raw upstream JSON

| Table | README claims | Actual rows | Root cause (verified) |
|---|---|---|---|
| `species` | 1,024 canonical | 1,024 | Looks solid. |
| `forms` — costumes | incl. costumes | **0 of 1,400 rows have a costume** | **Confirmed builder bug, not missing data.** The upstream `pokemon_go_api` pokedex dump *does* carry costumes — e.g. dex 25 (Pikachu) has 158 entries in its `assetForms` array, each with a `costume` name and an `isFemale` flag. `src/builder.py`'s form-building loop (lines ~271-339) only ever reads `entry.get("regionForms")`; it never reads `assetForms` at all, and hardcodes `"costume_name": None` on every form it builds. The data exists upstream; GoRefs just never consumes it. |
| `forms` — gender | incl. gender split | **`gender` is `"unknown"` on all 1,400 rows** | Same root cause: the `isFemale` flag that's sitting right next to each costume/form entry in `assetForms` is never read. `builder.py` hardcodes `"gender": "unknown"` at both form-construction sites (lines 295 and 327) unconditionally. |
| `moves` | 317 | 317 | Not spot-checked beyond count. |
| `badges` — `type`/`description` | 597, "type" column | 597 | **Not corruption — a misleading column name.** Upstream `pogoapi_net/badges.json` has a boolean `event_badge` field (true for one-off event medals) which `builder.py` maps into a column literally named `type`, so `type` reads as `True`/`False`/`None` instead of a category. Separately, the odd-looking descriptions ("Jeju Island, 2023") for event badges are genuine upstream data — pogoapi.net just uses location/date as the "description" for event medals, it isn't garbled. Net effect: the `type` column is unusable as a badge category (it's a repurposed boolean), which does matter for our badge-parsing use case, but it isn't a parsing/alignment failure. |
| `raid_bosses` | listed as a canonical domain table | **0** | **Confirmed builder bug, not missing data.** Upstream `pokemon_go_api/raidboss.json` has real, current raid data — 7 populated tiers (`mega`, `lvl5`, `lvl3`, `lvl1`, `shadow_lvl5/3/1`) — but nested one level deeper than the builder expects, under a `currentList` key: `{"currentList": {"mega": [...], "lvl5": [...] , ...}, "graphics": {...}}`. `builder.py` (lines ~443-457) iterates the raw dict's *top-level* keys expecting each value to already be a list of bosses; `"currentList"` and `"graphics"` are both non-list at that level, so the `isinstance(bosses, list)` guard fails for everything and zero rows are ever appended. One extra `raidboss_raw["currentList"]` unwrap would fix it. |
| `quests` | listed as a canonical domain table | **0** | **Not a GoRefs bug** — `pokemon_go_api/quests.json` is itself `[]` right now; the upstream source currently has no quest data to give. GoRefs faithfully reflects an empty upstream here. |
| `discrepancies` | "fully audited field discrepancies" | **3** | **Confirmed structural, not a data fluke.** `resolve_attribute_claim()` — the only function in `builder.py` that ever logs a discrepancy — is called from exactly one place, in the base-stats loop (line ~245). Every other domain (forms, shiny dates, shadow availability, badges, moves, community days) is resolved by ad hoc priority-ordered `.get()` picks that never route through it, so no other domain can *ever* produce a discrepancy regardless of how much sources actually disagree. The "fully audited" claim only holds for base stats. |

None of this is visible from the README or docs, or even from just querying
row counts — it only surfaced by reading `src/builder.py` next to the raw
upstream JSON for each gap.

## Coverage/output mismatch vs. GoBuddy's current pipeline

- GoBuddy's ingestion (`docs/ingestion-runbook.md`) produces exactly what the
  app consumes: `reference.json`, `reference-version.ts`, a sprite manifest,
  and `reference.sqlite`, via TypeScript transforms
  (`scripts/ingest/transform/*.ts`). GoRefs produces only a DuckDB file —
  there is no JSON/SQLite export in GoRefs' shape at all. "Replacing" the
  pipeline would mean writing a new GoRefs → `reference.json` adapter from
  scratch, not swapping a data source underneath the existing one.
- GoBuddy's badges ingestion (`scripts/ingest/sources/pogoapi-badges.ts`)
  does a two-pointer subsequence alignment between GAME_MASTER's
  `badgeSettings` and the vendored badges snapshot specifically because that
  join is fragile and feeds a live FK (`medal_progress_personal.medal_slug`).
  GoRefs' `badges` table shows no equivalent alignment step against
  GAME_MASTER at all — it's just the raw pogoapi_net badge list with a
  mislabeled `type` column (see table above) — so it doesn't produce the
  medal-slug join GoBuddy actually needs; this would need to be rebuilt, not
  reused.
- GoBuddy's slug convention (`{dex}-{name}`) matches GoRefs' — this part
  transfers cleanly and isn't a blocker.
- Costume-form slugs are handled specially in GoBuddy precisely because they
  don't auto-match across sources (`docs/ingestion-runbook.md`, "Known
  pitfalls"). GoRefs currently has zero costume forms to even compare
  against.

## What GoRefs would add if the gaps above were fixed

Domains GoBuddy's current pipeline doesn't ingest at all: `raid_bosses`,
`max_battles`, `quests`, `community_days` (80 rows, looks populated), plus a
`pvpoke` source for PvP move data GoBuddy doesn't currently pull. These are
plausible future additions independent of any "replace everything" decision.

## Recommendation

Don't adopt GoRefs as a source yet. If it's revisited later:

1. The costume/gender and `raid_bosses` gaps are each small, well-understood
   code fixes in `src/builder.py` (read `assetForms` instead of ignoring it;
   unwrap `raidboss_raw["currentList"]` before iterating) — not open research
   questions — but they are currently unfixed, so today's build can't be
   trusted for those fields.
2. Even with those fixes, any adoption is additive (new domains GoBuddy
   lacks — raid bosses, max battles, community days, PvP data), not a swap —
   the output-format gap alone means the existing `reference.json` pipeline
   stays as the source of truth for what it already covers.
3. Because GoRefs has no remote yet, there's nothing to submodule against
   until it's pushed somewhere.
