// Bootstraps the real @capacitor-community/sqlite connection. On native
// Android (milestone D: `android/`, added via `npx cap add android`), the
// plugin talks straight to real on-device SQLite — no extra setup needed. On
// Web (no native project, or just running `npm run dev`), the same plugin
// instead runs its Web implementation: jeep-sqlite, backed by sql.js +
// IndexedDB via localforage — a genuine, persistent SQLite database, just
// running in the browser. Every call in this module is guarded by
// `Capacitor.getPlatform()` so the jeep-sqlite/sql.js setup only ever runs on
// Web; getDb()/persistDb()'s callers (src/data/sqlite-repository.ts) don't
// need to know or care which platform they're on.
//
// package.json pins `sql.js` to exactly 1.11.0, not a caret range: jeep-sqlite
// vendors its own compiled sql.js glue JS (matching the ~1.11 line it was
// built against), and the plain sql-wasm.wasm binary this repo copies into
// public/assets/ has to match that glue's WASM ABI. Confirmed the hard way —
// sql.js 1.14.1's wasm binary against jeep-sqlite's glue throws
// "WebAssembly.instantiate(): ... function import requires a callable" and
// the app never gets past "Loading your dex…". Don't bump sql.js without
// re-verifying the app still boots. This only matters on Web — native builds
// never touch sql.js/jeep-sqlite at all.

import { Capacitor } from "@capacitor/core";
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
      if (Capacitor.getPlatform() === "web") {
        await ensureJeepSqliteElement();
        await sqlite.initWebStore();
      }

      // isConnection() reflects the native plugin's own connection registry,
      // which lives outside the WebView's JS context — it can report an
      // existing open connection even on a fresh JS boot (e.g. after
      // window.location.reload(), or Android restoring a backgrounded
      // WebView). Calling .open() again on an already-open native connection
      // is a known failure mode for this plugin ("Couldn't open the
      // on-device database"), so only open what isn't already open.
      const alreadyOpen = (await sqlite.isConnection(DB_NAME, false)).result;
      const db = alreadyOpen ? await sqlite.retrieveConnection(DB_NAME, false) : await sqlite.createConnection(DB_NAME, false, "no-encryption", 1, false);
      if (!alreadyOpen) {
        await db.open();
      }
      return db;
    })();
  }
  return connectionPromise;
}

/** Persists the in-memory (sql.js) database out to its IndexedDB store — a Web-only concept; native SQLite already writes straight to disk. */
export async function persistDb(): Promise<void> {
  if (Capacitor.getPlatform() === "web") {
    await sqlite.saveToStore(DB_NAME);
  }
}
