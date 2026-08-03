# Reference-data ingestion runbook

The operational order for regenerating `src/data/reference.json` for a real
game update (new season, new species, corrected data). For *what each script
does*, see [architecture.md](architecture.md)'s "Scripts" table — this doc is
*order*, not description. For the source formats these scripts read, see
[data-model.md](data-model.md)'s "Reference data ingestion" section.

## Order

```sh
npm run ingest   # fetch, build, slug-check, sprites, sqlite, manifest -- runs everything in order, in one shot
```

`scripts/ingest/ingest.ts` is the only ingestion entry point — there is no
step-by-step equivalent of the old per-script npm commands any more. Its
internal steps, in order:

1. **fetch** — pulls fresh GAME_MASTER (`alexelgt/game_masters`),
   `pokemon-go-api.github.io`'s pokedex/types/mega files, and the
   pokemongo-shiny community sheet into `scripts/ingest/.cache-v2/`
   (`raidboss.json` is deliberately not fetched — raid-boss ingestion was
   dropped and nothing consumes it, so fetching/hashing it would only feed
   `ingest:check` false positives on raid-rotation churn). Always
   re-fetches (no live pogoapi.net dependency any more — the one thing it
   used to supply that GAME_MASTER doesn't, medal display names, comes from
   the committed `vendor/pogoapi-snapshot/badges.json` snapshot instead).
2. **build** — runs the `scripts/ingest/transform/*.ts` modules over that
   cache and writes `src/data/reference.json`, `src/data/reference-gaps.json`,
   `src/data/reference-version.ts`, and the sprite manifest
   (`scripts/ingest/write/*.ts`).
3. **slug-check** — inline port of the old `check-slug-stability.ts`: fails
   loudly if a species/form/mega-variant/medal slug the last *committed*
   `reference.json` had has vanished, unaccounted for.
4. **sprites** — `fetch-sprites.ts` downloads sprite art referenced by the
   cache (skip-if-cached), then `build-sprites.ts` converts it to WebP into
   `public/sprites/`. Skip with `npm run ingest -- --skip-sprites` (the extra
   `--` is required for npm to forward the flag instead of swallowing it).
5. **sqlite** — materializes `reference.sqlite` from the same in-memory
   `ReferenceData` the build step produced. Skip with
   `npm run ingest -- --skip-sqlite`.
6. **manifest** — writes `scripts/ingest/.cache-v2/ingestion-manifest.json`
   (per-source fetch fingerprints: GAME_MASTER's latest commit SHA, content
   hashes for the pokemon-go-api files and the shiny sheet). This one file is
   committed (see `.gitignore`), unlike the rest of `.cache-v2/`.

```sh
npm run ingest:check   # fetch + build an in-memory manifest (never written to disk)
                        # + diff against the last committed manifest only -- skips
                        # build/sprites/slug-check entirely, exits non-zero if any
                        # upstream source changed
```

Use `ingest:check` to answer "has anything upstream changed since the
reference data currently shipped was built" without paying for a full build.

There is no manual-CSV-correction workflow any more — `ingest:csv:export/
template/import` (`scripts/ingest/csv-authoring.ts`) was removed along with
the rest of the old per-script pipeline. `src/data/reference-csv-format.ts`
still exists, but only as the in-app Coverage Report's own export/read
format now — it has no ingestion-side writer.

## Known pitfalls

- **Slug stability**: the inline slug-check step diffs the freshly-built
  `reference.json` slugs against the last committed version and fails if a
  species, form, mega-variant, or **medal** slug vanished without a matching
  `src/db/slug-renames.ts` entry (species/form only — mega variants and
  medals have no rename mechanism, so any disappearance there fails the
  build every time). Medal slugs matter here because they depend on a
  subsequence-alignment join between GAME_MASTER and the vendored
  `badges.json` snapshot (`scripts/ingest/sources/pogoapi-badges.ts`) — if
  that alignment ever degrades, `medal_progress_personal.medal_slug` (a live
  FK with no other automated drift detection) would silently break sync for
  any user with medal progress.
- **Costume-form renames don't auto-generate**: `src/db/slug-renames.ts` is
  only ever auto-populated for non-costume forms (Standard/region/Gigantamax),
  matched by dex number + form name + gender against the previously-committed
  `reference.json` — costume vocabulary differs too much between ingestion
  sources to auto-match confidently. A costume-form slug that disappears
  without a hand-added rename entry quarantines (`personal_data_quarantine`,
  `src/db/schema.ts`) instead of carrying forward automatically; recover it
  by hand from the quarantined row's `payload_json` if needed.

## Checkpoint before committing

Open the in-app **Coverage Report** (or re-run `npm run ingest` and check
`src/data/reference-gaps.json`) and confirm the gap count moved the
direction you expect — a correction pass that *increases* gaps somewhere you
didn't touch usually means an ordering mistake above, not new missing data.
`reference-gaps.json` also carries comparative gaps (`missing-species`,
`gigantamax-mismatch`, `family-root-mismatch`) diffed against the last
*committed* `reference.json` — these track known upstream data gaps (see
[v2-data-source-findings.md](v2-data-source-findings.md)), not fresh
regressions from your own change.

For release publishing steps and app deployment workflows, refer to the canonical [docs/release-checklist.md](release-checklist.md).

## `GoRefs` vendored as a git subtree

`vendor/reference/GoRefs` vendors
[theflyingfool/GoRefs](https://github.com/theflyingfool/GoRefs), the
author's own standalone DuckDB-based Pokémon GO reference pipeline, as a
**git subtree** (not a submodule — its files are directly part of this
repo's history; a normal `git clone`/`git pull` is all that's needed, no
separate `git submodule update --init` step).

It was evaluated 2026-07-30 as a candidate for wholesale-replacing this
project's own ingestion pipeline and rejected at that time — costume/gender
data was unpopulated, `raid_bosses`/`quests` tables were empty, and it
produced no JSON output matching this project's shape. A follow-up parity
pass (2026-08-02, from the GoRefs side) found those gaps closeable via
GoRefs' own `refjson_*` shim tables. **As of the design in
[docs/superpowers/specs/2026-08-03-gorefs-ingestion-source-swap-design.md](superpowers/specs/2026-08-03-gorefs-ingestion-source-swap-design.md),
GoBuddy's ingestion pipeline is planned to query this vendored copy's data
directly (over HTTP, via GoRefs' own `--serve`) instead of GAME_MASTER/
pokemon-go-api/shiny-sheet fetches — see that doc for the full design.**
Until that implementation lands, this section still describes the
pre-swap pipeline below; treat this note as the pointer to what's coming.

The previously-separate `pokemon-go-api` submodule (vendored purely as
continuity insurance against its hosted API going stale) was removed once
GoRefs started committing its own `raw_dumps/` upstream snapshots — GoRefs
is now the single source of that continuity insurance instead of
maintaining two vendored copies for overlapping purposes.
