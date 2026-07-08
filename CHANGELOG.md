# Changelog

All notable shipped-version changes to this project. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/). This is the canonical home
for shipped-version history going forward — see `TODO.md` for current
in-progress status/known issues, not past releases.

Each entry corresponds to a `package.json`/`android/app/build.gradle`
version bump (see CLAUDE.md's "App-release version bump on merge"), and
covers the commits between that bump and the previous one.

## [0.10.0] — 2026-07-08

- Modeled Gigantamax as distinct catchable form rows (not a separate
  personal-data field).
- Made Coverage Report actionable via a CSV export/template/import
  round-trip, with auto-refreshing gap counts.
- Added bulk-edit UI: grid select-mode + form-level quick-entry.
- Added forward-only cascading checkbox updates (checking a combined
  achievement like Shundo auto-checks its components).
- Fixed a DB-open crash on reference re-sync when personal data exists.
- Reorganized `TODO.md` so actionable work sits at the top.
- Added branch/versioning development workflow, ESLint, and a pre-commit
  lint hook (`.githooks/pre-commit`).
- Split `CLAUDE.md` into working invariants + `docs/`; added the V1 planning
  roadmap and task breakdown.
- Fleshed out README with prerequisites, clone step, and a features overview.
- Added CI workflows (Claude Code Review, Claude PR Assistant).

## [0.9.0] — 2026-07-01

- Completion-stats tracking (Stats page).
- Native Android scaffolding; fixed a stale Coverage Report.
- Fixed the grid Dynamax filter bug, improved data quality, added a real
  app icon.
- Manual cross-device export/import, toggle-availability gating, and
  versioning docs.

## [0.0.1] — 2026-07-01

- Initial dex-tracking foundation with real ingested reference data.
- Fixed Unown's spurious Standard form; ingested Bulbapedia costume data;
  reworked the forms UI.
- Grid tri-state filters + real SQLite persistence.
