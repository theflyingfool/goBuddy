# Reference-data ingestion runbook

The operational order for regenerating `src/data/reference.json` for a real
game update (new season, new species, corrected data). For *what each script
does*, see [architecture.md](architecture.md)'s "Scripts" table — this doc is
*order*, not description. For the source formats these scripts read, see
[data-model.md](data-model.md)'s "Reference data ingestion" section.

## Order

```sh
npm run ingest:all   # runs everything below in order, in one shot
```

Or step by step, when you only need part of the chain:

```sh
npm run ingest:fetch          # 1. pull/cache pokemon-go-api + pogoapi.net data (resumable)
npm run ingest:fetch-sprites  # 2. download sprite art referenced by that cache (resumable)
npm run ingest:build          # 3. build src/data/reference.json + reference-gaps.json + the sprite manifest
npm run ingest:build-sprites  # 4. convert the cached sprites to WebP into public/sprites/
npm run ingest:check-slugs    # 5. fail loudly if a slug vanished without a rename
```

Then, only if you have manual corrections to apply (a new costume, a slug
fix, a data-quality correction found via Coverage Report):

```sh
npm run ingest:csv:export     # dump current reference data to CSV for review
npm run ingest:csv:template   # blank CSV with the right headers, if adding new rows
npm run ingest:csv:import     # merge a filled-in CSV back into reference.json
```

## Why this order

- `ingest:fetch` populates the disk cache (`scripts/ingest/.cache-v2/`) that
  everything else reads from — running any later step first just reuses
  whatever's already cached (or errors if nothing's cached yet).
- `ingest:fetch-sprites` walks that cache for every sprite URL (species,
  region forms, costumes, mega/Gigantamax) and downloads the originals —
  independent of `ingest:build`, but both read the `ingest:fetch` cache.
  Already-downloaded files are skipped on re-run.
- `ingest:build` must run before `ingest:build-sprites` — it's what writes
  `sprite-manifest.json` (slug → source image URLs), which
  `ingest:build-sprites` reads to know which cached file promotes to which
  `public/sprites/` path.
- `ingest:build-sprites` converts each cached PNG to WebP (smaller, natively
  supported everywhere this app ships) into `public/sprites/` — the only
  thing that should ever write there. It skips a `.webp` file that's already
  present, so re-running after adding a handful of new sprites doesn't
  re-encode the other ~7,000.
- The CSV round-trip (`export` → hand-edit → `import`) is a separate,
  optional path for corrections that don't come from the automated sources
  at all — run it after `ingest:build`, not instead of it, since
  `ingest:build` regenerates `reference.json` wholesale and doesn't know
  about your hand-edits.

## Known pitfalls

- **Silent skip**: a hand-edited CSV re-imported via `ingest:csv:import` only
  updates fields the CSV format actually covers
  (`src/data/reference-csv-format.ts`) — a correction to a field outside that
  shape won't error, it just won't apply. Check the field is in that column
  list before trusting a CSV-based fix.
- **Slug stability**: `npm run ingest:check-slugs`
  (`scripts/ingest/check-slug-stability.ts`) diffs the working tree's
  `reference.json` slugs against the last committed version and fails if a
  species or form slug vanished without a matching
  `src/db/slug-renames.ts` entry, or if any mega-variant slug vanished at
  all (no rename mechanism exists for those). Run it as part of every
  ingestion pass, before committing.
- **Costume-form renames don't auto-generate**: `src/db/slug-renames.ts` is
  only ever auto-populated for non-costume forms (Standard/region/Gigantamax),
  matched by dex number + form name + gender against the previously-committed
  `reference.json` — costume vocabulary differs too much between ingestion
  sources to auto-match confidently. A costume-form slug that disappears
  without a hand-added rename entry quarantines (`personal_data_quarantine`,
  `src/db/schema.ts`) instead of carrying forward automatically; recover it
  by hand from the quarantined row's `payload_json` if needed.

## Checkpoint before committing

Open the in-app **Coverage Report** (or re-run `ingest:build` and check
`src/data/reference-gaps.json`) and confirm the gap count moved the
direction you expect — a correction pass that *increases* gaps somewhere you
didn't touch usually means an ordering mistake above, not new missing data.
`reference-gaps.json` also carries comparative gaps (`missing-species`,
`gigantamax-mismatch`, `family-root-mismatch`) diffed against the last
*committed* `reference.json` — these track known upstream data gaps (see
[v2-data-source-findings.md](v2-data-source-findings.md)), not fresh
regressions from your own change.

For release publishing steps and app deployment workflows, refer to the canonical [docs/release-checklist.md](release-checklist.md).

## `pokemon-go-api` submodule is reference-only

`vendor/reference/pokemon-go-api` is a git submodule vendoring
that project's own source (PHP/Composer, branch `main`). It is **not**
read by any `ingest:*` script, not part of the build, and not a dependency
of anything in this repo — it exists purely as continuity insurance:

- `pokemon-go-api` builds its data from `alexelgt/game_masters`' raw
  `GAME_MASTER.json` via a PHP pipeline (`composer run-script api-build`),
  rebuilt on a schedule (`cron: '7 6,8,9,10,18,20,21,22 * * *'` in its own
  `.github/workflows/page.yml`) and redeployed to GitHub Pages only on
  detected changes.
- If that hosted API ever goes stale or the project stops being
  maintained, this vendored copy is the fallback starting point: either
  run its PHP/Composer build ourselves as a one-off against a fresh pull of
  `alexelgt/game_masters`, or use its source as a spec while writing our
  own TypeScript parser directly against the raw GameMaster file.
- No SPDX license is present on the `pokemon-go-api` repo — only a README
  disclaimer ("educational use only," copyright remains Niantic/The
  Pokémon Company). Fine for a private vendored reference copy inside this
  repo; reconsider before ever redistributing or publicly forking its code.
- `alexelgt/game_masters` itself (the raw upstream data, not the parsing
  logic) is deliberately not vendored the same way — it's large, churns
  almost daily, and isn't the thing at continuity risk here.

Clone/update it with `git submodule update --init --recursive`. It is
never required for a normal `npm install` / build / `ingest:*` run.
