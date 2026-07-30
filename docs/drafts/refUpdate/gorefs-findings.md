# GoRefs evaluation — wholesale replacement candidate?

Investigation date: 2026-07-30. Source: `/home/nick/Repos/GoRefs`, a local-only
repo (no git remote) implementing the brief in `gpt.md` /
`Pokemon GO Unified API - Implementation Plan v2.md` in this same folder.
Evaluated by inspecting its code, `config/sources.yml`, and querying its
built `output/GoRefs_Master.duckdb` directly — not just reading its README's
claims.

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

## Data quality, checked directly against the built database

| Table | README claims | Actual rows | Notes |
|---|---|---|---|
| `species` | 1,024 canonical | 1,024 | Looks solid. |
| `forms` | 1,400, incl. costumes, gender split | 1,400 | **`costume_name` is `NULL` for all 1,400 rows — zero costume forms captured.** **`gender` is `"unknown"` for all 1,400 rows** — the gender-split source described in [[project_reference_data_ingestion]] never made it into the merge. |
| `moves` | 317 | 317 | Not spot-checked beyond count. |
| `badges` | 597 | 597 | `type`/`description` columns look misaligned — e.g. rows where `type` is the literal boolean `True` and `description` holds event-location text ("Jeju Island, 2023") instead of a badge description. Looks like a parsing bug in the pogoapi_net badges fetcher, not clean data. |
| `raid_bosses` | listed as a canonical domain table | **0** | Declared in the schema, never populated. |
| `quests` | listed as a canonical domain table | **0** | Same — empty. |
| `discrepancies` | "fully audited field discrepancies" | **3** | Across 7 merged sources with heavy field overlap (base stats, shiny dates, costumes), 3 total conflicts strongly suggests the conflict detector only compares a couple of fields, not the full merge surface the README implies. |

None of this is visible from the README or docs — it only surfaced by
querying the actual `.duckdb` file.

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
  GoRefs' `badges` table shows no equivalent alignment step, and the data
  itself looks corrupted (see table above) — this would need to be rebuilt,
  not reused.
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

1. File/fix the specific gaps found here (costume forms, gender split, empty
   `raid_bosses`/`quests`, badges parsing) upstream in GoRefs itself — this
   evaluation only checked the current build, not whether the pipeline code
   could produce correct data with fixes.
2. Any adoption is additive (new domains GoBuddy lacks), not a swap — the
   output-format gap alone means the existing `reference.json` pipeline stays
   as the source of truth for what it already covers.
3. Because GoRefs has no remote yet, there's nothing to submodule against
   until it's pushed somewhere.
