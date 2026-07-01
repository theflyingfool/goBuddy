# PoGo Buddy

A local-only, fully offline Pokémon GO living-dex tracker. No accounts, no
backend, no network calls at runtime — all personal data stays on the
device. Currently a Vite web app during development; targets a
Capacitor-wrapped Android APK (sideloaded, not Play Store).

See [CLAUDE.md](./CLAUDE.md) for the full project spec (schema, features,
scope) and [TODO.md](./TODO.md) for current status, known issues, and
backlog.

## Stack

TypeScript + Vite, no frontend framework. SQLite is the storage model
(schema in `src/db/schema.ts`); the app currently runs against an in-memory
dummy repository (`src/data/dummy-repository.ts`) seeded from real ingested
reference data, ahead of wiring up the real
`capacitor-community/sqlite`-backed client.

## Running it

```
npm install
npm run dev
```

Opens the app at `http://localhost:5173` (or whatever port Vite picks).

## Reference data ingestion

The species/form/type reference data (`src/data/reference.json`) is built
from a combination of a Pokémon GO tracking spreadsheet (checked into the
repo root as CSVs) and [PokeAPI](https://pokeapi.co). See
`scripts/ingest/` and `INGESTION_PROGRESS.md` for details.

```
npm run ingest:fetch   # pull/cache PokeAPI data (rate-limited, resumable)
npm run ingest:build   # build src/data/reference.json from the cache + CSVs
```

To manually add or correct entries (e.g. a new costume) instead of
re-running the automated pipeline:

```
npm run ingest:csv:export     # dump current reference data to CSV for review
npm run ingest:csv:template   # blank CSV with the right headers
npm run ingest:csv:import     # merge a filled-in CSV back into reference.json
```

## Inspecting the schema directly

```
npm run build:dummy-db
```

Writes `dummy.sqlite` at the repo root (gitignored, regeneratable) — open
it in DB Browser for SQLite, `sqlite3`, or any SQLite client to browse the
schema and real ingested data directly.
