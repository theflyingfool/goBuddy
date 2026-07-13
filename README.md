# PoGo Buddy

A local-only, fully offline Pokémon GO living-dex tracker. No accounts, no
back-end, no network calls at runtime — all personal data stays on the
device. Ships as a Capacitor-wrapped Android APK (side-loaded, not Play
Store); the same TypeScript/Vite web app also runs standalone in a desktop
browser for editing on a computer (see "Cross-device data" below).

See [docs/data-model.md](./docs/data-model.md) (schema/storage),
[docs/features.md](./docs/features.md) (feature specs, by release status),
and [docs/architecture.md](./docs/architecture.md) (codebase map) for the
full design; [CLAUDE.md](./CLAUDE.md) for the working invariants; and
[CHANGELOG.md](./CHANGELOG.md) for shipped-version history (see
[docs/v1-tasks/](./docs/v1-tasks/) for current in-progress status).

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

## Prerequisites

- Node.js — Vite 6 requires `^18.19.0` or `>=20.0.0`.
- Nothing else to install for the desktop web app; native builds have their
  own prerequisites (see "Building the Android app" below).

## Running it

```sh
git clone <this repo>
cd GoBuddy
npm install
npm run dev
```

Opens the app at `http://localhost:5173` (or whatever port Vite picks). All
data is stored locally (IndexedDB via `sql.js`/`jeep-sqlite` in this mode) —
nothing leaves the browser.

## Features

- **Pokédex grid** — every species/form, with tri-state (off/include/exclude)
  filters across region, rarity, gender, Dynamax/Gigantamax/Mega capability,
  and any personal achievement flags you pin as grid badges (Settings →
  "Grid badges").
- **Species detail / data entry** — fast toggle-based entry per form for
  catches, shiny, lucky, shadow, Dynamax (and their floor/4★/shundo
  variants). Toggle groups that don't apply to a given form (e.g. Shadow on
  a species that's never been made Shadow-available) are hidden rather than
  shown as dead options.
- **Stats page** — completion percentage by region or species, across
  multiple lenses (registered, form-complete, costume-complete, or any
  boolean achievement column) with a drill-down list of what's missing.
- **Settings** — grid badge selection, gender-form display collapsing, and
  cross-device Export/Import (see below).
- **Coverage report** (dev tool) — a view of which species are missing key
  reference fields (types, region, availability flags), since the bundled
  dataset is filled in incrementally.

Not yet built (see [docs/features/planned.md](./docs/features/planned.md)):
the tri-state search-string builder and the auto-declutter engine.

## Building the Android app

Requires the Android SDK/Gradle/JDK already installed locally. Gradle 8.x
needs a JDK ≤ 21 — if your default `java` is newer, point `JAVA_HOME` at a
JDK 21 (e.g. Android Studio's bundled JBR).

```sh
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
costume data), via scripts under `scripts/ingest/`. For the correct order to
run them in and known pitfalls, see
[docs/ingestion-runbook.md](docs/ingestion-runbook.md); for what each script
does, see [docs/architecture.md](docs/architecture.md).

## Inspecting the schema directly

```sh
npm run build:dummy-db
```

Writes `dummy.sqlite` at the repo root (gitignored, regeneratable) — open
it in DB Browser for SQLite, `sqlite3`, or any SQLite client to browse the
schema and real ingested data directly.
