# PoGo Buddy V1.0.0 Pre-Launch Verification Checklist

This checklist outlines the critical components, documentation links, files, and build pipelines that must be verified prior to launching **PoGo Buddy Version 1.0.0**. (App name confirmed by the owner as "PoGo Buddy" — see `docs/roadmap.md`'s former D6 decision item.)

---

## 1. Documentation Integrity & Link Verification

During the documentation refactoring, many files (e.g., `docs/v1-roadmap/`, `docs/v1-tasks/`, and `docs/features/` subdirectories) were consolidated or deleted. We must clean up residual references to prevent broken links:

### ✅ Resolved: Stale References to Deleted Files in Code & Build Files
- All 12 code-comment references across `eslint.config.js`,
  `test/node-sqlite-connection.ts`, `scripts/ingest/check-slug-stability.ts`,
  `scripts/ingest/build-sprite-mapping.ts`, `scripts/ingest/build-reference.ts`,
  `src/app-shell/boot-failure-rescue.ts`, `src/ui/sprites.ts`,
  `src/features/settings/settings-page.ts` (×2), `src/data/boot-rescue-read.ts`,
  `src/data/in-memory-store.ts`, and `src/data/repository.ts` fixed
  2026-07-16. Where the referenced content still exists in the new docs
  (e.g. Data Safety Net, the V2 identity/slug rework, the Manual Search
  Builder), the comment now points there instead; where the referenced task
  was simply completed and has no live doc equivalent, the dead pointer was
  dropped and the comment left self-contained. Verified via repo-wide grep —
  zero remaining `docs/v1-tasks`/`docs/v1-roadmap`/`docs/features/` matches
  in source. Lint and full unit suite (23/23) still pass.

### ✅ Resolved: Release Tooling Reference
- **[docs/release-checklist.md](file:///home/nick/Repos/GoBuddy/docs/release-checklist.md#L88)**:
  Line 88 previously specified `git add ... docs/features/`, a deleted directory. **Fixed**: now stages
  `docs/features.md` and `docs/roadmap.md` directly.

### ✅ Resolved: Content Lost from `docs/features/next.md` and `docs/features/planned.md`
- These two files were also deleted by the restructure but weren't in scope
  of the original `v1-tasks`/`v1-roadmap` recovery pass. Found 2026-07-16:
  they held the quarantine-visibility design spec (owner-decided
  2026-07-15) and two owner-proposed deferred items (unifying Dex-grid/
  form-tile rendering; consolidating Dex grid + Bulk Edit into one toggled
  page). All three recovered and added to `docs/roadmap.md` §6.

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

- **Check Slug Stability** — ✅ Verified 2026-07-16:
  ```sh
  npm run ingest:check-slugs
  ```
  Passed clean: "1025 species, 2855 forms, 57 mega variants checked", zero unmapped renames.
- **Verify Costume-Lookup overrides**: not re-audited this pass — no costume
  additions since the last verification (see
  [docs/costume-lookup-verification.md](costume-lookup-verification.md) for
  the last full pass). Re-run only needed if new costumes/special forms are
  added before tagging.
- **In-App Coverage Check** — checked 2026-07-16, **flagging for owner
  review, not silently cleared**: `src/data/reference-gaps.json` currently
  has 556 entries — `unverified-gender: 65` (matches the count already
  logged as deferred-to-V2 in `docs/roadmap.md`), `inherited-availability:
  445` (roadmap.md's V2-watchlist entry says 385 — a ~60-entry increase
  since that number was last recorded; worth a quick sanity check that this
  is just re-ingestion finding more of the same known category, not a new
  regression), plus `mega-discrepancy: 35` and `guessed-costume-name: 11`
  (not previously called out with specific counts anywhere — likely the
  same "Mega Dimension entries not yet reflected in the GO tracker CSV"
  pattern the ingestion code already gates on, but not individually
  spot-checked here).

---

## 3. Fresh Install & Sideload Verifications

- **Fresh Install CLI Errors (`prepare` script)** — ✅ Resolved:
  `npm install` from a ZIP download (no `.git` folder) still prints a git
  error from the `prepare` hook (`git config core.hooksPath .githooks`), but
  this is now documented as safe-to-ignore in
  `docs/install-guide.md`'s "Desktop / browser" section (README.md's
  "Running it" links there too) — `npm run dev` works regardless. Not
  code-fixed (the `prepare`
  script itself is unguarded), just a doc note; revisit guarding it for real
  post-V1 if it keeps confusing people.
- **Android Upgrade Preservation** — still open, needs a physical device and
  an actual `v1.0.0` candidate build, so it can't be verified in this
  environment. Same check as `docs/release-checklist.md` §4's "Manual
  Upgrade Verification" — do it once, at actual tag time, not twice.

---

## 4. Boot-Safety & Migration Dry Runs

- **Downgrade Guard Validation** — ✅ Verified: covered by
  `test/migrations.test.ts`'s `"runPersonalMigrations refuses to boot
  against a newer-than-known stamped version"` unit test, passing (23/23
  suite green as of 2026-07-16).
- **Boot Rescue Triggering** — still open. No automated test exercises the
  actual crash-interception path (only the read/export logic has unit
  coverage, in the migrations/reference-sync suites) — this needs a real
  forced DB-open failure and a look at the rescue screen, same item already
  tracked in the dossier's QA card.

---

## 5. V1.0.0-Specific Pre-Tag Blockers

One-time items specific to shipping V1.0.0 — not roadmap material, and not
already covered by the recurring [docs/release-checklist.md](release-checklist.md).

- **Settings "About" should show internal DB version numbers** — ✅
  Resolved, verified 2026-07-16: already implemented. The About fieldset in
  `settings-page.ts` shows the app version, `Personal-data schema: vN`, and
  `Reference data: <version>` — this checklist item was stale, not an
  actual gap.
- **Verify `docs/install-guide.md`'s "export before updating" guidance is
  current** — ✅ Resolved: the doc was substantially rewritten 2026-07-16
  (now covers both Android and desktop/browser), export-before-updating
  guidance confirmed current on both paths.
