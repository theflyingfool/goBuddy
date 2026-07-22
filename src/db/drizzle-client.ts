// Wraps the existing SQLiteDBConnection (see sqlite-client.ts — same
// connection object, no change to the native/web platform split) in
// Drizzle's sqlite-proxy driver, so Drizzle's query builder and migrator
// can run against it.

import { drizzle } from "drizzle-orm/sqlite-proxy";
import type { SqliteRemoteDatabase } from "drizzle-orm/sqlite-proxy";
import { getDb } from "./sqlite-client";

let dbPromise: Promise<SqliteRemoteDatabase> | null = null;

export function getDrizzleDb(): Promise<SqliteRemoteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const conn = await getDb();
      return drizzle(async (sqlText, params, method) => {
        if (method === "run") {
          await conn.run(sqlText, params, false);
          return { rows: [] };
        }
        const result = await conn.query(sqlText, params);
        const rows = (result.values ?? []) as Record<string, unknown>[];
        return { rows: method === "values" ? rows.map((r) => Object.values(r)) : rows };
      });
    })();
  }
  return dbPromise;
}
