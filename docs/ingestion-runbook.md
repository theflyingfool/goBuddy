# Reference-data ingestion runbook

The operational order for regenerating `src/data/reference.json` for a real
game update (new season, new species, corrected data). For *what each script
does*, see [architecture.md](architecture.md)'s "Scripts" table — this doc is
*order*, not description. For the source formats these scripts read, see
[data-model.md](data-model.md)'s "Reference data ingestion" section.

## Order

```sh
npm run ingest:fetch      # 1. pull/cache PokeAPI data (rate-limited, resumable)
npm run ingest:gigantamax # 2. parse the Gigantamax-capable species list
npm run ingest:build      # 3. build src/data/reference.json from the cache + CSVs
npm run ingest:events     # 4. parse event-sourced costume/Pokémon data
npm run ingest:check-slugs # 5. fail loudly if a slug vanished without a rename
```

Then, only if you have manual corrections to apply (a new costume, a slug
fix, a data-quality correction found via Coverage Report):

```sh
npm run ingest:csv:export     # dump current reference data to CSV for review
npm run ingest:csv:template   # blank CSV with the right headers, if adding new rows
npm run ingest:csv:import     # merge a filled-in CSV back into reference.json
```

## Why this order

- `ingest:fetch` populates the disk cache that `ingest:build` reads from —
  running `ingest:build` first just reuses whatever's already cached (fine
  if you only want the CSV-sourced skeleton refreshed, wrong if you need new
  PokeAPI data).
- `ingest:gigantamax` needs to run *before* `ingest:build`: it writes a
  persisted, git-tracked intermediate file
  (`data-authoring/gigantamax-species.json`) that `build-reference.ts` reads
  and merges in (`scripts/ingest/build-reference.ts:342-432`). Because that
  file persists on disk between runs, forgetting to re-run
  `ingest:gigantamax` after a game update doesn't error — `ingest:build` just
  silently reuses whatever's already there (a `console.log`, not a thrown
  error, if the file is missing entirely). This step was missing from
  README's documented order until this pass; it's the exact kind of ordering
  mistake the Theme 8 review flagged as already having happened once, for
  the same "trust a stale intermediate file" reason.
- `ingest:events` runs last because it parses a committed wikitext snapshot
  independently of the PokeAPI/CSV merge — order relative to `ingest:build`
  matters less here, but running it last means its output isn't clobbered by
  a later `ingest:build` re-run in the same session.
- The CSV round-trip (`export` → hand-edit → `import`) is a separate,
  optional path for corrections that don't come from PokeAPI or the wikitext
  snapshot at all — run it after the automated steps above, not instead of
  them, since `ingest:build` doesn't know about your hand-edits.

## Known pitfalls

- **Silent skip**: a hand-edited CSV re-imported via `ingest:csv:import` only
  updates fields the CSV format actually covers
  (`src/data/reference-csv-format.ts`) — a correction to a field outside that
  shape won't error, it just won't apply. Check the field is in that column
  list before trusting a CSV-based fix.
- **Stale intermediate file**: `ingest:build` never errors if you skip
  `ingest:gigantamax` after a game update — it just reuses whatever's already
  committed in `data-authoring/gigantamax-species.json` (see above). This
  class of mistake — trusting a stale cached/intermediate file instead of
  re-running its generator — has already caused a stale-data incident once
  (six real GO megas — Pidgeot, Kangaskhan, Mewtwo X/Y, Kyogre, Groudon —
  missing from the tracker; see
  [`docs/v1-roadmap/02-reference-data-corrections.md`](v1-roadmap/02-reference-data-corrections.md)
  item 5).
- **Slug stability**: `npm run ingest:check-slugs`
  (`scripts/ingest/check-slug-stability.ts`) diffs the working tree's
  `reference.json` slugs against the last committed version and fails if a
  form slug vanished without a matching `src/db/slug-renames.ts` entry, or if
  any species/mega-variant slug vanished at all (neither has a rename
  mechanism). Run it as part of every ingestion pass, before committing.
- **`ingest:build` wipes previously-imported event-costume rows**:
  `build-reference.ts` regenerates `reference.json` wholesale from the Forms
  CSV + Gigantamax data only — it doesn't know about any event-costume rows
  a past `ingest:csv:import data-authoring/event-pokemon.csv` merged in,
  since those never round-trip back into the Forms CSV. Running `ingest:build`
  alone after such an import silently drops every event-costume form slug
  (confirmed via `ingest:check-slugs` reporting dozens of vanished Pikachu/
  Ditto/Corsola/etc. costume slugs after a plain `ingest:build` run). If
  you've ever run `ingest:csv:import` on this repo, **always re-run it again
  after any `ingest:build`** (re-importing the same, unchanged
  `event-pokemon.csv` is safe and lossless) — don't rely on `ingest:events`
  alone regenerating that CSV to also re-merge it; that's still a manual step.

## Checkpoint before committing

Open the in-app **Coverage Report** (or re-run `ingest:build` and check
`src/data/reference-gaps.json`) and confirm the gap count moved the
direction you expect — a correction pass that *increases* gaps somewhere you
didn't touch usually means an ordering mistake above, not new missing data.
