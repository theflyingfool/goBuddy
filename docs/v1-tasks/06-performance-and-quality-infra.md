*Part of the [V1 Task Breakdown](README.md). Previous: [7. Image pipeline](05-image-pipeline.md). Next: [10. Documentation & release](07-documentation-and-release.md).*
*Roadmap context: [Theme 4 — Performance & first impressions](../v1-roadmap/04-performance-first-impressions.md), [Theme 7 — Quality infrastructure](../v1-roadmap/07-quality-infrastructure.md).*

## 8. Performance / first-impression fixes

*Most legibility-adjacent performance items already live in
[§ 4](03-visual-and-legibility.md) (bulk-edit focus bug, select-mode jank,
species-detail rebuild). This section is the remaining
first-boot/device-specific items.*

- [x] Real-device install + first-boot timing test (the reference sync does
  ~8,156 sequential inserts on first run / on any reference-data-changing
  update). This is also [§ 11](08-release-candidate.md)'s release-candidate
  gate. **Owner's timed measurement (2026-07-12, debug APK, v0.12.0):
  fine for now.** Supersedes the earlier vibe-check ("didn't seem too bad,
  but probably only going to get worse") with an actual timed result — the
  contingency below is confirmed *not* triggered.
- [x] **Contingency resolved: not pulled forward.** Owner (2026-07-12):
  running the `executeSet`-batching fix for `src/db/reference-sync.ts` late
  is "optimization" work, fine to leave for V2 alongside the DB-split work
  rather than a V1 blocker. Revisit only if a future timing check regresses.

---

## 9. Quality infrastructure

- [x] Slug-stability check script: diff new `reference.json` slugs against
  the last committed version; fail if any slug vanished without a matching
  entry in `src/db/slug-renames.ts`. (Feeds
  [§ 1](01-reference-data-correction.md) and
  [§ 2](02-data-safety-net.md)'s checks.) Done as
  `scripts/ingest/check-slug-stability.ts` (`npm run ingest:check-slugs`),
  pulled forward from here into the §2 pass.
- [x] Migration fixture tests: `test/node-sqlite-connection.ts` is a thin
  adapter exposing just the `SQLiteDBConnection` surface
  `src/db/migrations.ts`/`src/db/reference-sync.ts` actually call
  (query/execute/run/begin·commit·rollbackTransaction), backed by Node's
  built-in `node:sqlite` `DatabaseSync` instead of the real Capacitor plugin —
  reuses the prepared-statement style from `scripts/build-dummy-db.ts`.
  `test/migrations.test.ts` covers a fresh install (every table created,
  stamped at `CURRENT_PERSONAL_SCHEMA_VERSION`), replaying a pending
  migration for a device stamped at an older version, a no-op replay at the
  current version, and the newer-than-known-version downgrade guard.
  `test/reference-sync.test.ts` covers a from-scratch populate, a same-content
  no-op (personal data untouched), and orphaned personal-row quarantining
  when a species/form disappears from a new `reference.json`. Run via
  `npm run test` (Node's built-in test runner through `tsx --test`, no new
  runtime dependency); `test/` added to `tsconfig.json`'s `include` so it's
  also covered by typechecking.
- [x] Export/import round-trip unit tests: `test/export-import-round-trip.test.ts`
  — round-trips species/form/app-setting personal data through
  `createInMemoryRepository`'s `exportPersonalData`/`importPersonalData`
  (including the xxl→registered cascade surviving the trip), confirms
  unresolvable slugs are skipped and counted rather than written, and confirms
  import never overwrites `reference_data_version` from another device's export.
- [x] Committed Playwright smoke suite: boot, toggle+reload persistence,
  stats counts, export/import, settings — the scenarios already verified
  manually per `TODO.md`, made repeatable. Done as `e2e/*.spec.ts`
  (`@playwright/test`, Chromium only — this is an Android-only app, "web" is
  just a dev convenience, so no cross-browser matrix), run via
  `npm run test:e2e` against the real `npm run dev` Vite server and its real
  IndexedDB-backed SQLite (jeep-sqlite + sql.js) — no mock backend involved.
- [x] CI workflow: `.github/workflows/ci.yml` — lint + `tsc -b --force`
  (typecheck) + `npm run test` + the Playwright smoke suite (`npm run
  test:e2e`, after `npx playwright install --with-deps chromium`) on every PR
  and push to `master`.
- [x] Delete dead code: `src/data/dummy-repository.ts` deleted (confirmed
  unreferenced — `main.ts` only ever imports `createSqliteRepository`) along
  with the in-memory JS stats path (`computeLens` + the default
  `getCompletionStats` in `src/data/in-memory-store.ts`, now `Omit<Repository,
  "getCompletionStats">` — `sqlite-repository.ts`'s SQL override is the only
  implementation left). **Kept** `src/data/personal-demo-seed.ts`: turned out
  to still be a real, separate dependency of `scripts/build-dummy-db.ts` (the
  `dummy.sqlite` fixture generator for manual DB inspection), not just
  dummy-repository.ts's seed data — updated its header comment and
  `docs/architecture.md` to describe that as the real remaining consumer.
- [x] Removed the `INTERNET` permission from `AndroidManifest.xml`.
- [x] Stray `GoBuddy.apk` — already gone (not present at repo root, not
  tracked in git anywhere); nothing left to do here.
- [ ] **D6**: pick one app name (PoGo Buddy vs GoBuddy) and align
  `appName`/export filenames/repo references.
