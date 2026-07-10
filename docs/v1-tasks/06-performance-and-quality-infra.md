*Part of the [V1 Task Breakdown](README.md). Previous: [7. Image pipeline](05-image-pipeline.md). Next: [10. Documentation & release](07-documentation-and-release.md).*
*Roadmap context: [Theme 4 — Performance & first impressions](../v1-roadmap/04-performance-first-impressions.md), [Theme 7 — Quality infrastructure](../v1-roadmap/07-quality-infrastructure.md).*

## 8. Performance / first-impression fixes

*Most legibility-adjacent performance items already live in
[§ 4](03-visual-and-legibility.md) (bulk-edit focus bug, select-mode jank,
species-detail rebuild). This section is the remaining
first-boot/device-specific items.*

- [ ] Real-device install + first-boot timing test (the reference sync does
  ~8,156 sequential inserts on first run / on any reference-data-changing
  update — untested on real hardware). This is also
  [§ 11](08-release-candidate.md)'s release-candidate gate.
- [ ] **Contingency**: if the timing test shows the sync is slow enough to
  hurt the first-run experience, pull forward the `executeSet`-batching fix
  for `src/db/reference-sync.ts` (the SQLite plugin already supports this;
  see `docs/v1-roadmap/addendum.md` point 2). Otherwise, defer to V2 with the
  DB-split work.

---

## 9. Quality infrastructure

- [x] Slug-stability check script: diff new `reference.json` slugs against
  the last committed version; fail if any slug vanished without a matching
  entry in `src/db/slug-renames.ts`. (Feeds
  [§ 1](01-reference-data-correction.md) and
  [§ 2](02-data-safety-net.md)'s checks.) Done as
  `scripts/ingest/check-slug-stability.ts` (`npm run ingest:check-slugs`),
  pulled forward from here into the §2 pass.
- [ ] Migration fixture tests: a thin adapter running the real migration +
  sync code (`src/db/migrations.ts`, `src/db/reference-sync.ts`) against
  fixture databases via Node's built-in SQLite — reuse the prepared-statement
  pattern already proven in `scripts/build-dummy-db.ts`.
- [ ] Export/import round-trip unit tests (`src/data/in-memory-store.ts`).
- [ ] Committed Playwright smoke suite: boot, toggle+reload persistence,
  stats counts, export/import, settings — the scenarios already verified
  manually per `TODO.md`, made repeatable.
- [ ] CI workflow: `tsc -b --noEmit` + unit tests + the smoke suite on PR.
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
