# GoRefs Ingestion Source Swap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace GoBuddy's default reference-data ingestion (`npm run ingest`) with querying the vendored GoRefs project over HTTP, while leaving the old GAME_MASTER/pokemon-go-api/shiny-sheet pipeline dormant and reachable, not deleted.

**Architecture:** A new GoRefs-query layer probes for (or spawns) `go_refs.py --serve`, `ATTACH`es its served `.duckdb` via a Node DuckDB client, and runs one `SELECT * FROM refjson_<table>` per `ReferenceData` domain. `scripts/ingest/ingest.ts`'s default pipeline is rewired to call this instead of the old fetch/transform steps; the old steps are renamed and kept, unused by default.

**Tech Stack:** TypeScript (`tsx`), Node's built-in `node:test`, a Node DuckDB client (package TBD by Task 2's spike), Python/`uv` (GoRefs side, one small task).

## Global Constraints

- Design doc of record: `docs/superpowers/specs/2026-08-03-gorefs-ingestion-source-swap-design.md`. Every task below implements a specific section of it — if this plan and that doc ever disagree, the design doc's most recent revision wins; flag the conflict rather than silently picking one.
- `reference.json`'s shape (`src/db/reference-data.ts`'s `ReferenceData` interface) does not change. Nothing downstream of it (`reference-sync.ts`, `writeReferenceSqlite`, the app itself) is touched by this plan.
- The old GAME_MASTER-based pipeline (`sources/game-master.ts`, `sources/shiny-sheet.ts`, `sources/pogoapi-badges.ts`, `sources/pokemon-go-api.ts`, `transform/species.ts`, `transform/moves.ts`, `transform/evolutions.ts`, `transform/player-progression.ts`, `transform/pvp.ts`) is **never deleted** in this plan — only unwired from the default pipeline. Do not remove any of these files or their existing tests.
- Domain → GoRefs table mapping is fixed by the design doc: every domain except `regions`/`types` (derived) and `backgrounds` (dropped) reads from a `refjson_*` table, uniformly. Do not substitute a canonical table for any domain without updating the design doc first — several were already tried and rejected (`species`, `raidBosses`, `communityDays`) for concrete, verified reasons documented there.
- This is a rapid-development-phase project (see `CLAUDE.md`): don't add test coverage beyond what each task specifies, and don't gold-plate error handling beyond what's asked.
- Per `CLAUDE.md`: don't show diffs inline in chat responses unless explicitly requested.

---

### Task 1: GoRefs `_meta` table (last-pulled-per-source, last-built-at)

