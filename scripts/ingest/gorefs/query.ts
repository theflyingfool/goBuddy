// Thin wrapper around the DuckDB Node client: fetches GoRefs' served
// database to a local cache file and attaches it, then exposes a generic
// per-table reader. BIGINT columns (nearly every refjson_* table has them)
// are cast to plain JS numbers here, once, so nothing downstream has to
// think about BigInt.
//
// Pattern B, not pattern A: the design doc's "Unverified assumption"
// section flagged httpfs ATTACH-over-HTTP as unverified. Task 2's spike
// found it crashes this platform's locally-built duckdb npm package
// outright ("stack smashing detected" on INSTALL/LOAD httpfs, before ever
// reaching ATTACH) -- not a slowness or correctness issue. fetchToCache +
// local ATTACH works cleanly and needs no httpfs extension at all; it's
// still a plain GET against --serve today and a raw.githubusercontent.com/
// Release URL later, preserving the "survives to real hosting unchanged"
// property the design doc cared about.

import duckdb from "duckdb";
import { resolve } from "node:path";
import { fetchToCache, CACHE_V2_ROOT } from "../http-cache";

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
  const localPath = resolve(CACHE_V2_ROOT, "gorefs/GoRefs_Master.duckdb");
  await fetchToCache(`http://localhost:${port}/output/GoRefs_Master.duckdb`, localPath);

  const db = new duckdb.Database(":memory:");
  const con = db.connect();

  const run = <T>(sql: string): Promise<T[]> =>
    new Promise((resolve, reject) => {
      con.all(sql, (err, rows) => (err ? reject(err) : resolve(rows as T[])));
    });

  await run(`ATTACH '${localPath}' AS gorefs (READ_ONLY);`);

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
