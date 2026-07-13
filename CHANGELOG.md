# Changelog

All notable shipped-version changes to this project. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/). This is the canonical home
for shipped-version history going forward — see `docs/v1-tasks/` for current
in-progress status/known issues, not past releases.

Each entry corresponds to a `package.json`/`android/app/build.gradle`
version bump (see CLAUDE.md's "App-release version bump on merge"), and
covers the commits between that bump and the previous one.

## [0.13.0] — 2026-07-13

- Minimal keyword search: type `costume`, `legendary`, `mythical`, or
  `ultrabeast` alone into any search box (Dex grid, Bulk Edit,
  species-detail's own form filter) to filter by it instead of a plain
  name/dex match — prefix with `!` to negate (e.g. `!costume`). Bulk Edit
  additionally filters costume/non-costume at the individual form-tile
  level, not just which species show up. Documented on the Help page.
  Deliberately not the full AND-of-OR search-string builder specced for
  post-V1 — just enough to answer "show me only X" in the box that's
  already there.
- Audited search across the app while building the above; found and fixed
  a regression in the new feature itself before shipping (a `!`-prefixed
  query that isn't a recognized keyword, e.g. `!raichu`, used to silently
  match nothing instead of falling back to a plain search). Other gaps
  found (dex-number substring noise, curly-apostrophe name mismatches,
  keyword-vs-chip duplication) are reported in `docs/v1-tasks/03-visual-
  and-legibility.md`, not yet fixed.

## [0.12.3] — 2026-07-13

- **Fixed a second real import crash**: `CommitTransaction: Cannot perform
  this operation because there is no current transaction`, firing on
  effectively every import (any real export includes app settings).
  `onAppSettingChanged` was the one write hook in `sqlite-repository.ts`
  that never adopted the `inBulk` transaction-guard convention the other
  four hooks use, so writing an app setting mid-import closed the outer
  transaction early. Fixed to mirror the existing pattern.

## [0.12.2] — 2026-07-12

- **Fixed a real-device crash**: importing personal data could throw
  "Couldn't open the on-device database" right after a successful import.
  Root cause: a `window.location.reload()` after import raced
  `capacitor-community/sqlite`'s native connection registry, which survives
  a WebView reload — the fresh boot found the connection already marked
  open and calling `.open()` on it again failed. Removed the reload
  (unnecessary — the in-memory cache every screen reads from was already
  updated) and hardened `getDb()` to skip re-opening an already-open
  connection, covering other reload-shaped scenarios too.
- Backup-before-import is now a persistent Settings toggle ("Back up
  before import," default off) instead of a confirmation dialog asked on
  every import.

## [0.12.1] — 2026-07-12

- Visual polish from the first real on-device pass: species-detail header
  splits into an identity box (sprite/name/nav) and a new Region + Type(s)
  box, form-tile and hero sprites sized up to actually show the real art
  from the image pipeline, desktop now uses the full screen width instead
  of a capped column, Settings' "Grid badges" fieldset is collapsible and
  starts collapsed, and the About section now shows the personal-data
  schema version and reference-data hash alongside the app version.
- Adds `Repository.getFormTypes()`, backed by reference data already
  resident in memory — no new DB round-trip.

## [0.12.0] — 2026-07-12

- Mega Evolution + Gigantamax/form-complete semantics: species-wide Mega
  tracking (Evolved/Shiny Evolved per variant, X/Y/Primal support), Mega
  and Gigantamax stats lenses, and a form-complete denominator fix
  (Gigantamax/regional-exclusive forms handled correctly rather than
  inflating the "missing" count).
- Mobile ergonomics redesign: bottom tab bar / persistent sidebar nav
  (replacing the hamburger drawer at every width), filters moved into a
  callable bottom sheet / anchored panel instead of always-visible chips,
  and quick-toggle tiles on the dex grid.
- Data-entry legibility/accessibility polish pass, and a Stats page
  rebuild (PowerBI-style dashboard with a drillable missing-species grid),
  plus a real performance fix (missing SQL index on `form.species_slug`
  that was making the Stats page slow).
- Image pipeline (§7): swapped the entire species sprite set for
  PokeMiners-sourced art (953 species, up from 809), auto-matched ~230
  regional-form and costume sprites plus all 57 Mega/Primal variants, and
  added a shiny-art view toggle. Along the way, fixed a real
  `build-reference.ts` bug where Pokémon GO-exclusive Mega Evolutions
  (Dragonite, Skarmory, Raichu, Malamar, Victreebel, Falinks) were being
  silently rejected by a mainline-game-only version filter, and fixed a
  single mislabeled spreadsheet row that had made Espurr (#677) invisible
  to the entire reference-data pipeline.
- Dead-code cleanup (removed the unused localStorage dummy-repository
  backend and its in-memory completion-stats path now that real SQL
  covers it), a real unit-test suite (migrations, reference-sync,
  export/import round-trip), and a CI workflow (lint + typecheck + tests
  on every push) plus an on-demand GitHub Actions APK build.
- New in-app Help page (badge-glyph legend, stats-lens definitions,
  Floor/Shundo glossary, filter-chip explanation), the app version now
  shown in Settings, and backup guidance text next to the Export button.
- Personal-data import is now a real restore instead of a merge — it
  wipes the existing collection before applying an imported file's rows,
  so data that only exists locally (and isn't in the file being imported)
  no longer silently survives underneath it. The pre-import safety backup
  is now an explicit opt-in prompt instead of a forced dialog on every
  import.

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
