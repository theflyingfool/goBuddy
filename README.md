# PoGo Buddy

A local-only, fully offline Pokémon GO living-dex tracker. No accounts, no
backend, no network calls at runtime — all personal data stays on the
device. Ships as a Capacitor-wrapped Android APK (sideloaded, not Play
Store); the same TypeScript/Vite web app also runs standalone in a desktop
browser for editing on a computer (see "Cross-device data" below).

See [CLAUDE.md](./CLAUDE.md) for the full project spec (schema, features,
scope) and [TODO.md](./TODO.md) for current status, known issues, and
backlog.

## Stack

TypeScript + Vite, no frontend framework. SQLite is the storage model
(schema in `src/db/schema.ts`), backed by `@capacitor-community/sqlite` —
real on-device SQLite on Android, IndexedDB-backed `sql.js` (via
`jeep-sqlite`) when running as a plain web app. Reference tables
(species/forms/types/etc.) are wholesale-replaced from the bundled
`src/data/reference.json` on every load if its content changed; personal
tables (your catch/shiny/lucky/shadow data) are never touched by that sync
and carry their own schema-version + migration runner
(`src/db/migrations.ts`).

## Running it

```
npm install
npm run dev
```

Opens the app at `http://localhost:5173` (or whatever port Vite picks).

## Building the Android app

Requires the Android SDK/Gradle/JDK already installed locally. Gradle 8.x
needs a JDK ≤ 21 — if your default `java` is newer, point `JAVA_HOME` at a
JDK 21 (e.g. Android Studio's bundled JBR).

```
export JAVA_HOME=/opt/android-studio/jbr   # or wherever your JDK 21 lives
export ANDROID_HOME=$HOME/Android/Sdk
npm run android:sync    # vite build + capacitor sync into android/
npm run android:build   # android:sync + gradlew assembleDebug
```

The debug APK lands under `android/app/build/outputs/apk/debug/`.

## Cross-device data (phone ↔ desktop)

There's no sync — by design, per the no-network-calls constraint. Instead,
the Settings page has manual **Export** / **Import** buttons for personal
data (your catch/achievement state, not reference data):

- **Export** writes a JSON snapshot, stamped with the current personal
  schema version. On Android it's handed to the native share sheet (save to
  Drive, Files, email, etc. — the app never talks to any cloud service
  directly); on desktop it downloads via the browser.
- **Import** reads a previously-exported JSON file back in, overwriting any
  matching entries (anything not present in the file is left alone). If the
  file's schema version doesn't match the running app's, you'll get a
  warning before it proceeds.

The same file format works in both directions, so you can export from your
phone, edit on desktop (`npm run dev`), and import back.

## Reference data ingestion

The species/form/type reference data (`src/data/reference.json`) is built
from a combination of a Pokémon GO tracking spreadsheet (checked into the
repo root as CSVs), [PokeAPI](https://pokeapi.co), and Bulbapedia (for
costume data). See `scripts/ingest/` and `INGESTION_PROGRESS.md` for
details.

```
npm run ingest:fetch   # pull/cache PokeAPI data (rate-limited, resumable)
npm run ingest:build   # build src/data/reference.json from the cache + CSVs
npm run ingest:events  # parse event-sourced costume/Pokémon data
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
