# V2 Consolidation — Feature Freeze & Cleanup (toward v2.0.0)

## Goal

Close out everything already started (Vue migration, multi-account, known
bugs, repo hygiene) so the app reaches a coherent, feature-frozen state
tagged `v2.0.0`. V1 (`v1.0.0` tag) is treated as a proof-of-concept
reference point going forward, not the live baseline.

This is a decomposition, not a single design — five independent
sub-projects, each gets its own brainstorm → spec → plan → implementation
cycle when its turn comes. This document fixes the *scope boundary* and
*sequence* for all five; it is not itself a build plan for any of them.

## Sequence

Sub-projects run **strictly in order**, one at a time.

1. Git restructure (operational, not a build task)
2. Bug fixes + repo cleanup + reference-data hash optimization
3. Vue migration completion + visual fidelity
4. IV-entry rework (Attack/Defense/Stamina instead of typed IV%)
5. Full multi-account (roadmap.md §3 Phase 2, cross-device merge included)

Rationale: small/independent items first (fast wins, nothing else depends
on them), then the biggest UI surface (Vue completion), then a small
focused data-entry change, then the largest and most novel piece
(multi-account) last, since it benefits from the Vue migration already
being finished and from every other loose end being tied off first.

## Open, not-yet-sequenced: Capacitor → Tauri

