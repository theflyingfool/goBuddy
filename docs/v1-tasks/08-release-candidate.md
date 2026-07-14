*Part of the [V1 Task Breakdown](README.md). Previous: [10. Documentation & release](07-documentation-and-release.md). Next: [12. V2 watchlist](09-v2-watchlist.md).*
*Roadmap context: [Theme 6 — Desktop story](../v1-roadmap/06-desktop-story.md).*

## 11. Release candidate

- [x] The export on file import needs to be optional not forced. Was an
  unconditional `exportPersonalData()` call before every import (forcing
  the save dialog open every time); now a `window.confirm("Back up your
  current data first, before it's replaced? (Recommended)")` gate in
  `src/features/settings/settings-page.ts` — a "no" skips straight to
  import with no dialog at all.
- [x] An Import should clear the user db before importing as well — was a
  merge (only rows present in the file got written; anything caught
  locally but absent from the file silently survived underneath it).
  `in-memory-store.ts`'s `importPersonalData` now wipes
  `speciesPersonal`/`formPersonal`/`megaPersonal`/`formBackgroundPersonal`
  before applying the file's rows (new `onPersonalDataCleared` hook);
  `sqlite-repository.ts` implements that as real `DELETE FROM` statements
  on all four personal tables, wrapped in the same transaction as the
  re-populate (via the existing `runBulk` helper) so a failure partway
  through can't leave the DB cleared but not restored. App
  settings/preferences are a separate table and deliberately untouched —
  only the collection data is a "restore," not a factory reset. Covered by
  a new unit test (`test/export-import-round-trip.test.ts`) that sets
  local-only data, imports a file that doesn't mention it, and confirms
  it's gone afterward. No in-app "clear" button was added since import now
  covers that need (import an intentionally-empty/minimal export to wipe).
- [x] Real-device install + first-boot timing — confirmed fine (owner,
  2026-07-12). See [§ 8](06-performance-and-quality-infra.md).
- [x] Upgrade-over-install test: v1 APK + real data → v2 APK, confirm data
  survives and no boot-brick. **Satisfied by ongoing practice** — the owner
  has been installing fresh debug APKs onto their phone regularly across
  every version from 0.9.0 through 0.13.3, always over real on-device data,
  with no data loss or boot-brick observed.
- [x] Confirm the [§ 9](06-performance-and-quality-infra.md) smoke suite +
  CI are green.
- [ ] Tag `v1.0.0`.
- [ ] Distribute with the install/update one-pager
  ([§ 10](07-documentation-and-release.md)).
