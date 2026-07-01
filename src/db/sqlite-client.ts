// Bootstraps the real @capacitor-community/sqlite connection. Runs against
// the plugin's Web implementation (jeep-sqlite, backed by sql.js + IndexedDB
// via localforage) — a genuine, persistent SQLite database, just running in
// the browser for now since there's no native Android project yet (see
// TODO.md milestone A). This is a *dev/no-native-project* shim, not a
// browser-storage design choice: production will run the exact same
// SQL-through-this-module code path against the plugin's native Android
// implementation once `npx cap add android` happens (milestone D) — nothing
// here is Android-incompatible.
//
// package.json pins `sql.js` to exactly 1.11.0, not a caret range: jeep-sqlite
// vendors its own compiled sql.js glue JS (matching the ~1.11 line it was
// built against), and the plain sql-wasm.wasm binary this repo copies into
// public/assets/ has to match that glue's WASM ABI. Confirmed the hard way —
// sql.js 1.14.1's wasm binary against jeep-sqlite's glue throws
// "WebAssembly.instantiate(): ... function import requires a callable" and
// the app never gets past "Loading your dex…". Don't bump sql.js without
// re-verifying the app still boots.

import { defineCustomElements as defineJeepSqliteElements } from "jeep-sqlite/loader";
import { CapacitorSQLite, SQLiteConnection, type SQLiteDBConnection } from "@capacitor-community/sqlite";

const DB_NAME = "gobuddy";

const sqlite = new SQLiteConnection(CapacitorSQLite);
let connectionPromise: Promise<SQLiteDBConnection> | null = null;

async function ensureJeepSqliteElement(): Promise<void> {
  defineJeepSqliteElements(window);
  if (!document.querySelector("jeep-sqlite")) {
    document.body.appendChild(document.createElement("jeep-sqlite"));
  }
  await customElements.whenDefined("jeep-sqlite");
}

/** Opens (or returns the already-open) on-device SQLite connection. Safe to call more than once — reuses the same connection. */
export function getDb(): Promise<SQLiteDBConnection> {
  if (!connectionPromise) {
    connectionPromise = (async () => {
      await ensureJeepSqliteElement();
      await sqlite.initWebStore();

      const alreadyOpen = (await sqlite.isConnection(DB_NAME, false)).result;
      const db = alreadyOpen ? await sqlite.retrieveConnection(DB_NAME, false) : await sqlite.createConnection(DB_NAME, false, "no-encryption", 1, false);
      await db.open();
      return db;
    })();
  }
  return connectionPromise;
}

/** Persists the in-memory (sql.js) database out to its IndexedDB store — required on Web for writes to survive a reload. */
export async function persistDb(): Promise<void> {
  await sqlite.saveToStore(DB_NAME);
}
