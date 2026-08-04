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
