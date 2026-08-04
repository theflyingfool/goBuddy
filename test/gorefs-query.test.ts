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
