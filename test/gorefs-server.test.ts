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