**Repo:** no standalone GoRefs clone exists (removed 2026-08-03, per `docs/ingestion-runbook.md`'s "Editing GoRefs itself: no separate clone exists"). `vendor/reference/GoRefs` inside this checkout is the only working copy — GoRefs-side edits are made here, committed in GoBuddy's own history, then published to GoRefs' own remote via `git subtree push`. That publish step is required every time, not optional/batched.

**Files:**
- Modify: `vendor/reference/GoRefs/src/builder.py` (add a `_meta` table write, near the existing `datetime.datetime.now(datetime.timezone.utc).isoformat()` build-timestamp computation at `src/builder.py:1380`)
- Test: `vendor/reference/GoRefs/tests/test_meta_table.py` (new)

**Interfaces:**
- Produces: a `_meta` table in `output/GoRefs_Master.duckdb` with columns `source VARCHAR, last_pulled_at VARCHAR` (one row per source, `source = '__build__'` reserved for the overall build timestamp) — later tasks in GoBuddy query this via `SELECT last_pulled_at FROM gorefs._meta WHERE source = '__build__'`.

- [x] **Step 1: Write the failing test**

```python
# tests/test_meta_table.py
import duckdb
from pathlib import Path
from src.builder import GoRefsMasterEngine

def test_meta_table_has_build_row_and_per_source_rows(tmp_path):
    engine = GoRefsMasterEngine(raw_dumps_dir=Path("raw_dumps"))
    engine.build(output_path=tmp_path / "test.duckdb")

    con = duckdb.connect(str(tmp_path / "test.duckdb"), read_only=True)
    rows = con.execute("SELECT source, last_pulled_at FROM _meta").fetchall()
    sources = {r[0]: r[1] for r in rows}

    assert "__build__" in sources
    assert sources["__build__"]  # non-empty ISO timestamp string
    # At least one real source (alexelgt_game_masters is always fetched)
    assert "alexelgt_game_masters" in sources
```

Adjust the `GoRefsMasterEngine(...)`/`engine.build(...)` call shape to match `src/builder.py`'s actual constructor/method signatures (read the file first — the exact call in the existing test suite, e.g. `tests/test_species_claims.py`, shows the real pattern to copy).

- [x] **Step 2: Run test to verify it fails**

Run: `cd vendor/reference/GoRefs && uv run pytest tests/test_meta_table.py -v`
Expected: FAIL — no `_meta` table exists yet.

- [x] **Step 3: Implement the `_meta` table write**

In `src/builder.py`, near the existing build-timestamp line (`src/builder.py:1380`):

```python
def _write_meta_table(self, con: duckdb.DuckDBPyConnection, raw_dumps_dir: Path, build_timestamp: str) -> None:
    """Writes the _meta table: one row per source with its most recent
    raw_dumps/<source>/<timestamp>/.meta.json timestamp, plus one row
    ('__build__') for this build's own timestamp. Lets downstream
    consumers (e.g. GoBuddy's ingest:check) answer "has this changed"
    without querying the whole database."""
    con.execute("CREATE OR REPLACE TABLE _meta (source VARCHAR, last_pulled_at VARCHAR)")
    rows = [("__build__", build_timestamp)]
    for source_dir in sorted(raw_dumps_dir.iterdir()):
        if not source_dir.is_dir():
            continue
        timestamps = sorted(p.name for p in source_dir.iterdir() if p.is_dir())
        if not timestamps:
            continue
        latest = timestamps[-1]
        meta_path = source_dir / latest / ".meta.json"
        if meta_path.exists():
            meta = json.loads(meta_path.read_text())
            rows.append((source_dir.name, meta.get("timestamp", "")))
    con.executemany("INSERT INTO _meta VALUES (?, ?)", rows)
```

Call `self._write_meta_table(con, self.raw_dumps_dir, build_timestamp)` at the point in the existing build flow where `build_timestamp` is already computed (line 1380's vicinity) and `con` (the output DuckDB connection) is available — read the surrounding ~30 lines of `src/builder.py` to find the exact insertion point matching the existing code's structure, and add `import json` at the top of the file if not already imported.

- [x] **Step 4: Run test to verify it passes**

Run: `cd vendor/reference/GoRefs && uv run pytest tests/test_meta_table.py -v`
Expected: PASS

- [x] **Step 5: Run the full GoRefs test suite to check for regressions**

Run: `cd vendor/reference/GoRefs && uv run pytest -v`
Expected: all tests pass (141+ as of the last known-good count in `TODO.md`)

- [x] **Step 6: Update GoRefs' TODO.md to mark this done**

Remove (or mark done, matching the file's existing "DONE" convention seen at the top of `TODO.md`) the "Add a `_meta` table" entry, in the same working copy (`vendor/reference/GoRefs/TODO.md`).

- [x] **Step 7: Commit in GoBuddy**

```bash
git add vendor/reference/GoRefs/src/builder.py vendor/reference/GoRefs/tests/test_meta_table.py vendor/reference/GoRefs/TODO.md
git commit -m "GoRefs: add _meta table (last-pulled-per-source + last-built-at)"
```

- [x] **Step 8: Publish to GoRefs' own remote via subtree push**

```bash
git subtree push --prefix=vendor/reference/GoRefs https://github.com/theflyingfool/GoRefs.git main
```

This is required, not optional — per `docs/ingestion-runbook.md`'s "Editing GoRefs itself" section, a change committed in GoBuddy but never subtree-pushed is effectively lost from GoRefs' own repo's perspective. No `git subtree pull` is needed afterward — the edit was already made directly in the subtree, there's nothing to pull back.

---

### Task 2: Spike — verify Node DuckDB can query GoRefs over HTTP

**Files:**
- Create: `scripts/ingest/gorefs/_spike.ts` (throwaway, deleted at the end of this task — not part of the final pipeline)

**Interfaces:**
- Produces: a decision — which of the two access patterns (design doc's "Unverified assumption" section) Task 3 implements: (A) `httpfs` `ATTACH` directly over HTTP, or (B) `fetchToCache` the `.duckdb` file, then `ATTACH` the local copy.

- [ ] **Step 1: Add a Node DuckDB client dependency**

```bash
npm install --save-dev duckdb
```

(If installation fails on this platform — native bindings can be finicky — try `@duckdb/node-api` instead and adjust the import in the steps below accordingly. Record whichever one actually works; that's the dependency Task 3 uses.)

- [ ] **Step 2: Start GoRefs' server manually in a separate terminal**

```bash
cd vendor/reference/GoRefs && uv run go_refs.py --serve --port 8000
```

Confirm `curl http://localhost:8000/output/GoRefs_Master.duckdb -I` returns `200` with `Accept-Ranges: bytes` before continuing.

- [ ] **Step 3: Write the spike script — try `httpfs` ATTACH over HTTP first**

```typescript
// scripts/ingest/gorefs/_spike.ts — throwaway, delete after this task.
import duckdb from "duckdb";

const db = new duckdb.Database(":memory:");
const con = db.connect();

function run<T>(sql: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    con.all(sql, (err: Error | null, rows: T[]) => (err ? reject(err) : resolve(rows)));
  });
}

async function main() {
  await run(`INSTALL httpfs;`);
  await run(`LOAD httpfs;`);
  await run(`ATTACH 'http://localhost:8000/output/GoRefs_Master.duckdb' AS gorefs (READ_ONLY);`);

  console.log("--- species (5 rows) ---");
  const species = await run(`SELECT * FROM gorefs.refjson_species LIMIT 5;`);
  console.log(species);
  console.log("typeof dexNumber:", typeof (species[0] as Record<string, unknown>).dexNumber);

  // BigInt -> JSON.stringify check (design doc's Unverified Assumption section)
  try {
    console.log(JSON.stringify(species));
    console.log("JSON.stringify: OK");
  } catch (err) {
    console.log("JSON.stringify FAILED:", (err as Error).message);
  }

  // Latency check across a large table
  const t0 = Date.now();
  const formMoves = await run(`SELECT * FROM gorefs.refjson_form_moves;`);
  console.log(`refjson_form_moves: ${formMoves.length} rows in ${Date.now() - t0}ms`);
}

main().catch((err) => {
  console.error("httpfs ATTACH failed:", err);
  process.exit(1);
});
```

Run: `npx tsx scripts/ingest/gorefs/_spike.ts`

- [ ] **Step 4: Record the result**

One of two outcomes:

- **httpfs ATTACH works, BigInt round-trips cleanly (via `Number()` cast or similar), and `refjson_form_moves` loads in well under a few seconds** → proceed with Task 3 using pattern A (direct `httpfs` ATTACH).
- **Anything fails or is too slow** → modify the spike to use pattern B instead: replace the `ATTACH 'http://...'` line with downloading the file first —

```typescript
import { fetchToCache } from "../http-cache";
import { resolve } from "node:path";

const localPath = resolve(process.cwd(), "scripts/ingest/.cache-v2/gorefs-snapshot.duckdb");
await fetchToCache("http://localhost:8000/output/GoRefs_Master.duckdb", localPath);
await run(`ATTACH '${localPath}' AS gorefs (READ_ONLY);`);
```

Re-run and confirm this works. This is the fallback named in the design doc — it needs no `httpfs` extension and is still a plain GET against static hosting, so it survives unchanged to real hosting later.

- [ ] **Step 5: Delete the spike file, stop the manual server**

```bash
rm scripts/ingest/gorefs/_spike.ts
```

Stop the `--serve` process in the other terminal (Ctrl+C).

- [ ] **Step 6: No commit for this task** — it produced a decision (recorded in your own notes / the next task's implementation), not code. Proceed to Task 3 with pattern A or B as determined by Step 4.

---

### Task 3: GoRefs server lifecycle + generic table reader

**Files:**
- Create: `scripts/ingest/gorefs/server.ts`
- Create: `scripts/ingest/gorefs/query.ts`
- Test: `test/gorefs-server.test.ts`
- Test: `test/gorefs-query.test.ts`

**Interfaces:**
- Produces:
  - `probeOrSpawnServer(opts: { port: number; repoRoot: string }): Promise<{ port: number; ownedByUs: boolean; process?: ChildProcess }>`
  - `stopServerIfOwned(handle: { ownedByUs: boolean; process?: ChildProcess }): Promise<void>`
  - `attachGoRefs(port: number): Promise<GoRefsConnection>` where `GoRefsConnection = { queryTable<T>(tableName: string): Promise<T[]>; close(): Promise<void> }`
- Consumes: whichever DuckDB client package Task 2's spike settled on, and the access pattern (A or B) it determined.

- [ ] **Step 1: Write the failing test for the probe/spawn logic**

```typescript
// test/gorefs-server.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { probeOrSpawnServer, stopServerIfOwned } from "../scripts/ingest/gorefs/server";

test("probeOrSpawnServer detects an already-running GoRefs server and does not spawn a new one", async () => {
  // Fake a GoRefs server: respond 200 to a HEAD on /output/GoRefs_Master.duckdb
  const fake = createServer((req, res) => {
    if (req.url === "/output/GoRefs_Master.duckdb") {
      res.writeHead(200, { "Accept-Ranges": "bytes" });
      res.end();
    } else {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise<void>((resolve) => fake.listen(18234, resolve));

  const handle = await probeOrSpawnServer({ port: 18234, repoRoot: process.cwd() });
  assert.equal(handle.ownedByUs, false, "must not claim ownership of a server it didn't start");
  assert.equal(handle.process, undefined);

  await stopServerIfOwned(handle); // must be a no-op -- the fake server should still be listening
  await new Promise<void>((resolve) => fake.close(() => resolve()));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test test/gorefs-server.test.ts`
Expected: FAIL — `probeOrSpawnServer` not defined yet.

- [ ] **Step 3: Implement `scripts/ingest/gorefs/server.ts`**

```typescript
// Verifies whether a GoRefs `--serve` instance is already reachable on the
// expected port before spawning a new one -- avoids port conflicts with a
// developer's own web-explorer session, and never kills a server this
// process didn't start.

import { spawn, type ChildProcess } from "node:child_process";
import { resolve } from "node:path";

export interface ServerHandle {
  port: number;
  ownedByUs: boolean;
  process?: ChildProcess;
}

async function isGoRefsReachable(port: number): Promise<boolean> {
  try {
    const res = await fetch(`http://localhost:${port}/output/GoRefs_Master.duckdb`, { method: "HEAD" });
    return res.ok;
  } catch {
    return false;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Probes `port` for an already-running GoRefs server via a real HEAD
 * request (not just "is the TCP port open"). If nothing answers, spawns
 * `uv run go_refs.py --serve --port <port>` from the vendored subtree and
 * polls until it responds. The returned handle's `ownedByUs` tells the
 * caller whether it's responsible for shutting the process down.
 */
export async function probeOrSpawnServer(opts: { port: number; repoRoot: string }): Promise<ServerHandle> {
  const { port, repoRoot } = opts;

  if (await isGoRefsReachable(port)) {
    return { port, ownedByUs: false };
  }

  const goRefsDir = resolve(repoRoot, "vendor/reference/GoRefs");
  const child = spawn("uv", ["run", "go_refs.py", "--serve", "--port", String(port)], {
    cwd: goRefsDir,
    stdio: "ignore",
  });

  const maxAttempts = 30; // ~15s at 500ms intervals
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (await isGoRefsReachable(port)) {
      return { port, ownedByUs: true, process: child };
    }
    await sleep(500);
  }

  child.kill();
  throw new Error(`GoRefs server did not become reachable on port ${port} after ${maxAttempts * 500}ms`);
}

/** No-op if this process doesn't own the server (found one already running). */
export async function stopServerIfOwned(handle: ServerHandle): Promise<void> {
  if (handle.ownedByUs && handle.process) {
    handle.process.kill();
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test test/gorefs-server.test.ts`
Expected: PASS

- [ ] **Step 5: Write the failing test for the query layer**

```typescript
// test/gorefs-query.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { attachGoRefs } from "../scripts/ingest/gorefs/query";
import { probeOrSpawnServer, stopServerIfOwned } from "../scripts/ingest/gorefs/server";

// Integration-style: requires the vendored GoRefs subtree to have been
// built at least once (uv run go_refs.py --build inside
// vendor/reference/GoRefs). Skips gracefully if not available, matching
// this repo's existing pattern for tests that need real ingestion cache
// data (see http-cache.test.ts for precedent).
test("attachGoRefs can query a real refjson_* table and returns plain JS values, not BigInt", { skip: !process.env.GOREFS_INTEGRATION_TEST }, async () => {
  const handle = await probeOrSpawnServer({ port: 18235, repoRoot: process.cwd() });
  try {
    const conn = await attachGoRefs(handle.port);
    try {
      const rows = await conn.queryTable<{ slug: string; dexNumber: number }>("refjson_species");
      assert.ok(rows.length > 900, `expected ~1024 species, got ${rows.length}`);
      assert.equal(typeof rows[0].dexNumber, "number", "BIGINT columns must be cast to plain JS number");
      JSON.stringify(rows); // must not throw
    } finally {
      await conn.close();
    }
  } finally {
    await stopServerIfOwned(handle);
  }
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `GOREFS_INTEGRATION_TEST=1 npx tsx --test test/gorefs-query.test.ts`
Expected: FAIL — `attachGoRefs` not defined yet.

- [ ] **Step 7: Implement `scripts/ingest/gorefs/query.ts`**

Write this using whichever pattern (A: `httpfs` ATTACH over HTTP, or B: `fetchToCache` + local `ATTACH`) Task 2's spike determined. Pattern A shown; if Task 2 determined pattern B, replace the `ATTACH` call accordingly (see Task 2 Step 4's fallback code).

```typescript
// Thin wrapper around the DuckDB Node client: attaches to GoRefs' served
// database and exposes a generic per-table reader. BIGINT columns (nearly
// every refjson_* table has them) are cast to plain JS numbers here, once,
// so nothing downstream has to think about BigInt.

import duckdb from "duckdb";

export interface GoRefsConnection {
  queryTable<T>(tableName: string): Promise<T[]>;
  close(): Promise<void>;
}

function castBigInts<T>(row: Record<string, unknown>): T {
  const cast: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    cast[key] = typeof value === "bigint" ? Number(value) : value;
  }
  return cast as T;
}

export async function attachGoRefs(port: number): Promise<GoRefsConnection> {
  const db = new duckdb.Database(":memory:");
  const con = db.connect();

  const run = <T>(sql: string): Promise<T[]> =>
    new Promise((resolve, reject) => {
      con.all(sql, (err: Error | null, rows: T[]) => (err ? reject(err) : resolve(rows)));
    });

  await run(`INSTALL httpfs;`);
  await run(`LOAD httpfs;`);
  await run(`ATTACH 'http://localhost:${port}/output/GoRefs_Master.duckdb' AS gorefs (READ_ONLY);`);

  return {
    async queryTable<T>(tableName: string): Promise<T[]> {
      const rows = await run<Record<string, unknown>>(`SELECT * FROM gorefs."${tableName}";`);
      return rows.map((r) => castBigInts<T>(r));
    },
    async close(): Promise<void> {
      db.close();
    },
  };
}
```

- [ ] **Step 8: Build GoRefs and run the integration test**

```bash
cd vendor/reference/GoRefs && uv run go_refs.py --build && cd ../../..
GOREFS_INTEGRATION_TEST=1 npx tsx --test test/gorefs-query.test.ts
```

Expected: PASS. If it fails, this is exactly the spike's risk materializing late — stop and revisit Task 2's chosen pattern before continuing.

- [ ] **Step 9: Run the full test suite to check for regressions**

Run: `npm run test`
Expected: all existing tests still pass (this task added new files, didn't touch existing ones).

- [ ] **Step 10: Commit**

```bash
git add package.json package-lock.json scripts/ingest/gorefs/server.ts scripts/ingest/gorefs/query.ts test/gorefs-server.test.ts test/gorefs-query.test.ts
git commit -m "Add GoRefs server lifecycle + generic table-reader query layer"
```

---

### Task 4: Domain mapping + `buildFromGoRefs()`

**Files:**
- Create: `scripts/ingest/gorefs/domains.ts`
- Test: `test/gorefs-domains.test.ts`

**Interfaces:**
- Consumes: `GoRefsConnection.queryTable<T>(tableName)` from Task 3.
- Produces: `buildReferenceDataFromGoRefs(conn: GoRefsConnection, gen ToRegion: Record<number, string>): Promise<Omit<ReferenceData, "backgrounds">>` — the full domain-mapped assembly, minus `backgrounds` (Task 6 handles that literal) and minus `regions`/`types` (Task 6 derives those the same way `ingest.ts`'s current `build()` already does, from the assembled type/region usage).

- [ ] **Step 1: Write the failing test**

```typescript
// test/gorefs-domains.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { DOMAIN_TABLE_MAP, buildReferenceDataFromGoRefs } from "../scripts/ingest/gorefs/domains";
import type { GoRefsConnection } from "../scripts/ingest/gorefs/query";

function fakeConnection(tables: Record<string, unknown[]>): GoRefsConnection {
  return {
    queryTable: async (name) => (tables[name] ?? []) as never,
    close: async () => {},
  };
}

test("DOMAIN_TABLE_MAP sends every ReferenceData domain (except regions/types/backgrounds) to its refjson_* table", () => {
  assert.equal(DOMAIN_TABLE_MAP.species, "refjson_species");
  assert.equal(DOMAIN_TABLE_MAP.forms, "refjson_forms");
  assert.equal(DOMAIN_TABLE_MAP.formMoves, "refjson_form_moves");
  assert.equal(DOMAIN_TABLE_MAP.pvpRankRewards, "refjson_pvp_rank_rewards");
  assert.equal("regions" in DOMAIN_TABLE_MAP, false);
  assert.equal("types" in DOMAIN_TABLE_MAP, false);
  assert.equal("backgrounds" in DOMAIN_TABLE_MAP, false);
});

test("buildReferenceDataFromGoRefs assembles every mapped domain from its table", async () => {
  const conn = fakeConnection({
    refjson_species: [{ slug: "bulbasaur", dexNumber: 1 }],
    refjson_forms: [{ slug: "bulbasaur-standard" }],
    refjson_form_types: [],
    refjson_mega_variants: [],
    refjson_moves: [],
    refjson_form_moves: [],
    refjson_species_evolutions: [],
    refjson_type_effectiveness: [],
    refjson_weather_boosts: [],
    refjson_player_levels: [],
    refjson_player_level_rewards: [],
    refjson_medals: [],
    refjson_medal_tiers: [],
    refjson_friendship_levels: [],
    refjson_pvp_rank_rewards: [],
    refjson_pvp_rank_requirements: [],
  });

  const result = await buildReferenceDataFromGoRefs(conn);

  assert.deepEqual(result.species, [{ slug: "bulbasaur", dexNumber: 1 }]);
  assert.deepEqual(result.forms, [{ slug: "bulbasaur-standard" }]);
  assert.deepEqual(result.raidBosses, []);
  assert.deepEqual(result.raidBossWeatherBoosts, []);
  assert.deepEqual(result.communityDays, []);
  assert.deepEqual(result.communityDayBonuses, []);
  assert.deepEqual(result.communityDaySpecies, []);
  assert.deepEqual(result.communityDayEventMoves, []);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test test/gorefs-domains.test.ts`
Expected: FAIL — module doesn't exist yet.

- [ ] **Step 3: Implement `scripts/ingest/gorefs/domains.ts`**

```typescript
// Maps every ReferenceData domain to its GoRefs table and assembles the
// result. Every domain here reads from a refjson_* shim table -- a
// deliberate, uniform, documented choice (see the design doc's Domain
// mapping section) for this first cut, not an oversight. regions/types are
// derived elsewhere (same as today); backgrounds ships empty (also
// unchanged from today's other empty domains); raidBosses/communityDays
// ship empty because GoRefs' canonical data for them was verified unusable
// (dangling form-slug FKs / placeholder rows -- see the design doc).

import type { GoRefsConnection } from "./query";
import type { ReferenceData } from "../../../src/db/reference-data";

export const DOMAIN_TABLE_MAP = {
  species: "refjson_species",
  forms: "refjson_forms",
  formTypes: "refjson_form_types",
  megaVariants: "refjson_mega_variants",
  moves: "refjson_moves",
  formMoves: "refjson_form_moves",
  speciesEvolutions: "refjson_species_evolutions",
  typeEffectiveness: "refjson_type_effectiveness",
  weatherBoosts: "refjson_weather_boosts",
  playerLevels: "refjson_player_levels",
  playerLevelRewards: "refjson_player_level_rewards",
  medals: "refjson_medals",
  medalTiers: "refjson_medal_tiers",
  friendshipLevels: "refjson_friendship_levels",
  pvpRankRewards: "refjson_pvp_rank_rewards",
  pvpRankRequirements: "refjson_pvp_rank_requirements",
} as const;

type MappedDomains = keyof typeof DOMAIN_TABLE_MAP;

export async function buildReferenceDataFromGoRefs(
  conn: GoRefsConnection,
): Promise<Omit<ReferenceData, "regions" | "types" | "backgrounds">> {
  const entries = await Promise.all(
    (Object.keys(DOMAIN_TABLE_MAP) as MappedDomains[]).map(
      async (domain) => [domain, await conn.queryTable(DOMAIN_TABLE_MAP[domain])] as const,
    ),
  );
  const mapped = Object.fromEntries(entries) as Pick<ReferenceData, MappedDomains>;

  return {
    ...mapped,
    raidBosses: [],
    raidBossWeatherBoosts: [],
    communityDays: [],
    communityDayBonuses: [],
    communityDaySpecies: [],
    communityDayEventMoves: [],
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test test/gorefs-domains.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/ingest/gorefs/domains.ts test/gorefs-domains.test.ts
git commit -m "Add GoRefs domain-to-table mapping and ReferenceData assembly"
```

---

### Task 5: Sprite manifest extraction

**Files:**
- Modify: `scripts/ingest/transform/species.ts` — no code removed (per the dormant-pipeline decision), only a new exported function added
- Modify: `scripts/ingest/write/sprite-manifest.ts` — no change to its own logic, just confirms the new function's output type still matches `AssetPair`
- Test: `test/build-sprite-manifest.test.ts`

**Interfaces:**
- Produces: `buildSpriteManifest(pokedex: PokedexSource): Record<string, AssetPair>` in `transform/species.ts`, alongside (not replacing) the existing `buildSpecies`.
- Consumes: `PokedexSource` (`sources/pokemon-go-api.ts`, already exists), `slugFor`/`formTokenFromFormId` (already exported from `transform/species.ts`), `formSlug`/`megaVariantSlug` (`../slug`, already exist).

- [ ] **Step 1: Read the exact extraction source**

Read `scripts/ingest/transform/species.ts` lines 296-450 (the full `buildSpecies` body) to find every place it writes into `spriteManifest[...]` — confirmed so far: line 407 (`if (entry.assets) spriteManifest[slug] = entry.assets;`, species-level) and further lines handling per-form `assetForms` entries and `megaEvolutions` assets (read the rest of the function body past line 450 to find these — they follow the same `spriteManifest[<slug>] = <AssetPair>` pattern).

- [ ] **Step 2: Write the failing test**

```typescript
// test/build-sprite-manifest.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSpriteManifest } from "../scripts/ingest/transform/species";
import { createPokedexSource, type PokedexEntry } from "../scripts/ingest/sources/pokemon-go-api";

test("buildSpriteManifest maps a species-level slug to its asset URLs, independent of GAME_MASTER/shiny data", () => {
  const entries: PokedexEntry[] = [
    {
      id: "BULBASAUR",
      formId: "BULBASAUR",
      dexNr: 1,
      names: { English: "Bulbasaur" },
      assets: { image: "https://example.com/pm1.png", shinyImage: "https://example.com/pm1.s.png" },
    },
  ];
  const pokedex = createPokedexSource(entries);

  const manifest = buildSpriteManifest(pokedex);

  assert.deepEqual(manifest["bulbasaur"], {
    image: "https://example.com/pm1.png",
    shinyImage: "https://example.com/pm1.s.png",
  });
});
```

(Confirm the expected slug string `"bulbasaur"` against what `slugFor("BULBASAUR")` actually returns — read `slugFor`'s implementation, `transform/species.ts:137`, and adjust the assertion to match its real output exactly rather than guessing.)

- [ ] **Step 3: Run test to verify it fails**

Run: `npx tsx --test test/build-sprite-manifest.test.ts`
Expected: FAIL — `buildSpriteManifest` not exported yet.

- [ ] **Step 4: Extract `buildSpriteManifest` from `buildSpecies`**

Add a new exported function to `transform/species.ts` (do not remove anything from `buildSpecies` — this is an addition, copying the sprite-manifest-building lines into a new standalone function):

```typescript
/**
 * Builds the slug -> sprite-source-URL manifest independent of building
 * full Species/Form rows. Extracted from buildSpecies (still present,
 * dormant) so the default GoRefs-backed pipeline can get sprite URLs
 * without needing GAME_MASTER or the shiny sheet at all -- this slice only
 * ever read entry.assets/assetForms/megaEvolutions, never gameMaster or
 * shinySheet.
 */
export function buildSpriteManifest(pokedex: PokedexSource): Record<string, AssetPair> {
  const spriteManifest: Record<string, AssetPair> = {};
  const entries = pokedex.all();

  for (const entry of entries) {
    const slug = slugFor(entry.id);
    if (entry.assets) spriteManifest[slug] = entry.assets;
    // Copy the equivalent per-form (assetForms) and per-mega-variant
    // (megaEvolutions) assignment logic found in buildSpecies (same file,
    // below line 450) verbatim here -- same slug-construction calls
    // (formSlug/megaVariantSlug/formTokenFromFormId), same
    // spriteManifest[<slug>] = <AssetPair> assignment pattern, just without
    // also constructing Species/Form/MegaVariant rows alongside it.
  }

  return spriteManifest;
}
```

Fill in the per-form and per-mega-variant loops by copying the real logic from `buildSpecies`'s existing body (found in Step 1) — this must be a faithful copy of the existing, working slug-matching logic, not a reimplementation from scratch.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx tsx --test test/build-sprite-manifest.test.ts`
Expected: PASS

- [ ] **Step 6: Add a species-level coverage test too**

```typescript
test("buildSpriteManifest covers every species-level slug the pokedex provides assets for", () => {
  const entries: PokedexEntry[] = [
    { id: "BULBASAUR", formId: "BULBASAUR", dexNr: 1, names: { English: "Bulbasaur" }, assets: { image: "https://example.com/pm1.png" } },
    { id: "IVYSAUR", formId: "IVYSAUR", dexNr: 2, names: { English: "Ivysaur" }, assets: { image: "https://example.com/pm2.png" } },
  ];
  const manifest = buildSpriteManifest(createPokedexSource(entries));
  assert.equal(Object.keys(manifest).length, 2);
});
```

Run: `npx tsx --test test/build-sprite-manifest.test.ts` — expect PASS.

- [ ] **Step 7: Run the full test suite to check for regressions**

Run: `npm run test`
Expected: all existing tests (including `transform-species.test.ts`, unaffected since nothing was removed) still pass.

- [ ] **Step 8: Commit**

```bash
git add scripts/ingest/transform/species.ts test/build-sprite-manifest.test.ts
git commit -m "Extract buildSpriteManifest from buildSpecies for the GoRefs-backed pipeline"
```

---

### Task 6: Wire the new pipeline into `ingest.ts`, drop fake `backgrounds`

**Files:**
- Modify: `scripts/ingest/ingest.ts`

**Interfaces:**
- Consumes: `probeOrSpawnServer`/`stopServerIfOwned` (Task 3), `attachGoRefs` (Task 3), `buildReferenceDataFromGoRefs` (Task 4), `buildSpriteManifest` (Task 5).
- Produces: the default `PipelineStep[]` in `main()` now calls new `fetchAndAttachGoRefs`/`buildFromGoRefs` steps; old `fetchAll`/`build` are renamed `fetchAllFromGameMaster`/`buildFromGameMaster`, exported, unused by the default steps list.

- [ ] **Step 1: Rename the old functions**

In `scripts/ingest/ingest.ts`, rename `fetchAll` → `fetchAllFromGameMaster` and `build` → `buildFromGameMaster` (the function declarations only — their bodies are unchanged). Keep them exported.

- [ ] **Step 2: Write the new `buildFromGoRefs` step**

```typescript
// Default pipeline step, replacing fetchAllFromGameMaster + buildFromGameMaster.
// See docs/superpowers/specs/2026-08-03-gorefs-ingestion-source-swap-design.md
// for the full rationale. fetchAllFromGameMaster/buildFromGameMaster stay
// defined above, dormant -- a manual reactivation path per domain if the
// refjson_* freeze becomes a real problem before GoRefs promotes domains to
// canonical.
import { probeOrSpawnServer, stopServerIfOwned } from "./gorefs/server";
import { attachGoRefs } from "./gorefs/query";
import { buildReferenceDataFromGoRefs } from "./gorefs/domains";
import { buildSpriteManifest } from "./transform/species";

const GOREFS_PORT = 8000;

async function buildFromGoRefs(): Promise<ReferenceData> {
  console.log("Connecting to GoRefs...");
  const handle = await probeOrSpawnServer({ port: GOREFS_PORT, repoRoot: REPO_ROOT });
  const conn = await attachGoRefs(handle.port);

  let mapped: Awaited<ReturnType<typeof buildReferenceDataFromGoRefs>>;
  try {
    mapped = await buildReferenceDataFromGoRefs(conn);
  } finally {
    await conn.close();
    await stopServerIfOwned(handle);
  }

  const allTypeSlugs = new Set([
    ...mapped.formTypes.map((ft) => ft.typeSlug),
    ...mapped.moves.map((m) => m.typeSlug),
    ...mapped.typeEffectiveness.flatMap((te) => [te.attackingTypeSlug, te.defendingTypeSlug]),
    ...mapped.weatherBoosts.map((wb) => wb.typeSlug),
  ]);

  const referenceData: ReferenceData = {
    regions: [...new Set(mapped.species.map((s) => s.regionSlug))].map((slug) => ({ slug, name: capitalize(slug) })),
    types: [...allTypeSlugs].map((slug) => ({ slug, name: capitalize(slug) })),
    backgrounds: [], // no fake hardcoded rows -- see design doc's backgrounds row
    ...mapped,
  };

  console.log("Fetching pokedex for sprite manifest...");
  await fetchToCache(
    "https://pokemon-go-api.github.io/pokemon-go-api/api/pokedex.json",
    resolve(CACHE_V2_ROOT, "pgapi/pokedex.json"),
  );
  const pokedex = createPokedexSource(loadJson<PokedexEntry[]>("pgapi/pokedex.json"));
  const spriteManifest = buildSpriteManifest(pokedex);

  const missingSpriteSlugs = [...referenceData.species.map((s) => s.slug), ...referenceData.forms.map((f) => f.slug)].filter(
    (slug) => !(slug in spriteManifest),
  );
  if (missingSpriteSlugs.length > 0) {
    console.warn(
      `Warning: ${missingSpriteSlugs.length} slug(s) have no sprite-manifest entry (will fall back to species-level art or no art): ${missingSpriteSlugs.slice(0, 10).join(", ")}${missingSpriteSlugs.length > 10 ? "..." : ""}`,
    );
  }

  const spriteManifestPath = writeSpriteManifest(spriteManifest);
  const writeResult = writeReferenceJson(referenceData);

  console.log(`Wrote ${referenceData.species.length} species, ${referenceData.forms.length} forms.`);
  console.log(`Sprite manifest: ${Object.keys(spriteManifest).length} slugs -> ${spriteManifestPath}`);
  console.log(`Reference data version: ${writeResult.referenceDataVersion}`);
  console.log(`-> ${writeResult.outPath}`);

  return referenceData;
}
```

Note: `regions` is now derived from `mapped.species.map(s => s.regionSlug)` (present on `refjson_species` rows directly) rather than `GEN_TO_REGION` — since GoRefs' `refjson_species` already carries `regionSlug` per row, there's no need to re-derive it from `gen` via the `GEN_TO_REGION` map for this step (that map stays defined and used only by the still-dormant `buildFromGameMaster`).

- [ ] **Step 2b: Add the missing imports**

At the top of `ingest.ts`, add imports for `probeOrSpawnServer`/`stopServerIfOwned`/`attachGoRefs`/`buildReferenceDataFromGoRefs`/`buildSpriteManifest` per Step 2's code, alongside the existing `createPokedexSource`/`PokedexEntry` imports (already present for the now-dormant path — reused here for sprites).

- [ ] **Step 3: Rewire the default pipeline steps**

In `main()`'s `steps: PipelineStep[]` array, replace the `{ name: "fetch", run: fetchAllFromGameMaster }` and the `build` step's `run: async () => { referenceData = await buildFromGameMaster(); }` with:

```typescript
const steps: PipelineStep[] = [
  {
    name: "build",
    run: async () => {
      referenceData = await buildFromGoRefs();
    },
  },
  {
    name: "slug-check",
    run: async () => {
      if (!referenceData) throw new Error("slug-check ran before build");
      await checkSlugStability(referenceData);
    },
  },
  { name: "sqlite", run: async () => { /* unchanged */ }, skip: (f) => f.skipSqlite },
  { name: "manifest", run: manifest },
];
```

(Drop the separate `"fetch"` step entirely — `buildFromGoRefs` now does its own fetching (GoRefs connection + the one pokedex.json fetch for sprites) inline, matching the design doc's "one new step replaces fetch and build" architecture. Drop the standalone `"sprites"` step too — sprite *manifest* building now happens inside `buildFromGoRefs`, but the actual sprite *download+convert* (`fetchSprites()`/`buildSprites()`) should still run as its own step afterward, unchanged; keep that step, just after `"build"`.)

- [ ] **Step 4: Update `test/ingest-pipeline.test.ts` if needed**

Re-read the existing tests (shown earlier) — they operate on fake `PipelineStep[]` arrays passed directly to `runPipeline`, not on `main()`'s real steps list, so they should be unaffected. Run them to confirm:

Run: `npx tsx --test test/ingest-pipeline.test.ts`
Expected: PASS, unchanged.

- [ ] **Step 5: Run a real end-to-end ingest**

```bash
cd vendor/reference/GoRefs && uv run go_refs.py --build && cd ../../..
npm run ingest -- --skip-sprites --skip-sqlite
```

Expected: completes without error, `src/data/reference.json` is rewritten, console output shows species/form counts matching GoRefs' `refjson_species`/`refjson_forms` row counts (1024 species, 2716 forms).

- [ ] **Step 6: Run the full test suite**

Run: `npm run test`
Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add scripts/ingest/ingest.ts
git commit -m "Wire GoRefs-backed pipeline into ingest.ts's default steps; drop fake backgrounds"
```

---

### Task 7: Manifest / freshness check rework

**Files:**
- Modify: `scripts/ingest/write/manifest.ts`
- Modify: `test/write-manifest.test.ts`

**Interfaces:**
- Produces: `IngestionManifest` gains a `gorefs: { lastBuiltAt: string; fetchedAt: string }` field. The old `gameMaster`/`pokemonGoApi`/`shinySheet` fields stay in the type (dormant path still uses them if reactivated) but the default `buildManifest()` populates `gorefs` and leaves the others as empty/placeholder values when GoRefs' `_meta` table is queried instead.

- [ ] **Step 1: Write the failing test**

```typescript
// Add to test/write-manifest.test.ts (read the existing file first to match its exact fixture/mocking conventions before adding this)
test("buildManifest reads GoRefs' _meta.last_built_at when available", async () => {
  // Follow this file's existing pattern for mocking attachGoRefs/queryTable
  // (read the top of write-manifest.test.ts to see how it currently mocks
  // fetch/http-cache, and mirror that same style here rather than
  // introducing a new mocking approach).
  const manifest = await buildManifest();
  assert.ok(manifest.gorefs.lastBuiltAt, "expected a non-empty GoRefs build timestamp");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test test/write-manifest.test.ts`
Expected: FAIL — `manifest.gorefs` undefined.

- [ ] **Step 3: Implement the manifest change**

In `scripts/ingest/write/manifest.ts`, add to `IngestionManifest`:

```typescript
export interface IngestionManifest {
  gameMaster: { commitSha: string; fetchedAt: string };
  pokemonGoApi: { files: Record<string, string>; fetchedAt: string };
  shinySheet: { contentHash: string; fetchedAt: string };
  gorefs: { lastBuiltAt: string; fetchedAt: string };
}
```

And in `buildManifest()`, add a GoRefs query using the same `probeOrSpawnServer`/`attachGoRefs` pattern Task 6 established, falling back to a content-hash-based placeholder if unreachable (per the design doc's "interim measure" note):

```typescript
async function fetchGoRefsLastBuiltAt(): Promise<string> {
  const handle = await probeOrSpawnServer({ port: 8000, repoRoot: REPO_ROOT });
  const conn = await attachGoRefs(handle.port);
  try {
    const rows = await conn.queryTable<{ source: string; last_pulled_at: string }>("_meta");
    return rows.find((r) => r.source === "__build__")?.last_pulled_at ?? "";
  } finally {
    await conn.close();
    await stopServerIfOwned(handle);
  }
}
```

Call this from `buildManifest()` and populate the new `gorefs` field; leave `gameMaster`/`pokemonGoApi`/`shinySheet` populated with empty-string placeholders (`{ commitSha: "", fetchedAt }`, etc.) rather than removing them, since the dormant `fetchAllFromGameMaster`/`buildFromGameMaster` path still expects the full shape if ever manually reactivated.

- [ ] **Step 4: Update `diffManifests` to compare the new field**

Add to `diffManifests`:

```typescript
if (before.gorefs.lastBuiltAt !== after.gorefs.lastBuiltAt) {
  diffs.push(`GoRefs: ${before.gorefs.lastBuiltAt} -> ${after.gorefs.lastBuiltAt}`);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx tsx --test test/write-manifest.test.ts`
Expected: PASS

- [ ] **Step 6: Run `ingest:check` for real**

```bash
npm run ingest:check
```

Expected: runs without error, reports whether GoRefs' `_meta.last_built_at` changed since the last committed manifest.

- [ ] **Step 7: Run the full test suite**

Run: `npm run test`
Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add scripts/ingest/write/manifest.ts test/write-manifest.test.ts
git commit -m "Rework manifest freshness check to use GoRefs' _meta.last_built_at"
```

---

### Task 8: Documentation closing phase

**Files:**
- Modify: `docs/architecture.md` (Scripts table entries for `ingest.ts`, the removed-from-default `sources/*`/`transform/*` rows get a "dormant, not in default pipeline" note rather than deletion)
- Modify: `docs/ingestion-runbook.md` (update the pipeline-order description to reflect the GoRefs-backed default; the existing GoRefs-subtree section already references this plan, update it to say "implemented" instead of "planned")
- Modify: `docs/roadmap.md` (Phase 0 entry: note the GoRefs-sourced pipeline as shipped)

- [ ] **Step 1: Update `docs/architecture.md`**

In the Scripts table, update the `ingest/ingest.ts` row to describe the new default (GoRefs-backed) pipeline. Add a note next to `sources/game-master.ts`, `sources/shiny-sheet.ts`, `sources/pogoapi-badges.ts`, `sources/pokemon-go-api.ts`, and the `transform/*.ts` files still present but dormant: "not called by the default `npm run ingest` pipeline as of the GoRefs swap — kept as a manual reactivation path, see the design doc."

- [ ] **Step 2: Update `docs/ingestion-runbook.md`**

Rewrite the "Order" section's numbered steps to describe: build (queries GoRefs, no separate fetch step), slug-check, sprites, sqlite, manifest — matching Task 6's actual final `steps` array. Update the `GoRefs` subtree section (added earlier this project) to say the swap described there is now implemented, linking to this plan file.

- [ ] **Step 3: Update `docs/roadmap.md`**

In Phase 0's entry, add a note that the GoRefs-sourced pipeline swap has shipped, linking to `docs/superpowers/specs/2026-08-03-gorefs-ingestion-source-swap-design.md` and this plan.

- [ ] **Step 4: Commit**

```bash
git add docs/architecture.md docs/ingestion-runbook.md docs/roadmap.md
git commit -m "Update docs for the GoRefs-backed default ingestion pipeline"
```

---

## Self-Review Notes

- **Spec coverage:** Architecture/data-flow (Tasks 3-6), domain mapping (Task 4), sprite carve-out + slug-drift risk (Task 5), frozen-data/dormant-pipeline decision (Tasks 1-8 collectively — nothing deleted), manifest/freshness (Tasks 1, 7), unverified assumption + fallback (Task 2), error handling (Task 3's probe/spawn, Task 6's missing-sprite warning), testing (every task has one), closing-phase docs (Task 8) — all covered. `reference.sqlite` bundling, screenshot onboarding, and the settings-page update-check are explicitly out of scope per the design doc and have no task here.
- **Type consistency:** `GoRefsConnection` (Task 3) is consumed identically in Tasks 4, 6, 7. `DOMAIN_TABLE_MAP`/`buildReferenceDataFromGoRefs` (Task 4) return shape matches what Task 6's `buildFromGoRefs` spreads into `ReferenceData`. `buildSpriteManifest` (Task 5) returns `Record<string, AssetPair>`, matching `writeSpriteManifest`'s existing parameter type unchanged.
- **Placeholder scan:** no TBD/TODO markers left in code steps; Task 5's per-form/mega-variant loop is the one intentionally-incomplete code block, but it's scoped as "copy this existing, specific, already-working logic" with an exact pointer to where it lives, not "add appropriate handling."
