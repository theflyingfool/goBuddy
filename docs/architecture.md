# Codebase map

*Purpose: answer "what is this file for" without re-exploring the codebase.
This is a map, not a rationale doc — for **why** things are shaped this way,
see [data-model.md](data-model.md) (storage/schema design),
[features.md](features.md) (feature intent), and `docs/v1-roadmap/` /
`docs/v1-tasks/` (what's being built and why). Keep entries to one line;
if an entry needs a paragraph, that content belongs in one of those docs
instead, linked from here.*

## App shell (`src/app-shell/`)

| File | Purpose |
|---|---|
| `main.ts` (repo root of `src/`) | Wires the repository, router, and page renderers together; the app's entry point. |
| `header.ts` | Top bar: species-filter input, jump-to-species search, or nothing, depending on the current route. |
| `nav-drawer.ts` | Slide-out navigation between routes. |
| `router.ts` | The `Route` union type + path parsing/building (`speciesDetailPath`, etc.) — no framework, just a discriminated union and a switch. |

## Features (`src/features/`)

| Module | Purpose |
|---|---|
| `data-entry/species-grid.ts` | The main dex grid: tiles, filter chips, region/search filtering. |
| `data-entry/species-detail.ts` | Per-species page: toggles every achievement field across all of a species' forms. |
| `data-entry/bulk-form-edit.ts` | "Sweep one field across many forms" page — mark all banked 4★s/shinies at once without opening each species. |
| `data-entry/field-groups.ts` | `SPECIES_FIELDS`/`FORM_FIELD_GROUPS` — the single source of truth for which achievement fields exist and how they're grouped in the UI; drives detail-page rendering, cascades, and stats. |
| `data-entry/indicator-labels.ts` | Badge glyphs + full-text labels for every achievement field, used by grid chips and detail toggles. |
| `coverage-report/coverage-report-page.ts` | Dev-facing view of which species are missing reference-data fields (types, region, availability flags); also drives the CSV export/import authoring round-trip. |
| `settings/settings-page.ts` | App-wide settings: grid indicator picks, gender-collapse toggle, export/import entry points. |
| `settings/personal-data-transfer.ts` | Manual (non-syncing) cross-device personal-data export/import — writes/reads a file the user moves themselves. |
| `stats/stats-page.ts` | The completion-stats feature: scope × lens picker, drill-down to missing species. |
| `stats/lens-labels.ts` | Labels + stable string keys for each `CompletionLens`, used for persisting the user's checkbox selections. |
| `stubs.ts` | Placeholder pages for not-yet-built nav destinations (Search Tools, Achievements, XP Assistant). |

## DB layer (`src/db/`)

| File | Purpose |
|---|---|
| `schema.ts` | SQL DDL for both reference and personal tables — the single source of truth consumed by `scripts/build-dummy-db.ts` and the on-device migration runner. Also defines `CURRENT_PERSONAL_SCHEMA_VERSION`. |
| `types.ts` | camelCase TypeScript mirror of `schema.ts`; drives SQL, UI field groups, cascades, and the export format from one place. |
| `migrations.ts` | Personal-schema migration runner — only ever touches personal tables; reference tables are wholesale-replaced, never migrated. |
| `reference-data.ts` | The `ReferenceData` shape of the bundled `src/data/reference.json` asset. |
| `reference-sync.ts` | On every startup, wipes and reloads reference tables from `reference.json` if its content hash changed; applies slug renames first. |
| `slug-renames.ts` | Hand-maintained registry mapping old→new slugs, so a display-name correction in the ingestion pipeline doesn't orphan personal data already keyed to the old slug. |
| `cascades.ts` | Forward-only cascade rules (e.g. checking Shundo auto-checks Shiny/4★/Caught), built programmatically from `field-groups.ts`. |
| `defaults.ts` | Default `app_settings` values seeded on a fresh install. |
| `sqlite-client.ts` | Bootstraps the real `@capacitor-community/sqlite` connection — native on Android, `jeep-sqlite`+`sql.js`+IndexedDB on web. |

## Data/repository layer (`src/data/`)

| File | Purpose |
|---|---|
| `repository.ts` | The `Repository` interface the UI codes against — both backends below implement this same shape. |
| `sqlite-repository.ts` | The real backend: reads served from an in-memory cache loaded once at startup, writes go through to real SQLite via a write queue. |
| `in-memory-store.ts` | Query/filter engine behind `sqlite-repository.ts`; personal-data mutations call a hook that writes through to real SQLite. |
| `personal-demo-seed.ts` | Hand-written demo toggles seeding `scripts/build-dummy-db.ts`'s generated `dummy.sqlite` fixture — never used by the real on-device backend. |
| `completion-stats-sql.ts` | Real parameterized SQL for the completion-stats feature, one query shape per lens kind. |
| `reference-csv-format.ts` | The flat CSV column shape shared by the ingestion pipeline's authoring round-trip and the in-app Coverage Report, so a hand-edited export round-trips through `npm run ingest:csv:import` unchanged. |
| `reference.json` / `reference-gaps.json` | Generated build artifacts — see "Scripts" below, not hand-authored. |

## UI helpers (`src/ui/`) and shared (`src/shared/`)

| File | Purpose |
|---|---|
| `ui/dom.ts` | Minimal DOM-builder helpers (`el`, `clear`) — no framework, by project decision. |
| `ui/sprites.ts` | Sprite path convention (`public/sprites/<dex-number>.png`); per-form art isn't wired up yet — see `docs/v1-tasks/05-image-pipeline.md`. |
| `shared/file-download.ts` | Cross-platform "save this file for the user" helper (File System Access API → Blob fallback → Capacitor native share), used by Settings export and Coverage Report's CSV export. |

## Scripts (`scripts/`)

| File | Purpose |
|---|---|
| `bump-version.ts` (`npm run version:bump`) | Bumps `package.json` semver + `android/app/build.gradle` `versionName`/`versionCode` together, per CLAUDE.md's release workflow. |
| `build-dummy-db.ts` (`npm run build:dummy-db`) | Generates a real `dummy.sqlite` file at the repo root for inspecting the schema with an external SQLite tool. |
| `ingest/build-reference.ts` (`npm run ingest:build`) | Orchestrator: merges the Forms CSV skeleton + cached PokeAPI data + partial-list CSV fallback, emits `src/data/reference.json` and `reference-gaps.json`. |
| `ingest/fetch-pokeapi-data.ts` (`npm run ingest:fetch`) | Walks the national dex, caches PokeAPI responses to disk (resumable, rate-limited). |
| `ingest/csv-authoring.ts` (`npm run ingest:csv:*`) | Manual-correction workflow: export current data to CSV, emit a blank template, or import a filled CSV back into `reference.json`. |
| `ingest/gap-detection.ts` | Stateless checks over the current `reference.json` for missing key fields — no external fetch. |
| `ingest/parse-event-pokemon.ts` (`npm run ingest:events`) | Parses a committed Bulbapedia wikitext snapshot into costume `form` rows. |
| `ingest/parse-forms-csv.ts` | Parses the root-level Forms CSV into the species/form skeleton + PoGo availability flags. |
| `ingest/parse-gigantamax.ts` (`npm run ingest:gigantamax`) | Parses the Gigantamax-capable species list. |
| `ingest/parse-types-csv.ts` | Parses a fallback types/gen CSV source (PokeAPI is primary). |
| `ingest/pokeapi-client.ts` | Rate-limited, disk-cached PokeAPI fetch wrapper used by `fetch-pokeapi-data.ts`. |
| `ingest/pokemon-facts.ts` | Small hand-maintained constants PokeAPI doesn't expose (e.g. the Ultra Beast list, `NO_STANDARD_FORM_NAMES`). |
| `ingest/slug.ts` | Shared slug generator (`slugify(name/form/costume/gender)`) — see data-model.md's "Identity/slug rework" note for why this is a known fragility. |

For the order these run in during a real data update, see
[docs/ingestion-runbook.md](ingestion-runbook.md).

## Data-authoring inputs (pre-build sources, not generated)

- Root-level `Blank Pokedex Project (Living Column) - Forms w_ Dynamax.csv` — the species/form skeleton.
- `data-authoring/event-pokemon.csv`, `data-authoring/gigantamax-species.json` — tracked authoring inputs.
- `data-authoring/reference-export.csv` — gitignored, regenerated via `npm run ingest:csv:export`.

## Key patterns

These show up across many files above; understanding them once here saves
re-deriving them per file.

- **Write-queue (`sqlite-repository.ts`)**: every personal-data edit updates
  the in-memory cache immediately (so the UI shows it "saved" instantly) and
  writes to the real on-device SQLite database asynchronously through a
  queue. The UI never waits on a disk write; a failed write today only
  surfaces as `console.error` (a known gap — see
  `docs/v1-tasks/02-data-safety-net.md`).
- **Cascade (`db/cascades.ts`)**: checking a combined achievement
  (e.g. Shundo) auto-checks its logical prerequisites (Shiny, 4★, Caught)
  forward-only — un-checking never cascades, since that would silently erase
  independently-verified facts. Built programmatically from
  `field-groups.ts`'s field list, not hand-maintained separately.
- **Single-backend split (`data/`)**: `sqlite-repository.ts` implements
  `Repository`, backed by the shared query/filter engine in
  `in-memory-store.ts` (reads/mutations) plus real parameterized SQL in
  `completion-stats-sql.ts` (completion stats). A second, pure-browser
  fallback backend (`dummy-repository.ts`) existed early on; it was never
  wired into `main.ts` and was deleted once confirmed dead — see
  `docs/v1-tasks/06-performance-and-quality-infra.md`.
- **Single-source-of-truth field lists (`db/types.ts` +
  `features/data-entry/field-groups.ts`)**: the ~25 personal achievement
  fields are enumerated once and drive the SQL schema, the detail-page UI
  groups, the cascade rules, and the export/import shape — adding a new
  field touches few places by design.
