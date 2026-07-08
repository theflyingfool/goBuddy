# Changelog

All notable shipped-version changes to this project. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/). This is the canonical home
for shipped-version history going forward — see `TODO.md` for current
in-progress status/known issues, not past releases.

Each entry corresponds to a `package.json`/`android/app/build.gradle`
version bump (see CLAUDE.md's "App-release version bump on merge").

## [0.10.0] — 2026-07-08

- Added branch/versioning development workflow, ESLint, and a pre-commit
  lint hook (`.githooks/pre-commit`).
- Split `CLAUDE.md` into working invariants + `docs/`; added the V1 planning
  roadmap and task breakdown.
- Fixed a DB-open crash on reference re-sync when personal data exists.

## [0.9.0] — 2026-07-01

- Modeled Gigantamax as distinct catchable form rows (not a separate
  personal-data field).
- Made Coverage Report actionable via a CSV export/template/import
  round-trip, with auto-refreshing gap counts.
- Added bulk-edit UI: grid select-mode + form-level quick-entry.
- Added forward-only cascading checkbox updates (checking a combined
  achievement like Shundo auto-checks its components).
- Manual cross-device export/import, toggle-availability gating, and
  versioning docs.
- Fleshed out README with prerequisites, clone step, and a features overview.

## [0.0.1] — 2026-07-01

- Initial milestones: dummy-backend-first pivot, completion-stats tracking
  (Stats page), native Android scaffolding (Milestone D), Coverage Report
  fixes, real app icon, grid Dynamax filter fix.
