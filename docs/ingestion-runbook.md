# Reference-data ingestion runbook

The operational order for regenerating `src/data/reference.json` for a real
game update (new season, new species, corrected data). For *what each script
does*, see [architecture.md](architecture.md)'s "Scripts" table — this doc is
*order*, not description. For the source formats these scripts read, see
[data-model.md](data-model.md)'s "Reference data ingestion" section.

## Order

```sh
npm run ingest   # build, slug-check, sprites, sqlite, manifest -- runs everything in order, in one shot
```

`scripts/ingest/ingest.ts` is the only ingestion entry point — there is no
step-by-step equivalent of the old per-script npm commands any more. Its
internal steps, in order:

1. **build** — queries the vendored GoRefs project (`vendor/reference/GoRefs`,
   over HTTP via GoRefs' own `--serve`) for every `ReferenceData` domain, no
   separate fetch step (`buildFromGoRefs` in `ingest.ts` probes for an
   already-running GoRefs server, or spawns and later tears down its own —
   see `scripts/ingest/gorefs/`). Also fetches `pokemon-go-api.github.io`'s
   `pokedex.json` for sprite URLs (GoRefs doesn't model sprite assets) and
   builds the sprite manifest from it. Writes `src/data/reference.json`,
   `src/data/reference-gaps.json`, `src/data/reference-version.ts`, and the
   sprite manifest (`scripts/ingest/write/*.ts`).
2. **slug-check** — inline port of the old `check-slug-stability.ts`: fails
   loudly if a species/form/mega-variant/medal slug the last *committed*
   `reference.json` had has vanished, unaccounted for.
3. **sprites** — `fetch-sprites.ts` downloads sprite art referenced by the
   cache (skip-if-cached), then `build-sprites.ts` converts it to WebP into
   `public/sprites/`. Skip with `npm run ingest -- --skip-sprites` (the extra
   `--` is required for npm to forward the flag instead of swallowing it).
4. **sqlite** — materializes `reference.sqlite` from the same in-memory
   `ReferenceData` the build step produced. Skip with
   `npm run ingest -- --skip-sqlite`.
5. **manifest** — writes `scripts/ingest/.cache-v2/ingestion-manifest.json`.
   Default field is `gorefs.lastBuiltAt` (GoRefs' `_meta` table's `__build__`
   row); `gameMaster`/`pokemonGoApi`/`shinySheet` stay empty-string
   placeholders now (see below). This one file is committed (see
   `.gitignore`), unlike the rest of `.cache-v2/`.

The old GAME_MASTER/pokemon-go-api/shiny-sheet direct-fetch pipeline
(`sources/game-master.ts`, `sources/shiny-sheet.ts`, `sources/pogoapi-badges.ts`,
`transform/species.ts`'s `buildSpecies` and the other `transform/*.ts`
modules) is **not deleted, just unwired** from the default pipeline —
`fetchAllFromGameMaster`/`buildFromGameMaster` (renamed from `fetchAll`/
`build`) stay exported in `ingest.ts` as a manual reactivation path per
domain, should the `refjson_*` freeze (see below) become a real problem
before GoRefs promotes a domain to its own canonical schema. See
[docs/superpowers/specs/2026-08-03-gorefs-ingestion-source-swap-design.md](superpowers/specs/2026-08-03-gorefs-ingestion-source-swap-design.md)
for the full rationale, including the accepted frozen-data trade-off: every
domain today comes from GoRefs' `refjson_*` shim, a snapshot of GoBuddy's own
last pre-swap `reference.json` — no new species/forms/moves/medals enter the
dataset until GoRefs promotes each domain to an independently-correct
canonical table.

```sh
npm run ingest:check   # builds an in-memory manifest (never written to disk)
                        # + diffs against the last committed manifest only --
                        # skips build/sprites/slug-check entirely, exits
                        # non-zero if GoRefs' database changed
```

Use `ingest:check` to answer "has GoRefs' database changed since the
reference data currently shipped was built" without paying for a full build.
It stays cheap deliberately: it only *probes* whether a GoRefs server is
already reachable and reports an empty signal if not, rather than spawning
one — see `scripts/ingest/write/manifest.ts`'s `fetchGoRefsLastBuiltAt` doc
comment for the known consequence (a plain `npm run ingest` on a machine
with no persistent GoRefs `--serve` already running usually gets an empty
`gorefs.lastBuiltAt` in the *manifest* step too, since the *build* step's
own spawned server is already torn down by then).

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
GoRefs' own `refjson_*` shim tables. **Implemented 2026-08-04**, per
[docs/superpowers/specs/2026-08-03-gorefs-ingestion-source-swap-design.md](superpowers/specs/2026-08-03-gorefs-ingestion-source-swap-design.md)
and [docs/superpowers/plans/2026-08-03-gorefs-ingestion-source-swap.md](superpowers/plans/2026-08-03-gorefs-ingestion-source-swap.md):
GoBuddy's default ingestion pipeline now queries this vendored copy's data
directly (over HTTP, via GoRefs' own `--serve`) instead of fetching
GAME_MASTER/pokemon-go-api/the shiny sheet — see the "Order" section above
for the current pipeline, and the design doc for the full rationale
(including the accepted frozen-data trade-off).

The previously-separate `pokemon-go-api` submodule (vendored purely as
continuity insurance against its hosted API going stale) was removed once
GoRefs started committing its own `raw_dumps/` upstream snapshots — GoRefs
is now the single source of that continuity insurance instead of
maintaining two vendored copies for overlapping purposes.

### Editing GoRefs itself: no separate clone exists

There is no standalone local clone of GoRefs (`~/Repos/GoRefs` was removed
2026-08-03, once it had a GitHub remote and everything was confirmed pushed).
**`vendor/reference/GoRefs` inside this checkout is the only working copy —
any edit to GoRefs' own source (not just GoBuddy's ingestion code) happens
here.** The two projects are tightly coupled right now and are being built
together deliberately, but GoRefs still has to end up as a normal, healthy
commit history on its own remote, not just changes buried inside GoBuddy's
history. That makes committing in GoBuddy alone insufficient — a GoRefs-side
edit isn't done until it's also pushed to GoRefs' own remote:

1. Edit files under `vendor/reference/GoRefs/` as needed.
2. Commit normally in GoBuddy (this captures the change in GoBuddy's
   history, same as any other file).
3. Push that same change to GoRefs' own remote:
   ```sh
   git subtree push --prefix=vendor/reference/GoRefs https://github.com/theflyingfool/GoRefs.git main
   ```

Step 3 is required, not optional — it's what keeps GoRefs' own repo a real,
independently-pushable project rather than content that only exists inside
GoBuddy. Do this every time `vendor/reference/GoRefs/` changes, not as a
periodic batch cleanup (a change sitting committed in GoBuddy but never
subtree-pushed is effectively lost from GoRefs' own perspective — nothing
else can pull it). `git subtree pull` (see above) is the reverse direction,
for picking up changes made directly on GoRefs' GitHub remote (e.g. a PR
merged there without going through this checkout).
