// Writes scripts/ingest/.cache-v2/ingestion-manifest.json, a small,
// committed (see .gitignore's negation for this one file inside the
// otherwise-gitignored .cache-v2/) record of exactly which upstream source
// snapshot the last ingest run consumed.
//
// Default (GoRefs-backed) pipeline: `gorefs.lastBuiltAt`, GoRefs' own `_meta`
// table's `__build__` row (see Task 1) -- the one real "has anything
// changed" signal for the default pipeline, since it no longer fetches
// GAME_MASTER/pokemon-go-api/the shiny sheet directly. Those three fields
// stay on IngestionManifest with empty-string placeholders (not removed):
// the dormant GAME_MASTER-based path (buildFromGameMaster, see ingest.ts)
// still expects the full shape if ever manually reactivated, and its own
// fingerprinting logic (fetchGameMasterCommitSha, content-hash sidecars) is
// kept for that path, just not called from the default buildManifest below.
//
// `ingest.ts --check` builds a manifest *in memory only* (never written to
// disk -- see buildManifest's doc comment), and diffs it against the last
// *committed* one (git show HEAD:...) to answer "did GoRefs' database
// change since the reference data currently shipped was built" without
// running the (much slower) build/slug-check/sprite steps.

import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CACHE_V2_ROOT } from "../http-cache";
import { PGAPI_FILES } from "../sources/pokemon-go-api";
import { isGoRefsReachable } from "../gorefs/server";
import { attachGoRefs } from "../gorefs/query";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const REPO_ROOT = resolve(__dirname, "../../..");
const MANIFEST_CACHE_RELATIVE_PATH = "ingestion-manifest.json";
const MANIFEST_PATH = resolve(CACHE_V2_ROOT, MANIFEST_CACHE_RELATIVE_PATH);
// Git-relative path used both for the negated .gitignore entry and for
// `git show HEAD:<path>` below.
const MANIFEST_REPO_RELATIVE_PATH = "scripts/ingest/.cache-v2/ingestion-manifest.json";

const GAME_MASTER_COMMITS_API = "https://api.github.com/repos/alexelgt/game_masters/commits?path=GAME_MASTER.json&per_page=1";
const GOREFS_PORT = 8000;

export interface IngestionManifest {
  gameMaster: { commitSha: string; fetchedAt: string };
  pokemonGoApi: { files: Record<string, string>; fetchedAt: string };
  shinySheet: { contentHash: string; fetchedAt: string };
  gorefs: { lastBuiltAt: string; fetchedAt: string };
}

/** GitHub requires a User-Agent header on unauthenticated REST calls or it 403s. Only used by the dormant GAME_MASTER-based path (buildFromGameMaster) if manually reactivated -- the default pipeline no longer fetches GAME_MASTER directly, so this is not called from buildManifest below. */
export async function fetchGameMasterCommitSha(): Promise<string> {
  const res = await fetch(GAME_MASTER_COMMITS_API, { headers: { "User-Agent": "pogo-buddy-ingest" } });
  if (!res.ok) throw new Error(`GitHub commits API failed: ${res.status} ${res.statusText}`);
  const commits = (await res.json()) as { sha: string }[];
  const sha = commits[0]?.sha;
  if (!sha) throw new Error("GitHub commits API returned no commits for GAME_MASTER.json");
  return sha;
}

/**
 * Reads GoRefs' `_meta` table's `__build__` row (see Task 1's _meta table)
 * -- the cheap "has GoRefs' database actually changed" signal this pipeline
 * now depends on, instead of re-deriving fingerprints for sources it no
 * longer fetches directly. Deliberately does NOT spawn a server if none is
 * already reachable (unlike buildFromGoRefs's probeOrSpawnServer): `--check`
 * mode's whole point is staying cheap (it exists specifically to avoid the
 * much slower build/slug-check/sprite steps), so this must not block for
 * probeOrSpawnServer's up-to-15s spawn-and-poll on every check. Falls back
 * to an empty string, not a thrown error, when GoRefs isn't already
 * running.
 *
 * Known consequence: since buildFromGoRefs's own build step tears down any
 * server *it* spawned before this "manifest" pipeline step runs, a plain
 * `npm run ingest` on a machine with no persistent GoRefs `--serve` already
 * up will usually get an empty lastBuiltAt here too -- the real signal only
 * populates today when a developer already has GoRefs' web explorer (or
 * similar) running. Sharing one server handle across the whole ingest run
 * instead of per-step would fix this properly; out of scope for this pass.
 */
async function fetchGoRefsLastBuiltAt(): Promise<string> {
  if (!(await isGoRefsReachable(GOREFS_PORT))) return "";
  try {
    const conn = await attachGoRefs(GOREFS_PORT);
    try {
      const rows = await conn.queryTable<{ source: string; last_pulled_at: string }>("_meta");
      return rows.find((r) => r.source === "__build__")?.last_pulled_at ?? "";
    } finally {
      await conn.close();
    }
  } catch {
    return "";
  }
}

