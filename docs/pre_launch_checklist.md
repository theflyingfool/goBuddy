# GoBuddy V1.0.0 Pre-Launch Verification Checklist

This checklist outlines the critical components, documentation links, files, and build pipelines that must be verified prior to launching **GoBuddy Version 1.0.0**.

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

### ⚠️ Stale References to Deleted Folders in Release Tooling
- **[docs/release-checklist.md](file:///home/nick/Repos/GoBuddy/docs/release-checklist.md#L88)**:
  Line 88 specifies: `git add package.json package-lock.json android/app/build.gradle CHANGELOG.md docs/features/`.
  *Note:* The directory `docs/features/` is fully deleted in the refactoring branch. This command will fail or behave incorrectly. It should be changed to: `git add package.json package-lock.json android/app/build.gradle CHANGELOG.md docs/features.md`.

### 🧹 Cleanup of Temporary Documentation Previews
- **[docs/features-preview.md](file:///home/nick/Repos/GoBuddy/docs/features-preview.md)** and **[docs/roadmap-preview.md](file:///home/nick/Repos/GoBuddy/docs/roadmap-preview.md)**:
  These files are added in the branch `refactor/docs-cleanup` but are not referenced anywhere. Their content is fully merged into [docs/features.md](file:///home/nick/Repos/GoBuddy/docs/features.md). Double check if these should be removed prior to merge.
  *Note:* The **Detailed Roadmap Table** (listing specific target versions such as `v1.1.0`, `v1.2.0`, etc.) from [docs/roadmap-preview.md](file:///home/nick/Repos/GoBuddy/docs/roadmap-preview.md#L49-L70) is omitted from [docs/features.md](file:///home/nick/Repos/GoBuddy/docs/features.md). Confirm if the table should be preserved in `docs/features.md` before deleting the preview files.

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
