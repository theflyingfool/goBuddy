import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { buildManifest, diffManifests, writeManifest, writeManifestToDisk, MANIFEST_PATH, type IngestionManifest } from "../scripts/ingest/write/manifest";
import { CACHE_V2_ROOT } from "../scripts/ingest/http-cache";
import { probeOrSpawnServer, stopServerIfOwned } from "../scripts/ingest/gorefs/server";

function withFetchStub<T>(impl: typeof fetch, run: () => Promise<T>): Promise<T> {
  const original = globalThis.fetch;
  globalThis.fetch = impl;
  return run().finally(() => {
    globalThis.fetch = original;
  });
}

function manifestAt(overrides: Partial<IngestionManifest> = {}): IngestionManifest {
  return {
    gameMaster: { commitSha: "abc123", fetchedAt: "2026-01-01T00:00:00.000Z" },
    pokemonGoApi: { files: { "pgapi/pokedex.json": "hash1" }, fetchedAt: "2026-01-01T00:00:00.000Z" },
    shinySheet: { contentHash: "hash2", fetchedAt: "2026-01-01T00:00:00.000Z" },
    gorefs: { lastBuiltAt: "2026-01-01T00:00:00.000Z", fetchedAt: "2026-01-01T00:00:00.000Z" },
    ...overrides,
  };
}

test("diffManifests reports no diffs when manifests are identical", () => {
  const a = manifestAt();
  const b = manifestAt();
  assert.deepEqual(diffManifests(a, b), []);
});

test("diffManifests reports a GAME_MASTER commit SHA change", () => {
  const before = manifestAt({ gameMaster: { commitSha: "abc123", fetchedAt: "2026-01-01T00:00:00.000Z" } });
  const after = manifestAt({ gameMaster: { commitSha: "def456", fetchedAt: "2026-01-02T00:00:00.000Z" } });
  const diffs = diffManifests(before, after);
  assert.equal(diffs.length, 1);
  assert.match(diffs[0], /GAME_MASTER: abc123 -> def456/);
});

test("diffManifests reports a per-file pokemon-go-api hash change", () => {
  const before = manifestAt({ pokemonGoApi: { files: { "pgapi/pokedex.json": "h1", "pgapi/types.json": "h2" }, fetchedAt: "x" } });
  const after = manifestAt({ pokemonGoApi: { files: { "pgapi/pokedex.json": "h1-new", "pgapi/types.json": "h2" }, fetchedAt: "y" } });
  const diffs = diffManifests(before, after);
  assert.equal(diffs.length, 1);
  assert.match(diffs[0], /pgapi\/pokedex\.json: h1 -> h1-new/);
});

test("diffManifests reports a shiny sheet content-hash change", () => {
  const before = manifestAt({ shinySheet: { contentHash: "old", fetchedAt: "x" } });
  const after = manifestAt({ shinySheet: { contentHash: "new", fetchedAt: "y" } });
  const diffs = diffManifests(before, after);
  assert.equal(diffs.length, 1);
  assert.match(diffs[0], /shiny sheet: old -> new/);
});

test("diffManifests reports a GoRefs last-built-at change", () => {
  const before = manifestAt({ gorefs: { lastBuiltAt: "2026-01-01T00:00:00.000Z", fetchedAt: "x" } });
  const after = manifestAt({ gorefs: { lastBuiltAt: "2026-01-02T00:00:00.000Z", fetchedAt: "y" } });
  const diffs = diffManifests(before, after);
  assert.equal(diffs.length, 1);
  assert.match(diffs[0], /GoRefs: 2026-01-01T00:00:00\.000Z -> 2026-01-02T00:00:00\.000Z/);
});

test("diffManifests reports multiple simultaneous changes", () => {
  const before = manifestAt();
  const after = manifestAt({
    gameMaster: { commitSha: "different", fetchedAt: "y" },
    shinySheet: { contentHash: "different", fetchedAt: "y" },
  });
  const diffs = diffManifests(before, after);
  assert.equal(diffs.length, 2);
});