Owner decision (2026-07-23, not yet brainstormed/spec'd): move the app's
native shell from Capacitor to Tauri — real desktop builds, a genuine
on-disk SQLite file on every platform (enabling Drizzle Studio access to
real data, not just `dummy.sqlite`), while still building for Android.
Where this lands in the sequence above is explicitly undecided; noting the
interaction that matters most rather than guessing a slot:

- **Sub-project 5 (multi-account) is the most storage-sensitive piece.**
  Today's web storage (`jeep-sqlite`/sql.js writing into IndexedDB, no real
  filesystem access) is exactly why the "reference/personal DB file split"
  and "DB-file-per-profile vs. single-file-with-profile_id" questions
  (`docs/roadmap.md` §4 V2 Watchlist, §3 Phase 2 "Not yet committed") were
  left open rather than decided — a real on-disk file on every platform
  (Tauri's model) removes that constraint and could make a
  file-per-profile design the obviously simpler answer instead of a
  deferred-as-too-hard one. Deciding Sub-project 5's storage design before
  knowing whether Tauri lands first would risk designing around a
  constraint that's about to disappear.
- Everything else in this doc (bug fixes, Vue/visual work, IV-entry rework)
  is UI/data-layer work that doesn't depend on which native shell hosts it,
  so there's no strong reason to block those sub-projects on this decision.

This needs its own brainstorm (migration scope, Android build-path parity
checks, what happens to the existing `@capacitor-community/sqlite`/
`jeep-sqlite` code paths, timing relative to Sub-project 5) before it gets
a real slot in the sequence — flagging the dependency now so Sub-project
5's design isn't started blind to it.

---

## 1. Git restructure

**Not a spec/plan/TDD sub-project** — this is a one-time operational
change to repo structure, not code. Mechanics need explicit sign-off
before executing (pushing to `origin/master` is shared state).

Current state (confirmed via `git log`/`git merge-base`):
- `origin/master` and the `v1.0.0` tag point to the same commit
  (`e9893ca`) — master hasn't moved since the v1.0.0 release.
- The current branch (`vue-migration-phase0-and-new-pages`) is 47 commits
  ahead of `origin/master`, and `origin/master` is a clean ancestor (no
  divergence) — a fast-forward, not a merge.
- Local `master` is 1 commit ahead of `origin/master` (`5925f87`, V2
  planning docs) and is *also* a clean ancestor of the current branch.
- Stray branches, checked against current work:
  - `v2-ingestion-pipeline-spike` — fully merged already (ancestor of
    current branch); stale ref only, safe to delete.
  - `refactor/docs-cleanup` — 0 commits ahead of master; stale ref, safe
    to delete.
  - `doc-cleanup` — **1 real unmerged commit** (`dc9e053`, "Manual review
    of documentation", 2026-07-15): removes `.github/workflows/build-apk.yml`,
    adds `.gitignore` entries, trims README/`docs/install-guide.md`/
    `docs/data-model.md`/`docs/issues.md`, and a one-line comment fix in
    `src/db/cascades.ts`. **Needs a decision**: still wanted as-is, or
    superseded by later changes? (e.g. confirm the APK workflow removal is
    still desired given anything that's changed release-wise since.)
- Worktrees: `worktree-feature+release-signing` and `keen-elm-4lto` are
  active branch worktrees (unknown in-progress state — do not touch
  without checking with the user first); the detached
  `fix+export-cancelled-web` worktree sits at `b0f1ea3`, an old commit
  already fully contained in `master`'s history — likely safe to remove,
  but confirm before removing since it's a worktree, not just a branch ref.
- Untracked files at repo root (from `git status`):
  - `Refs/gobuddy-rescue-export-2026-07-22T13-12-33-339Z.json` — a real
    personal data export (400KB). Contains actual collection data; decide
    whether to delete, move outside the repo, or `.gitignore` the
    directory.
  - `Reports/project_review_report.md` and `Reports/testing_evaluation_report.md`
    — two prior full-codebase review reports (architecture/data-safety and
    testing-coverage respectively). Useful content already folded into
    this doc's sub-project scopes below; decide whether to keep them
    (and where — `docs/`?) or discard now that their actionable findings
    are captured here.
  - `verify-gobuddy.mjs` — a throwaway Playwright verification script,
    safe to delete.

**Proposed mechanics** (for confirmation before executing):
1. Resolve `doc-cleanup`'s unmerged commit (cherry-pick onto current
   branch, or explicitly discard) — decision needed first.
2. Fast-forward `master` to the tip of the current work branch.
3. Push `master` to `origin` (shared-state action — explicit go-ahead
   needed at execution time regardless of this doc).
4. Leave `v1.0.0` tag exactly where it is (already correct).
5. Delete stale local branch refs (`v2-ingestion-pipeline-spike`,
   `refactor/docs-cleanup`, and `doc-cleanup` once resolved).
6. Decide fate of the three untracked root items above.
7. Going forward: adopt `feature/<name>` / `fix/<name>` branches off
   `master` for each sub-project below, per the existing branch-naming
   convention already visible in `origin/fix/caught-uncaught-form-flag`.

---

## 2. Bug fixes + repo cleanup + reference-data hash optimization

**In scope:**
- Trainer level-set SQL error (`TrainerPage.vue` / `setPlayerProgress`) —
  root cause not yet diagnosed; needs its own investigation as step one
  of this sub-project.
- Migration v4 FK contradiction: `ALTER TABLE ... ADD COLUMN profile_id`
  omits `REFERENCES profile(id)` (SQLite disallows adding an FK via
  `ALTER TABLE` with a non-null default), while fresh installs'
  `PERSONAL_SCHEMA_SQL` declares the FK — upgraded installs silently don't
  enforce a constraint fresh installs do. Decide whether this needs an
  active fix (a rebuild-table migration step) or is accepted as a known,
  practically-harmless divergence.
- Reference-data hash optimization: `reference-sync.ts` already skips the
  wholesale rebuild when the content hash matches (`reference-sync.ts:126`)
  — but it still `JSON.stringify`s and FNV-1a-hashes the entire reference
  dataset on every single boot just to perform that check. Replace with a
  build-time-computed version marker (e.g. baked into `reference.json`'s
  own build step or a sibling constant) so boot does zero per-launch
  hashing work.
- Dead doc reference: `personal-data-transfer.ts:1`'s comment points at a
  nonexistent `TODO.md`. Fix or remove the reference.
- Repo cleanup: remove unused files identified during the audit (see
  Sub-project 1's untracked-file list) plus any other dead files found
  during this pass — this sub-project is also the place to do a general
  "anything else obviously unused" sweep, not just the specific items
  already found.

**Out of scope (explicitly deferred, log to `docs/roadmap.md`):**
- `personal_data_quarantine`'s inert state — **already decided** in
  `docs/roadmap.md` §7 (owner call 2026-07-15: a small status-line +
  count + export button on Settings, deliberately not a full
  inspection/recovery tool). Do not re-open this design; implement per
  the existing decision if/when it's prioritized, but it's not part of
  this bug-fix sweep.
- Zero-coverage test gaps found in the audit (search/normalization,
  boot-rescue recovery, completion-stats SQL lenses) — real gaps, but
  testing-debt backfill is its own effort, not a "bug." Log to roadmap.
- Sync-write-queue cache/rollback integrity (`sqlite-repository.ts`: if an
  async SQLite write fails, the in-memory cache already mutated
  synchronously doesn't roll back) — real risk, but nontrivial scope
  (touches the write-queue's error-handling contract broadly). Log to
  roadmap rather than folding into this sweep as a "quick" bug fix.
- IndexedDB persist-flush micro-stutter on bulk web writes — performance
  polish, not a correctness bug; log to roadmap.

---

## 3. Vue migration completion + visual fidelity

**Already-migrated-to-Vue pages** (confirmed via `src/main.ts`/`app-shell`):
Settings, Trainer, Collection, Log a catch, Stats (partial — see below).

**Still vanilla TS with real functionality** (genuine migration debt,
matches "half-assed transition" complaint):
- Dex grid + Bulk Edit (`species-grid.ts`, `bulk-form-edit.ts`)
- Species detail (`species-detail.ts`)
- Coverage Report (`coverage-report-page.ts`)
- Help (`help-page.ts`)

**Stub pages — NOT migration debt, net-new unbuilt features** (do not fold
into this sub-project; these were never "started" beyond a placeholder
message, per `src/features/stubs.ts`):
- Search Tools ("search-string builder and auto-declutter engine... not
  built yet") — already unscoped V2-watchlist backlog per
  `docs/roadmap.md` §4.
- Achievements, XP Assistant — both explicitly "planned for a future
  phase... beyond dex-tracking" per their own stub text.

Building these three out is real feature work with its own scoping needs,
not something this "finish what we started" push should silently absorb.
Flag to the user explicitly if they want one of these pulled forward —
otherwise they stay backlog.

**Visual fidelity gaps to address** (mockup comparison):
- Stats page: current build wraps the old completion-table renderer
  unchanged (per `vue-migration-plan.md`) plus two new charts. The
  mockup's Stats page is lighter — 3 hero stat tiles (Registered %,
  Specimens logged, Trainer level), an XP progress bar, a plain 5-row
  lens-progress list (Registered / Form-complete / Costume-complete /
  Achievement-complete / Mega-Gmax), then the two bar charts (specimens by
  state, top tags) — no large completion table as the primary view.
- Trainer page: medals shown as a list — mockup doesn't include a
  dedicated Trainer/medals screen at all (it was built independently,
  post-mockup), so this is a fresh UI decision, not a fidelity fix: medals
  should move to a grid layout instead of a scrolling list.
- Log-a-catch FAB reachable from species detail: in the mockup, the
  floating "+ Log a catch" button lives on the **species detail** page
  (not the Dex grid) and deep-links to the Log-a-catch screen pre-filled
  with that species. Add this once species detail is migrated (natural
  side effect of the migration work, not a separate task).

**Out of scope for this sub-project:**
- Building Search Tools/Achievements/XP Assistant (see above).
- SQL-backed pagination for Collection's `pokemon_instance` scan — a
  real scalability gap the audit found, but unrelated to visual/Vue
  migration; log to roadmap as its own performance item.

---

## 4. IV-entry rework

Replace Log-a-catch "Full details" mode's typed **IV %** field with three
Attack/Defense/Stamina inputs, each constrained to integers 0–15
(matching in-game IV mechanics), with IV% computed from them rather than
hand-entered. Note this is a deliberate improvement *beyond* the mockup
(which itself still shows a typed IV% field) — not a fidelity fix.

Needs its own brainstorm when this sub-project's turn comes: whether to
reuse the species-detail Info tab's existing slider pattern (already
built for the CP calculator, 0–15 range) or a different input style for
a data-entry (not calculator) context, and whether CP should also become
computed from IVs+level here or stay a separate manual field.

---

## 5. Full multi-account (roadmap.md §3 Phase 2)

Confirmed in scope per explicit owner decision: local profile
create/switch/rename (fixing the SQL bug from Sub-project 2 is a
prerequisite here, not a duplicate), full friend-comparison/export-import
for both single-account and multi-account cases, and — critically — real
cross-device merge semantics for `pokemon_instance`/`tag` records, which
currently do not merge at all on import (`vue-migration-plan.md:228-235`,
also flagged as the audit's top-severity finding). Profile IDs are
confirmed **not** stable across devices (two independent installs will
both start at profile id 1), so comparison/merge logic cannot key on
`profile_id` — needs its own stable identity scheme (e.g. UUIDs), which is
exactly the audit's suggested direction.

**Known dependency to flag, not resolve now:** `docs/roadmap.md` §3 lists
Phase 2 as depending on Phase 0 (ingestion/reference-data overhaul,
not started) and Phase 1 (personal-data timestamps, **already done** via
the epoch-ms migration on this branch). Phase 0 is out of scope for this
push — meaning any account-comparison view built here compares against
whatever reference fields exist today, not richer Phase-0 data. This is a
conscious limitation to confirm with the user when this sub-project's
turn comes, not something to silently work around by pulling Phase 0
forward.

Needs its own full brainstorm (biggest, most novel piece): profile
identity scheme, DB-file-per-profile vs. single-file-with-profile_id (the
already-flagged "not yet committed" V2-watchlist question), comparison UI
placement, and the two real-world merge directions the owner described
(input-once-then-export-for-a-friend-to-keep-updating; periodic
send-back-updates-for-re-import).

---

## Deferred items to log in `docs/roadmap.md` (not part of this push)

- Sync write-queue cache/rollback integrity on async SQLite failure.
- IndexedDB persist-flush micro-stutter on bulk web writes.
- SQL-backed pagination for Collection page's `pokemon_instance` scan.
- Zero test coverage: search/normalization (`parseSearchQuery`,
  `normalizeForSearch`, `fuzzyMatches`), boot-rescue recovery
  (`boot-rescue-read.ts`), completion-stats SQL lenses.
- Search Tools, Achievements, XP Assistant — unbuilt stub pages, real
  feature work, not migration debt.
- Multi-token search query parsing (`legendary shiny` combined) — already
  tracked in `docs/roadmap.md` §5's existing search-quality bug list.
