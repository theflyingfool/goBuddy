# Fetch verification pipeline — design

**Status:** Approved (design sections agreed with user 2026-08-03)
**Scope:** GoRefs (`vendor/reference/GoRefs`) only. This is the first of two
sub-projects the user is working through; the second (a source-prefixed
"exploration DuckDB" for manually mapping raw upstream data toward
`reference.json`'s shape) is intentionally deferred until this one ships,
because the exploration DB is only trustworthy once fetches are known to be
complete.

## Problem

`raw_dumps/` snapshots are silently incomplete in places. Confirmed by
direct inspection: `raw_dumps/pokemon_go_api/2026-08-02T183210Z/` and
`raw_dumps/pokeapi/2026-08-02T084644Z/` each contain only a `.meta.json` —
zero data files. Root cause: each fetcher's `fetch()` loops over its
configured endpoints, catches exceptions per-endpoint, prints a warning, and
keeps going (see `src/fetchers/pogoapi_net.py`, `pokemon_go_api.py`).
`finalize_snapshot()` then hashes the *whole directory* against the prior
snapshot — an empty dir doesn't hash-match a prior non-empty one, so it's
never deduped away. The result: a snapshot directory that looks like "this
source's data as of this timestamp" but is actually "nothing was fetched,
and nothing recorded that."

There's no retry, no structured record of what failed and how often, and no
mechanism to notice when an upstream source grows a new endpoint that isn't
in `config/sources.yml` yet.

## Goals

1. Per-endpoint fetch tracking with automatic cross-source retry.
2. A snapshot layout that's always directly readable (no traversal to
   reconstruct "current state") while still keeping history economically.
3. A durable, queryable record of every fetch attempt (not just failures).
4. Best-effort discovery of upstream endpoints not yet in config, persisted
   until explicitly reviewed — never silently dropped, never auto-adopted.
5. One markdown report, rendered fresh on every relevant run from persisted
   per-section JSON state, that becomes the single place to see "is this
   pipeline healthy" — extensible per-flag without touching other flags'
   code, and never loses history to an unrelated run.

## Non-goals (this round)

- The exploration DuckDB (separate sub-project, follow-up spec).
- Literal diff/patch storage format — `latest/` + per-file archive-on-change
  gets most of the benefit without needing a diff/patch representation.
- Auto-adding discovered endpoints to the active fetch list — discovery only
  ever surfaces candidates for human review.
- Full implementation of the Docs/Serve/Test-Paranoid report sections — the
  shell is defined now so headers never need to move later, but only
  Fetch and Discovery are implemented this round.
- Literal cron scheduling — "periodic re-explore" is a staleness gate
  (`last_discovered_at` + `reexplore_interval_days`), not a scheduler.

## Design

### 1. Per-endpoint model + cross-source retry queue

Every source normalizes to a list of named endpoints, including the
currently-single-URL sources (`alexelgt_game_masters`, `pvpoke`,
`rplus_shiny`, `local_authoring`) — each becomes a one-item endpoint list.
This removes the fork between "sources with an `endpoints:` list" and
"sources with a bare `url:`" that exists in today's fetchers, and makes
retry/tracking logic uniform.

The orchestrator (replacing `run_fetching()` in `go_refs.py`) builds one
flat worklist of `(source, endpoint)` pairs across every enabled source,
attempts each once (first pass, in source order), then re-queues only the
failures and retries that queue after the full first pass completes — up to
3 total attempts per endpoint. A source's failures don't block later
sources, and retries always happen after a full sweep, never inline within
the same source's loop.

### 2. Endpoint registry moves out of `sources.yml`

`config/sources.yml` keeps only connection-level fields per source:
`base_url`, `trust_tier`, `priority`, `license`, `local_dump_dir`,
`enabled`. No more `endpoints:` list.

