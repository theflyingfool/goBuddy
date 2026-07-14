# PoGo Buddy

## What this is

A local-only Android app (Capacitor-wrapped web app, sideloaded APK) for
tracking a Pokémon GO living dex — the first phase of a broader "Pokémon GO
companion app" I intend to grow over time (future phases: in-game achievement
tracking, leveling optimization, etc. — **explicitly out of scope for v1**,
mentioned only so the architecture isn't painted into a dex-only corner). Runs
fully offline: no backend, no accounts, no network calls at runtime. All
personal data stays on the device forever. **Don't call this a "dex app"** —
it's the dex-tracking phase of a companion app.

Design-awareness note (nothing to build now): not every future fact is
dex-derived — e.g. Pokémon GO has achievements like total trade distance
(10,000,000 km) unrelated to any species/form. When this grows beyond dex
tracking, that data won't fit the `species`/`form` tables and will need its own
independent tables. So don't design the personal/reference split assuming every
future fact is a per-species boolean.

## Platform

- Capacitor project targeting Android only (no iOS).
- Distributed as a sideloaded `.apk` — not the Play Store.
- Assume the Android SDK, Gradle, and JDK are already installed locally; do not
  scaffold Android Studio setup steps.
- Build and iterate via Capacitor's CLI / Gradle directly rather than assuming
  the Android Studio GUI is open.

## Storage — core invariants

Full schema DDL and rationale live in **[docs/data-model.md](docs/data-model.md)**;
the real schema is in `src/db/schema.ts` / `src/db/types.ts`. The non-negotiables:

- **SQLite on-device** via `capacitor-community/sqlite`. No IndexedDB / browser
  storage — this is a native-wrapped app.
- **Reference tables vs. personal tables** are kept separate so app updates can
  never destroy user data. Reference tables (species, forms, types, regions,
  backgrounds, mega variants) are wholesale-replaceable on every update and
  owned by the app. Personal tables (the user's achievement state) are written
  *only* by user interaction, never by an update.
- Every reference row has a **permanent, immutable slug** as its PK
  (`bulbasaur-standard-male`). Personal rows FK to reference rows by slug —
  stable slugs are what make reference replacement safe (never orphans data).
- Personal facts are **real boolean columns**, never JSON/list blobs. Combined
  milestones (e.g. "shundo" = shiny + hundo) are **stored independently, never
  computed** from other booleans — two true flags don't imply the *same*
  individual was both.
- Personal data has a **schema-version table + migration runner** so future
  personal-schema changes migrate on load without touching reference data.

## Versioning policy — two separate numbers, don't conflate them

(Full detail in [docs/data-model.md](docs/data-model.md).) Bumping the wrong one
— or neither — is the failure mode to avoid:

- **`CURRENT_PERSONAL_SCHEMA_VERSION`** (`src/db/schema.ts`) — the *structure* of
  the personal tables. Bump **by hand** and add a matching `{ version, up }`
  entry to `MIGRATIONS` (`src/db/migrations.ts`) whenever a personal-table column
  is added/removed/renamed or changes meaning. It's also stamped into Export
  files and checked on Import, so a stale bump lets a mismatched export import
  without warning.
- **`reference_data_version`** (`src/db/reference-sync.ts`) — the *contents* of
  `src/data/reference.json`. **Automatic** (content hash); editing reference data
  needs no manual bump.

## Working style

This project's schema and feature specs are reasoned proposals, not fixed specs.
If you notice something better modeled differently — a missing edge case, a
normalization that doesn't hold, a game mechanic a design gets wrong — **propose
the change and ask**, rather than silently deviating or silently complying. I'd
rather be asked than have you guess.

## Development workflow

- **Branches for new work.** Feature/fix work happens on a branch
  (`feature/<name>` or `fix/<name>`) off `master`, merged back via a PR
  (`gh pr create` / `gh pr merge`). Small doc-only/planning commits may still
  go straight to `master`, as they always have — the branch requirement is for
  actual code changes.
- **App-release version bump on merge.** This is a **third, separate**
  version concept from the two in "Versioning policy" above (those are
  internal DB-version numbers; this is the app's own release version) —
  don't conflate them. After merging a branch into `master`, run
  `npm run version:bump -- minor` (feature branches) or
  `npm run version:bump -- patch` (fix branches), review the diff, and commit
  it as its own "Bump version to X" commit. This updates `package.json`'s
  semver and `android/app/build.gradle`'s `versionName` together, and always
  increments `versionCode` by exactly 1 regardless of bump size (Android only
  requires `versionCode` to strictly increase between installs). See
  `scripts/bump-version.ts`'s header comment for the exact mechanics; pass
  `--dry-run` to preview without writing. As part of the same step, add a
  `CHANGELOG.md` entry for the new version and snapshot
  `docs/features/current.md` into `docs/features/history/vX.Y.Z.md` before
  updating `current.md` for the new release.
- **Linting.** `npm run lint` runs ESLint (`eslint.config.js`, TypeScript-aware,
  covers `src/` and `scripts/`). It also runs automatically as a pre-commit
  hook (`.githooks/pre-commit`, activated via `core.hooksPath` — wired up
  automatically by `npm install`'s `prepare` script, no extra dependency like
  husky). A failing lint blocks the commit; `git commit --no-verify` skips it
  if truly necessary. The baseline config is deliberately non-type-checked
  (`typescript-eslint`'s `recommended`, not `recommendedTypeChecked`) to keep
  the enforced bar clean today.

## Out of scope for v1

- No networking, sync, accounts, or multi-device support of any kind.
- No trade-matching feature — that's just two people opening the app side by
  side. Don't build anything for it.
- No iOS target.

## Docs

- **[docs/data-model.md](docs/data-model.md)** — storage design, full schema DDL,
  versioning policy detail, reference-data ingestion rationale, and deferred
  architecture decisions (build-time DB generation, DB file split, identity
  rework).
- **[docs/features.md](docs/features.md)** — hub linking to feature specs by
  release status: `docs/features/current.md`, `next.md`, `planned.md`,
  `history/`.
- **[docs/architecture.md](docs/architecture.md)** — codebase map: what each
  script/feature/module does, plus the cross-cutting patterns (write-queue,
  cascade, single-backend split, single-source-of-truth field lists).
- **[docs/ingestion-runbook.md](docs/ingestion-runbook.md)** — the correct
  order to run the reference-data ingestion scripts in, and known pitfalls.
- **[docs/install-guide.md](docs/install-guide.md)** — sideload/update
  instructions for friends running the app.
- **[docs/v1-roadmap/](docs/v1-roadmap/)** — the studio-review findings behind
  the current V1 push (why).
- **[docs/v1-tasks/](docs/v1-tasks/)** — the V1 task breakdown (what/order).
- **[README.md](README.md)** — running/building the app, ingestion commands.
- **[CHANGELOG.md](CHANGELOG.md)** — shipped-version history.
