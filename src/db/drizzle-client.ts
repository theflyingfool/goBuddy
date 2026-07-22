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
        // drizzle-orm's sqlite-proxy driver decodes every non-"run" method
        // ("all", "get", "values") the same way: SQLiteSession's
        // mapResultRow() reads each column positionally (`row[columnIndex]`)
        // — see node_modules/drizzle-orm/utils.js — so `rows` must always be
        // arrays of column values in SELECT order, never keyed objects.
        // Only special-casing "values" here (as an earlier version of this
        // file did) left "all"/"get" handing back conn.query()'s raw
        // { column: value } objects, which silently decoded to
        // undefined/Invalid Date for every field once real .select() calls
        // started running through this path — caught by Task 6's
        // migration-runner verification, not by anything that exercised
        // .select() at the time this file was written.
        return { rows: rows.map((r) => Object.values(r)) };
      });
    })();
  }
  return dbPromise;
}