A new `config/source_templates/<source>_endpoints.yml` becomes the
per-source endpoint registry, living alongside the existing
`config/source_templates/<source>_<endpoint>.yml` schema-mapping files
(same directory — not a nested `source_templates/<source>/{endpoints,schema}`
reshuffle, since `profiler.py`/`engine.py`/`builder.py` all reference the
current flat naming and there's no functional need to touch that
convention here). Each `_endpoints.yml` has three buckets:

```yaml
active:
  - name: badges
    path: /badges.json
    last_verified_at: "2026-08-02T18:36:22Z"
candidates:
  - name: some_new_endpoint
    path: /some_new_endpoint.json
    discovered_at: "2026-08-03T09:00:00Z"
ignored:
  - name: deprecated_endpoint
    path: /deprecated_endpoint.json
    reason: "duplicate of pokemon_stats, ignored 2026-08-03"
```

Only `active` entries are fetched. `candidates` and `ignored` are never
auto-fetched.

### 3. Discovery ("re-explore")

New `discover_endpoints()` hook on `BaseFetcher`. Default implementation is
a no-op that reports "no discovery available for this source" (explicit,
not silently skipped) — used by `alexelgt_game_masters`, `pvpoke`,
`rplus_shiny`, `local_authoring` (single-file or manual sources with no
listable "other endpoints" concept).

Sources that expose a listing mechanism override it:
- `pogoapi_net`, `pokemon_go_api` (static files in a GitHub-hosted repo) —
  hit GitHub's contents API for the directory, diff returned filenames
  against the source's `_endpoints.yml` (`active` + `candidates` +
  `ignored` combined) to find genuinely new files.
- `pokeapi` (real REST API with a resource index) — hit its own root
  category listing (`/api/v2/`), diff resource-type names the same way.

New candidates get appended to that source's `_endpoints.yml` under
`candidates:`, never auto-promoted to `active`.

**Cadence:** each source's `_endpoints.yml` gains a top-level
`last_discovered_at`. A normal `--fetch` run auto-triggers discovery for
any source whose `last_discovered_at` is older than a configurable
`reexplore_interval_days` (value TBD by user, lives in `config/sources.yml`
or a small top-level settings block — not per-source). `--fetch --reexplore`
forces discovery for every enabled source regardless of staleness. This is
a staleness gate, not a scheduler — no cron, no background process.

**Persistence:** any entry sitting in `candidates:` shows up in the
Discovery report section on *every* run until a human moves it to `active`
or `ignored`. It is never silently dropped and never expires on its own.

### 4. Snapshot layout: `latest/` + per-file archive-on-change

Rejected an earlier version of this design (per-file dedup with
"unchanged, see prior snapshot" pointers) because it would require
traversing backward through snapshot directories to answer "what's the
current value of endpoint X" — real cost for both the build pipeline and
the (future) exploration DB. Replaced with:

- `raw_dumps/<source>/latest/<endpoint>.json` — always the current,
  complete state for every active endpoint in that source. One flat
  directory per source, always directly readable, no traversal ever
  required to determine current state.
- `raw_dumps/<source>/latest/.manifest.json` — per-endpoint metadata:
  content hash, `fetched_at`, etag, status (`ok`/`failed`).
- On a successful fetch of an endpoint whose content hash changed (or is
  new): first move the outgoing `latest/<endpoint>.json` to
  `raw_dumps/<source>/history/<outgoing-file's-own-fetched_at>/<endpoint>.json`
  (archived under the timestamp *that version* was originally captured —
  keeps the existing raw_dumps timestamp convention meaningful, rather than
  stamping the archive with "now"), **then** write the new content into
  `latest/<endpoint>.json` and update the manifest.
- Unchanged content: manifest's `fetched_at` for that endpoint is left
  alone (it still reflects when that value was last actually different),
  nothing is moved or rewritten.

Net effect: reading current state costs one directory listing. History
still only grows when something changed — no whole-directory duplication
for endpoints that didn't move.

### Empty-snapshot fix

This directly resolves the bug that motivated the whole sub-project.
Snapshot/manifest state after a fetch pass (including retries) is one of:

