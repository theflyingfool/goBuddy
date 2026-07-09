# Changelog

All notable shipped-version changes to this project. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/). This is the canonical home
for shipped-version history going forward — see `TODO.md` for current
in-progress status/known issues, not past releases.

Each entry corresponds to a `package.json`/`android/app/build.gradle`
version bump (see CLAUDE.md's "App-release version bump on merge"), and
covers the commits between that bump and the previous one.

## [0.11.0] — 2026-07-09

- Applied a full visual design system ("Night Studio": dark-first ink-blue/
  teal palette, soft radii, hairline borders, monospace reserved for numeric
  data) across the app shell, species grid/detail, stats, and Settings —
  replacing the previous browser-default styling. Added a manual
  System/Light/Dark theme override, and widened the app's layout above a
  720px viewport so tablet/desktop use more of the screen.
- Reference-data correction pass: fixed Necrozma fusion names, gen-9 slug/
  name typos, phantom "Standard" form rows (with a shiny-flag migration to
  the real default form), added the six missing mega-variant rows (incl.
  Mega Mewtwo X/Y) and Crowned Sword/Shield Zacian/Zamazenta. Found and
  fixed further data-quality bugs via a systematic scan: a duplicate
  Armored Mewtwo (modeled both as a Forme and a costume), Grimer/Muk/
  Slowking region mislabels, a bogus Persian regional form, and a Tauros
  breed-name mismatch that was silently defaulting three forms to the wrong
  type.
- Data-safety net: boot-failure rescue export, reference-sync orphan
  quarantine, hardened migration runner (per-migration transactions +
  downgrade guard), a persistent write-failure banner, import skip
  reporting, pre-import auto-snapshot, and an ingestion-time slug-stability
  check.
- Reorganized `docs/` into a navigable, cross-linked structure; retired
  `TODO.md` in favor of the versioned `docs/v1-tasks/`/`CHANGELOG.md` split.

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
