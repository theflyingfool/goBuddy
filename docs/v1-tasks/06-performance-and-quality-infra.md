*Part of the [V1 Task Breakdown](README.md). Previous: [7. Image pipeline](05-image-pipeline.md). Next: [10. Documentation & release](07-documentation-and-release.md).*
*Roadmap context: [Theme 4 — Performance & first impressions](../v1-roadmap/04-performance-first-impressions.md), [Theme 7 — Quality infrastructure](../v1-roadmap/07-quality-infrastructure.md).*

## 8. Performance / first-impression fixes

*Most legibility-adjacent performance items already live in § 4 (bulk-edit
focus bug, select-mode jank, species-detail rebuild). This section is the
remaining first-boot/device-specific items.*

- [ ] Real-device install + first-boot timing test (the reference sync does
  ~8,156 sequential inserts on first run / on any reference-data-changing
  update — untested on real hardware). This is also § 11's release-candidate
  gate.
- [ ] **Contingency**: if the timing test shows the sync is slow enough to
  hurt the first-run experience, pull forward the `executeSet`-batching fix
  for `src/db/reference-sync.ts` (the SQLite plugin already supports this;
  see `docs/v1-roadmap/addendum.md` point 2). Otherwise, defer to V2 with the
  DB-split work.

---

## 9. Quality infrastructure

- [ ] Slug-stability check script: diff new `reference.json` slugs against
  the last committed version; fail if any slug vanished without a matching
  entry in `src/db/slug-renames.ts`. (Feeds § 1 and § 2's checks.)
- [ ] Migration fixture tests: a thin adapter running the real migration +
  sync code (`src/db/migrations.ts`, `src/db/reference-sync.ts`) against
  fixture databases via Node's built-in SQLite — reuse the prepared-statement
  pattern already proven in `scripts/build-dummy-db.ts`.
- [ ] Export/import round-trip unit tests (`src/data/in-memory-store.ts`).
- [ ] Committed Playwright smoke suite: boot, toggle+reload persistence,
  stats counts, export/import, settings — the scenarios already verified
  manually per `TODO.md`, made repeatable.
- [ ] CI workflow: `tsc -b --noEmit` + unit tests + the smoke suite on PR.
- [ ] Delete dead code: `src/data/dummy-repository.ts`,
  `src/data/personal-demo-seed.ts`, and the in-memory JS stats path
  (`computeLens` in `src/data/in-memory-store.ts`) — make stats SQL-only via
  `src/data/completion-stats-sql.ts`.
- [ ] Remove the `INTERNET` permission from `AndroidManifest.xml` (the app
  makes no runtime network calls; let the OS enforce it).
- [ ] Move the stray 38MB `GoBuddy.apk` out of the repo root.
- [ ] **D6**: pick one app name (PoGo Buddy vs GoBuddy) and align
  `appName`/export filenames/repo references.
