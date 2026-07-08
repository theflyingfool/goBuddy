*Part of the [V1 Roadmap](README.md). Previous: [Theme 6 — Desktop story](06-desktop-story.md). Next: [Theme 8 — Documentation](08-documentation.md).*

## Theme 7 — Quality infrastructure (proportionate to a friends-audience app)

Current state: zero committed tests, no lint, no CI (automated checks that run
on every change) — all the careful Playwright verification in TODO.md was
ad-hoc and unrepeatable.

Priorities (Platform's proposal, Architecture concurring):

- **P0 — protect the data paths**: a thin adapter running the real migration +
  sync code against Node's built-in SQLite, with fixture databases: v1-DB +
  seeded personal data → migrate + sync → assert nothing orphaned. Include the
  removed-slug regression case. Export → import → deep-equal round-trip tests.
  Plus an on-device rehearsal recipe: pull the owner's real DB via `adb`
  (debug builds allow it), test every future upgrade against a copy first.
- **P1 — a committed Playwright smoke suite** (~6 scenarios already proven
  valuable manually: boot, toggle+reload persistence, stats counts,
  export/import, settings) and a CI workflow running typecheck + unit + smoke.
  Its most important job: **guarding the `sql.js` 1.11.0 pin** — the known
  boot-hang failure is exactly what a CI boot test catches, and `jeep-sqlite`
  is caret-ranged so an `npm update` can silently move its half of that ABI
  pair.
- **A slug-stability check** in the ingestion pipeline: diff new
  `reference.json` slugs against the last committed version; fail if any slug
  vanished without a rename-registry entry. This mechanizes the discipline the
  whole data-safety story depends on. (Architecture, Platform, Docs — three
  independent flags)
- **Deletions that pay rent** (Architecture): the dummy localStorage backend
  and demo seed are dead code, and the in-memory JS *stats* implementation
  exists only to serve them — deleting all three makes stats SQL-only and
  eliminates the hand-synced JS/SQL duplication rather than managing it. The
  future declutter engine then follows the same SQL-only pattern.
- Repo hygiene: **`docs/` is untracked** while committed files link to it — a
  fresh clone 404s its own architecture docs (three reviewers flagged this);
  remove the `INTERNET` permission from the Android manifest (a "no network
  ever" app should let the OS enforce it — cheap trust win); pick one name
  (PoGo Buddy vs GoBuddy vs `gobuddy-export-*.json`); move the stray 38MB APK
  out of the repo root.