- **All endpoints unchanged, none failed** → nothing written to `latest/`
  or `history/`; `.manifest.json`'s existing entries stand.
- **At least one endpoint changed** → `latest/` and `.manifest.json`
  updated per endpoint as above; any endpoint that failed all 3 attempts
  keeps its last-known-good file in `latest/` untouched, but its manifest
  entry's `status` flips to `failed` with the error recorded.
- **Every endpoint failed (even after retries)** → `latest/` is left
  exactly as it was (last known good data, if any, is never deleted by a
  failed run) but this is a MAJOR ISSUE in the report: "source X: 0/N
  endpoints reachable this run." No directory is ever left in the old
  ambiguous "exists but empty, meaning unclear" state.

### 5. Fetch history log (not "failure" log — every attempt, not just failures)

Single central `raw_dumps/.fetch_history.jsonl`. One line appended per
attempt (including retries), regardless of outcome:

```json
{"source": "pokeapi", "endpoint": "move", "timestamp": "2026-08-03T09:00:01Z", "outcome": "failed", "error": "timeout after 30s"}
```

Central rather than per-source so "is this endpoint chronically flaky"
is answerable by reading one file, not N.

### 6. Report: JSON state per section + single render step

Rejected a Markdown-text-mutation design (marker comments, find-or-append
within a rendered file) in favor of treating rendering as a pure function
over persisted structured state:

- Each section owns a persistent state file:
  `output/report_state/fetch.json`, `discovery.json`, `serve.json`, `docs.json`,
  `test_paranoid.json`. A flag writes/updates whichever state file(s) are
  relevant to it — a single flag can touch more than one (e.g. a future
  `--test-paranoid` could write a short note into `fetch.json`
  ("verified latest sources") in addition to its own detailed
  `test_paranoid.json`). No shared-file contention, no text parsing, ever.
- `render_report()` runs at the end of every invocation: reads every state
  file that exists, renders each into its Markdown section, writes
  `output/fetch_report.md` fresh each time. All Markdown formatting lives
  in this one function — still gets the "swap format later = one place to
  change" property, more cleanly than the rejected marker approach.
- **State persists indefinitely.** Nothing is auto-cleared by rendering. A
  section's state stands until that section's own flag runs again and
  overwrites it. This is what lets a `--docs`-only run days later still
  render a report showing `test-paranoid`'s last result, or a `--serve`
  session's stats from when it was last live — history isn't lost just
  because an unrelated flag generated the file in between.
- **Collapsed-by-freshness rendering.** A section whose state file was
  written by *this* process (this invocation) renders in full detail.
  A section whose state file exists but wasn't touched this run collapses
  to one line: `## Fetch — last updated 2026-08-01T09:00:00Z (2 days ago),
  not run this pass`. This is what keeps a small, focused `--fetch` run's
  report short in practice without deleting anything or needing a flag —
  it's purely a function of "did this process just write this state file."
- **MAJOR ISSUES rollup** reads every state file directly (structured data,
  not scraped Markdown) and applies per-section-type issue rules — no
  regex over rendered output.
- **`--no-report`:** the report is still rendered every time; this flag
  only suppresses the automatic `xdg-open`/`$EDITOR` launch at the end.

**Deferred (noted, not built this round):** filtered report views
(`--report --last N runs`, `--report --full`, per-source report scoping).
Explicitly easy to add later precisely because state already persists as
full history — no design debt is being taken on by deferring this.

## Open items for the implementation plan

- Exact value for `reexplore_interval_days` (and where in config it lives —
  proposed: a small top-level `settings:` block in `sources.yml`, not
  per-source, since there's no stated reason for it to vary by source yet).
- Exact retry backoff (if any) between the 3 attempts — not discussed;
  default to no explicit delay unless a real rate-limit issue surfaces.
- `xdg-open` vs `$EDITOR` precedence and Linux-only vs cross-platform
  handling — this environment is Linux, no cross-platform requirement
  raised.