test("buildManifest returns empty-string placeholders for the dormant GAME_MASTER/pokemon-go-api/shiny-sheet fields, and an empty gorefs.lastBuiltAt when GoRefs isn't reachable", async () => {
  // Stubs the reachability probe's fetch to simulate "no GoRefs server up"
  // -- deterministic and fast, not dependent on whether a real GoRefs
  // --serve happens to be running on this machine right now.
  const manifest = await withFetchStub((async () => ({ ok: false }) as unknown as Response) as typeof fetch, () => buildManifest());

  assert.equal(manifest.gameMaster.commitSha, "");
  assert.equal(manifest.pokemonGoApi.files["pgapi/pokedex.json"], "");
  assert.equal(manifest.shinySheet.contentHash, "");
  assert.equal(manifest.gorefs.lastBuiltAt, "");
  assert.ok(manifest.gorefs.fetchedAt);
});

test("buildManifest never writes ingestion-manifest.json to disk, even though its result differs from what's already there (--check mode's use case)", async () => {
  // Simulates the --check scenario the review flagged: a manifest already
  // sits on disk (e.g. from a prior real `ingest` run) with different
  // values than what buildManifest is about to compute (a "diff would be
  // detected" case) -- buildManifest must still leave the file untouched.
  const manifestExistedBefore = existsSync(MANIFEST_PATH);
  const priorContent = manifestExistedBefore ? readFileSync(MANIFEST_PATH, "utf-8") : undefined;

  try {
    mkdirSync(resolve(MANIFEST_PATH, ".."), { recursive: true });
    const staleManifest = manifestAt({ gorefs: { lastBuiltAt: "stale-timestamp", fetchedAt: "2020-01-01T00:00:00.000Z" } });
    writeFileSync(MANIFEST_PATH, JSON.stringify(staleManifest, null, 2));
    const beforeCall = readFileSync(MANIFEST_PATH, "utf-8");

    await withFetchStub((async () => ({ ok: false }) as unknown as Response) as typeof fetch, () => buildManifest());

    const afterCall = readFileSync(MANIFEST_PATH, "utf-8");
    assert.equal(afterCall, beforeCall, "buildManifest must not write to disk under any circumstance");
  } finally {
    if (priorContent === undefined) rmSync(MANIFEST_PATH, { force: true });
    else writeFileSync(MANIFEST_PATH, priorContent, "utf-8");
  }
});

test("writeManifestToDisk writes exactly the manifest object it's given", () => {
  // Targets a scratch path (not the real tracked MANIFEST_PATH) via the
  // optional `path` param, so this test can't touch tracked repo state even
  // on a hard process abort.
  const scratchPath = resolve(CACHE_V2_ROOT, "ingestion-manifest.test-scratch.json");
  try {
    const manifest = manifestAt({ gorefs: { lastBuiltAt: "written-timestamp", fetchedAt: "2026-03-03T00:00:00.000Z" } });
    writeManifestToDisk(manifest, scratchPath);
    const onDisk = JSON.parse(readFileSync(scratchPath, "utf-8")) as IngestionManifest;
    assert.deepEqual(onDisk, manifest);
  } finally {
    rmSync(scratchPath, { force: true });
  }
});

test("writeManifest (the real ingest/build path) still writes the manifest it computed to disk", async () => {
  const manifestExistedBefore = existsSync(MANIFEST_PATH);
  const priorContent = manifestExistedBefore ? readFileSync(MANIFEST_PATH, "utf-8") : undefined;

  try {
    const returned = await withFetchStub((async () => ({ ok: false }) as unknown as Response) as typeof fetch, () => writeManifest());

    const onDisk = JSON.parse(readFileSync(MANIFEST_PATH, "utf-8")) as IngestionManifest;
    assert.deepEqual(onDisk, returned);
    assert.equal(onDisk.gorefs.lastBuiltAt, "");
  } finally {
    if (priorContent === undefined) rmSync(MANIFEST_PATH, { force: true });
    else writeFileSync(MANIFEST_PATH, priorContent, "utf-8");
  }
});

// Integration-style: requires a real GoRefs --serve reachable on port 8000
// (or one this test spawns itself). Skips gracefully when not requested,
// matching test/gorefs-query.test.ts's precedent for tests that need the
// real vendored GoRefs build.
test(
  "buildManifest reads GoRefs' _meta.last_built_at when a real server is reachable",
  { skip: !process.env.GOREFS_INTEGRATION_TEST },
  async () => {
    const handle = await probeOrSpawnServer({ port: 8000, repoRoot: process.cwd() });
    try {
      const manifest = await buildManifest();
      assert.ok(manifest.gorefs.lastBuiltAt, "expected a non-empty GoRefs build timestamp");
    } finally {
      await stopServerIfOwned(handle);
    }
  },
);
