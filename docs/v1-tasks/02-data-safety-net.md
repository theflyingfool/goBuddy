*Part of the [V1 Task Breakdown](README.md). Previous: [1. Reference-data correction](01-reference-data-correction.md). Next: [3–4. Visual identity & legibility](03-visual-and-legibility.md).*
*Roadmap context: [Theme 1 — Data safety](../v1-roadmap/01-data-safety.md).*

## 2. Data-safety net

*The app's entire value is one SQLite file on a phone — these close the ways
that file (or a friend's trust in it) can currently be lost.*

- [ ] **D4**: decide keystore backup location, then generate a dedicated
  release keystore, add `signingConfigs.release` to `android/app/build.gradle`,
  switch the build to `assembleRelease`. Back it up in ≥2 places.
- [ ] Boot-failure rescue screen: on any DB-open/sync/migration error
  (`src/main.ts`'s "Couldn't open the on-device database" path), still offer a
  raw "export personal data" action that reads the personal tables directly,
  bypassing the failed boot path.
- [ ] Reference-sync orphan quarantine: in `src/db/reference-sync.ts`, detect
  personal rows whose slug no longer resolves after reference tables are
  recreated, and move them to a quarantine table instead of letting the
  transaction commit fail.
- [x] Ingestion-time slug-disappearance check — pairs with
  [§ 9](06-performance-and-quality-infra.md)'s slug-stability script; fail
  the build if a slug vanishes without a rename-registry entry. Done as
  `scripts/ingest/check-slug-stability.ts` (`npm run ingest:check-slugs`),
  which also satisfies §9's bullet below — see
  `docs/ingestion-runbook.md`.
- [ ] Write-failure banner: surface `src/data/sqlite-repository.ts`'s
  swallowed write errors (~line 96-98) as a persistent in-app banner with
  retry, instead of `console.error`-only.
- [ ] Import: report the count of skipped/unknown-slug rows instead of
  silently dropping them (`src/data/in-memory-store.ts`'s import path).
- [ ] Pre-import auto-snapshot: call the existing `exportPersonalData()`
  before applying any import, in `src/features/settings/settings-page.ts`.
- [ ] Call `navigator.storage.persist()` on the web platform path
  (`src/db/sqlite-client.ts`).
- [ ] Rotating Android auto-export: once-daily, keep last 3, via the
  already-integrated `@capacitor/filesystem` plugin.
- [ ] Migration-runner hardening: wrap each migration in a transaction
  (`src/db/migrations.ts`), refuse to boot if the stored schema version is
  newer than the app's (downgrade guard).
- [ ] **D5**: decide and document the `android:allowBackup` stance
  (`android/app/src/main/AndroidManifest.xml`); test restore once if keeping
  it on.
