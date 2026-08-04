# GoRefs ingestion swap: pre-merge testing

**Status:** Open

Logged 2026-08-04, after implementing
[docs/superpowers/plans/2026-08-03-gorefs-ingestion-source-swap.md](../superpowers/plans/2026-08-03-gorefs-ingestion-source-swap.md)
(all 8 tasks complete, merged to `feat/gorefs-ingestion-source-swap`). None
of the items below were tested during implementation — flagged for
follow-up, not blocking, but worth working through before treating the
swap as fully verified.

## High priority (real gaps in what got tested)

1. **`reference.sqlite` build, for real.** Every full-pipeline run during
   implementation used `--skip-sqlite`. `writeReferenceSqlite` has unit
   tests against fixtures, but it's never been run against the actual
   GoRefs-produced `reference.json` end-to-end. Run `npm run ingest` with no
   skip flags and open the result with `npm run studio` or a SQLite tool.
2. **The app itself, in a browser.** Nothing during implementation started
   the dev server. `reference-sync.ts` consumes `reference.json`/
   `reference.sqlite` at runtime — confirm the dex screens, sprites, and the
   now-empty `backgrounds` table (dropped from 2 fake rows to `[]`) don't
   break anything user-facing. Code inspection suggests the empty-backgrounds
   case is handled (the type comment says background is "always optional"),
   but that's a read, not a test.
3. **Fresh-clone / cold-cache bootstrap.** Every run during implementation
   had a warm GoRefs build and warm sprite cache already on disk. A
   genuinely new clone needs `uv run go_refs.py --build --load-reference-shim`
   run manually first (per the design doc) — and that requirement isn't
   actually written down in `docs/ingestion-runbook.md` yet. Needs both a
   doc fix and one real fresh-cache run to confirm the steps are sufficient.

## Medium priority

4. **`ingest:check` reporting an actual diff.** Only the "no changes" path
   was tested (checked right after a build). The diff-detection path was
   never exercised with a genuine change to GoRefs' `_meta.last_built_at`.
5. **The "already-running server" path, for real.** `probeOrSpawnServer`'s
   `ownedByUs: false` branch is unit-tested against a fake server, but never
   exercised in a real `npm run ingest` with a developer's own
   `go_refs.py --serve` already up.
6. **Error path when GoRefs is truly unreachable** (no `uv`, no built
   `.duckdb`, etc.) — should fail loudly per the design, but that failure
   mode was never actually triggered and observed.
7. **The dormant GAME_MASTER path still works if reactivated.**
   `fetchAllFromGameMaster`/`buildFromGameMaster` were renamed and
   re-exported but never actually invoked during implementation — worth one
   manual run to confirm the rename didn't quietly break something.

## Lower priority

8. The 23-34 sprite 404s seen during real sprite-fetch runs (shiny variants
   that don't exist upstream) — worth a quick sanity check that these are
   pre-existing upstream gaps and not something the swap introduced, though
   nothing points that direction.
