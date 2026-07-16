# PoGo Buddy V1.0.0 Pre-Launch Verification Checklist

This checklist outlines the critical components, documentation links, files, and build pipelines that must be verified prior to launching **PoGo Buddy Version 1.0.0**. (App name confirmed by the owner as "PoGo Buddy" — see `docs/roadmap.md`'s former D6 decision item.)

---

## 1. Documentation Integrity & Link Verification

During the documentation refactoring, many files (e.g., `docs/v1-roadmap/`, `docs/v1-tasks/`, and `docs/features/` subdirectories) were consolidated or deleted. We must clean up residual references to prevent broken links:

### ⚠️ Stale References to Deleted Files in Code & Build Files
- **[eslint.config.js](file:///home/nick/Repos/GoBuddy/eslint.config.js#L81)**:
  Line 81 references `docs/v1-tasks/**`.
- **[test/node-sqlite-connection.ts](file:///home/nick/Repos/GoBuddy/test/node-sqlite-connection.ts#L7)**:
  Line 7 references `docs/v1-tasks/06-performance-and-quality-infra.md`.
- **[scripts/ingest/check-slug-stability.ts](file:///home/nick/Repos/GoBuddy/scripts/ingest/check-slug-stability.ts#L5)**:
  Line 5 references `docs/v1-tasks/01-reference-data-correction.md`.
  Line 12 references `docs/v1-tasks/09-v2-watchlist.md`.
- **[scripts/ingest/build-sprite-mapping.ts](file:///home/nick/Repos/GoBuddy/scripts/ingest/build-sprite-mapping.ts#L1)**:
  Line 1 references `docs/v1-tasks/05-image-pipeline.md`.
- **[scripts/ingest/build-reference.ts](file:///home/nick/Repos/GoBuddy/scripts/ingest/build-reference.ts#L257)**:
  Line 257 references `docs/v1-roadmap/02-reference-data-corrections.md`.
- **[src/app-shell/boot-failure-rescue.ts](file:///home/nick/Repos/GoBuddy/src/app-shell/boot-failure-rescue.ts#L5)**:
  Line 5 references `docs/v1-tasks/02-data-safety-net.md`.
- **[src/ui/sprites.ts](file:///home/nick/Repos/GoBuddy/src/ui/sprites.ts#L3)**:
  Line 3 references `docs/v1-tasks/05-image-pipeline.md`.
- **[src/features/settings/settings-page.ts](file:///home/nick/Repos/GoBuddy/src/features/settings/settings-page.ts#L11)**:
  Line 11 references `docs/v1-tasks/02-data-safety-net.md`.
  Line 67 references `docs/v1-tasks/04-mega-and-gigantamax.md`.
- **[src/data/boot-rescue-read.ts](file:///home/nick/Repos/GoBuddy/src/data/boot-rescue-read.ts#L25)**:
  Line 25 references `docs/v1-tasks/04-mega-and-gigantamax.md`.
- **[src/data/in-memory-store.ts](file:///home/nick/Repos/GoBuddy/src/data/in-memory-store.ts#L11)**:
  Line 11 references `docs/v1-tasks/06-performance-and-quality-infra.md`.
- **[src/data/repository.ts](file:///home/nick/Repos/GoBuddy/src/data/repository.ts#L52)**:
  Line 52 references `docs/features/planned.md`.

### ✅ Resolved: Release Tooling Reference
- **[docs/release-checklist.md](file:///home/nick/Repos/GoBuddy/docs/release-checklist.md#L88)**:
  Line 88 previously specified `git add ... docs/features/`, a deleted directory. **Fixed**: now stages
  `docs/features.md` and `docs/roadmap.md` directly.

### ✅ Resolved: Documentation Preview Files
- `docs/features-preview.md` and `docs/roadmap-preview.md`: these temporary preview files no longer
  exist. `docs/features-preview.md` was renamed to `docs/features.md` (replacing the old flat
  summary+checklist version) and `docs/roadmap-preview.md` was renamed to `docs/roadmap.md`. The
  Detailed Roadmap Table (target versions `v1.1.0`, `v1.2.0`, etc.) was preserved as-is in the new
  `docs/roadmap.md`, which was also expanded with the V2 watchlist, open polish items, and
  status-TBD sections recovered from the deleted `docs/v1-tasks/`/`docs/v1-roadmap/` files.

---

## 2. Ingestion & Data Stability Checks

A major source of issues prior to release is unstable data models or incorrect ingestion outputs.

- **Check Slug Stability**:
  Before releasing, run the slug checking command:
  ```sh
  npm run ingest:check-slugs
  ```
  Ensure it does not report any backward-incompatible schema/slug renames unless they are mapped in `src/db/slug-renames.ts`.
- **Verify Costume-Lookup overrides**:
  Verify that the overrides inside `scripts/ingest/costume-lookup.json` match what's expected for newly added costumes/special forms.
- **In-App Coverage Check**:
  Check `src/data/reference-gaps.json` to confirm no new critical gaps (mismatched species/forms or missing type mappings) were introduced during the final ingestion runs.

---

## 3. Fresh Install & Sideload Verifications

- **Fresh Install CLI Errors (`prepare` script)**:
  In [package.json](file:///home/nick/Repos/GoBuddy/package.json#L7), the prepare hook `"prepare": "git config core.hooksPath .githooks"` is run on `npm install`.
  If a user downloads the source code bundle as a ZIP (without `.git`), `npm install` will crash with a git error.
  *Plan to verify/mitigate:* Double check if the `prepare` command can be guarded:
  ```json
  "prepare": "git rev-parse --is-inside-work-tree >/dev/null 2>&1 && git config core.hooksPath .githooks || true"
  ```
- **Android Upgrade Preservation**:
  Verify the key-signing configuration of the APK. Follow the upgrade path:
  1. Build and install an older release APK (signed with the stable release key).
  2. Build the v1.0.0 candidate release APK using `npm run android:release`.
  3. Verify that the new APK can be sideloaded directly over the old one without encountering "App not installed" errors (which indicate a signature mismatch).
  4. Ensure all local achievements, settings, and quarantined data are intact.

---

## 4. Boot-Safety & Migration Dry Runs

- **Downgrade Guard Validation**:
  Test running a build with an older DB schema version against the new code.
  Test running a build with a newer schema version on older code, and verify that the app gracefully prevents a boot instead of corrupting data (the downgrade guard).
- **Boot Rescue Triggering**:
  Verify that if the SQLite connection fails or throws on startup, the Boot Rescue UI successfully intercepts the crash and offers the user a raw-data JSON export.

---

## 5. V1.0.0-Specific Pre-Tag Blockers

One-time items specific to shipping V1.0.0 — not roadmap material, and not
already covered by the recurring [docs/release-checklist.md](release-checklist.md).

- **Settings "About" should show internal DB version numbers**: currently
  shows only the app release version (`__APP_VERSION__`). Verify or
  implement it also displaying the two internal DB version numbers — the
  personal-data schema version and the reference-data hash — before tagging
  v1.0.0. Both are already readable via `repo.getAppSetting(...)`/the schema
  constant; this is a display-only addition.
- **Verify `docs/install-guide.md`'s "export before updating" guidance is
  current**: it's already linked from README.md, but should be
  double-checked as part of pre-ship verification rather than assumed
  accurate.