/**
 * Builds (but does NOT write to disk) the manifest: a fresh read of GoRefs'
 * `_meta.__build__` row (empty string if GoRefs isn't already reachable),
 * plus empty-string placeholders for the dormant GAME_MASTER path's fields.
 *
 * `--check` mode calls this directly and diffs the in-memory result against
 * the last *committed* manifest -- it must never write
 * ingestion-manifest.json to disk, since every call produces a different
 * `fetchedAt` even when nothing upstream actually changed. Writing on every
 * `--check` run would make a routine `git add`/commit after checking commit
 * a manifest describing a fetch that never produced a corresponding
 * reference.json rebuild, permanently defeating the next check's diff. Only
 * `writeManifest` (the real ingest/build path) should touch disk.
 */
export async function buildManifest(): Promise<IngestionManifest> {
  const fetchedAt = new Date().toISOString();
  const lastBuiltAt = await fetchGoRefsLastBuiltAt();

  // GAME_MASTER/pokemon-go-api/shiny-sheet fingerprinting stays defined on
  // IngestionManifest (the dormant fetchAllFromGameMaster/buildFromGameMaster
  // path still expects the full shape if ever manually reactivated) but the
  // default pipeline no longer fetches those sources directly, so there's
  // nothing real to fingerprint here -- empty-string placeholders, not a
  // live GitHub API call or stale sidecar reads for files this run never
  // touched.
  const files: Record<string, string> = {};
  for (const relPath of Object.keys(PGAPI_FILES)) files[relPath] = "";

  return {
    gameMaster: { commitSha: "", fetchedAt },
    pokemonGoApi: { files, fetchedAt },
    shinySheet: { contentHash: "", fetchedAt },
    gorefs: { lastBuiltAt, fetchedAt },
  };
}

/** Thin disk-write step, kept separate from `buildManifest` so `--check` mode can build a manifest for its diff without ever writing it. Only the real ingest/build path (ingest.ts's `manifest` step) should call this. `path` defaults to the real tracked manifest path; overridable so tests can target a scratch file instead of the tracked one. */
export function writeManifestToDisk(manifest: IngestionManifest, path: string = MANIFEST_PATH): void {
  writeFileSync(path, JSON.stringify(manifest, null, 2));
}

/** Builds the manifest and writes it to disk -- the real ingest/build path's convenience wrapper around `buildManifest` + `writeManifestToDisk`. Never call this from `--check` mode. */
export async function writeManifest(): Promise<IngestionManifest> {
  const manifest = await buildManifest();
  writeManifestToDisk(manifest);
  return manifest;
}

/** Reads back the last *committed* manifest (git HEAD), not the working-tree copy `writeManifest` just wrote. Returns null if none is committed yet. */
export function loadCommittedManifest(): IngestionManifest | null {
  try {
    const content = execFileSync("git", ["show", `HEAD:${MANIFEST_REPO_RELATIVE_PATH}`], { cwd: REPO_ROOT, encoding: "utf-8" });
    return JSON.parse(content) as IngestionManifest;
  } catch {
    return null;
  }
}

/** Human-readable list of what changed between two manifests, empty if identical. */
export function diffManifests(before: IngestionManifest, after: IngestionManifest): string[] {
  const diffs: string[] = [];
  if (before.gameMaster.commitSha !== after.gameMaster.commitSha) {
    diffs.push(`GAME_MASTER: ${before.gameMaster.commitSha} -> ${after.gameMaster.commitSha}`);
  }
  const allFileKeys = new Set([...Object.keys(before.pokemonGoApi.files), ...Object.keys(after.pokemonGoApi.files)]);
  for (const key of allFileKeys) {
    const beforeHash = before.pokemonGoApi.files[key];
    const afterHash = after.pokemonGoApi.files[key];
    if (beforeHash !== afterHash) diffs.push(`pokemon-go-api ${key}: ${beforeHash ?? "(absent)"} -> ${afterHash ?? "(absent)"}`);
  }
  if (before.shinySheet.contentHash !== after.shinySheet.contentHash) {
    diffs.push(`shiny sheet: ${before.shinySheet.contentHash} -> ${after.shinySheet.contentHash}`);
  }
  if (before.gorefs.lastBuiltAt !== after.gorefs.lastBuiltAt) {
    diffs.push(`GoRefs: ${before.gorefs.lastBuiltAt} -> ${after.gorefs.lastBuiltAt}`);
  }
  return diffs;
}

export { MANIFEST_PATH, MANIFEST_REPO_RELATIVE_PATH };
