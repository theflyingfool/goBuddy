*Part of the [V1 Task Breakdown](README.md). Previous: [1. Reference-data correction](01-reference-data-correction.md). Next: [3–4. Visual identity & legibility](03-visual-and-legibility.md).*
*Roadmap context: [Theme 1 — Data safety](../v1-roadmap/01-data-safety.md).*

## 2. Data-safety net

*The app's entire value is one SQLite file on a phone — these close the ways
that file (or a friend's trust in it) can currently be lost.*

- [ ] **D4**: decide keystore backup location, then generate a dedicated
  release keystore, add `signingConfigs.release` to `android/app/build.gradle`,
  switch the build to `assembleRelease`. Back it up in ≥2 places.
- [x] Boot-failure rescue screen: on any DB-open/sync/migration error
  (`src/main.ts`'s "Couldn't open the on-device database" path), still offer a
  raw "export personal data" action that reads the personal tables directly,
  bypassing the failed boot path. Split into `src/data/boot-rescue-read.ts`
  (pure, no jeep-sqlite dependency — table-by-table best-effort read, so one
  unreadable table doesn't sink the whole rescue) and
  `src/data/boot-rescue.ts` (wraps it with the real `getDb()`, returning
  `null` only if the connection itself won't open) +
  `src/app-shell/boot-failure-rescue.ts` (the UI). Reads the DB's actual
  stored `schema_version` rather than assuming `CURRENT_PERSONAL_SCHEMA_VERSION`,
  since a partial/failed migration is exactly the scenario this exists for.
  Reuses the existing `PersonalDataExport` shape/Settings import path rather
  than inventing a new format. Verified with a `node:sqlite` fixture across
  4 scenarios: normal populated DB, missing `schema_version` table, missing
  `form_personal` table entirely, and a completely empty (no tables) DB —
  all recovered whatever was readable without throwing.
- [x] Reference-sync orphan quarantine: in `src/db/reference-sync.ts`, detect
  personal rows whose slug no longer resolves after reference tables are
  recreated, and move them to a quarantine table instead of letting the
  transaction commit fail. New `personal_data_quarantine` table (personal
  schema version bumped 1→2, added via the hardened migration runner above)
  holds each orphaned row's full data as JSON. Verified with a `node:sqlite`
  fixture: confirmed the failure is real (an unquarantined
  orphan genuinely throws `FOREIGN KEY constraint failed` and rolls back
  the whole sync) and that the fix resolves it (sync commits, orphan is
  gone from its table and present in quarantine with the right payload).
- [x] Ingestion-time slug-disappearance check — pairs with
  [§ 9](06-performance-and-quality-infra.md)'s slug-stability script; fail
  the build if a slug vanishes without a rename-registry entry. Done as
  `scripts/ingest/check-slug-stability.ts` (`npm run ingest:check-slugs`),
  which also satisfies §9's bullet below — see
  `docs/ingestion-runbook.md`.
- [x] Write-failure banner: surface `src/data/sqlite-repository.ts`'s
  swallowed write errors (~line 96-98) as a persistent in-app banner with
  retry, instead of `console.error`-only. Done via a new
  `src/app-shell/write-failure-banner.ts` (kept UI-agnostic on the data-layer
  side: `createSqliteRepository` takes an optional `onWriteFailure(message,
  retry)` hook, wired up in `main.ts`).
- [x] Import: report the count of skipped/unknown-slug rows instead of
  silently dropping them (`src/data/in-memory-store.ts`'s import path).
  `Repository.importPersonalData` now returns `{ skippedSpeciesSlugs,
  skippedFormSlugs }`; Settings surfaces a count in the status message
  instead of reloading immediately. Verified with a standalone Node script
  exercising `createInMemoryRepository` directly (no test harness exists
  yet — §9 still owes that).
- [x] Pre-import auto-snapshot: call the existing `exportPersonalData()`
  before applying any import, in `src/features/settings/settings-page.ts`.
  If the user cancels the snapshot's save dialog, they're asked to confirm
  proceeding without one rather than silently skipping it.
- [ ] Call `navigator.storage.persist()` on the web platform path
  (`src/db/sqlite-client.ts`).
- [ ] Rotating Android auto-export: once-daily, keep last 3, via the
  already-integrated `@capacitor/filesystem` plugin.
- [x] Migration-runner hardening: wrap each migration in a transaction
  (`src/db/migrations.ts`), refuse to boot if the stored schema version is
  newer than the app's (downgrade guard). Verified with a `node:sqlite`
  fixture harness (fresh boot, downgrade-guard throw, and transaction
  rollback semantics) — not committed as a real test (§9 owes that), but
  actually exercised rather than reasoned-through only. Done first, ahead
  of the orphan-quarantine item below, since quarantine needs its own
  personal-schema-version bump to run through this hardened path.
- [x] **D5 resolved** (owner decision, 2026-07-09): keep `android:allowBackup="true"`
  (already the value in `AndroidManifest.xml` — the Capacitor template
  default, never explicitly changed, so no code change needed here). Owner's
  reasoning: this is a free OS-level safety net (goes through the user's own
  Google account/Drive quota) layered on top of the app's own manual
  export/import — not a self-hosted backend the project would have to pay
  for or maintain. **Still open**: actually test a real uninstall/reinstall
  restore once on a device before relying on it (only doable on real
  hardware).
