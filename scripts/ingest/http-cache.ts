// Generic fetch-and-cache helper for the V2 sourcing spike (pogoapi.net +
// pokemon-go-api). Same idea as pokeapi-client.ts's disk-cache-by-id
// pattern, generalized to an arbitrary URL -> arbitrary cache file path,
// since these sources aren't one-resource-per-id like PokeAPI.
//
// Not part of the real ingestion pipeline — see docs/v2-schema-design.md
// and the V2 ingestion plan. Cache root: scripts/ingest/.cache-v2/
// (gitignored, same convention as .cache/).

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const CACHE_V2_ROOT = resolve(__dirname, ".cache-v2");

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Downloads `url` to `cachePath` (absolute path) unless it already exists.
 * No retries/backoff — these are static JSON/CDN-hosted assets, not a
 * rate-limited API; a plain failure is loud and re-runnable (resumable —
 * already-downloaded files are skipped on the next run).
 */
export async function fetchToCache(url: string, cachePath: string): Promise<void> {
  if (existsSync(cachePath)) return;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Fetch failed: ${res.status} ${res.statusText} for ${url}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  mkdirSync(dirname(cachePath), { recursive: true });
  writeFileSync(cachePath, buf);
}

/**
 * Runs `items` through `worker` with at most `concurrency` in flight at
 * once, and a small delay between dispatches — polite default for hitting
 * many small files on someone else's GitHub Pages / raw.githubusercontent
 * hosting, not a documented-limit API like PokeAPI.
 */
export async function withConcurrency<T>(items: T[], concurrency: number, worker: (item: T, index: number) => Promise<void>): Promise<void> {
  let cursor = 0;
  let failures = 0;

  async function runOne() {
    while (cursor < items.length) {
      const index = cursor++;
      try {
        await worker(items[index], index);
      } catch (err) {
        failures++;
        console.warn(`  [http-cache] item ${index} failed: ${(err as Error).message}`);
      }
      await sleep(20);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => runOne()));

  if (failures > 0) {
    console.warn(`  [http-cache] ${failures}/${items.length} item(s) failed — re-run to retry (already-downloaded files are skipped).`);
  }
}
