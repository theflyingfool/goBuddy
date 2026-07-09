// Last-resort personal-data read for main.ts's boot-failure path — used only
// when createSqliteRepository() itself rejected (DB wouldn't open, a
// migration failed, or reference-sync failed), so the normal Repository
// never came into existence. The actual table-reading logic lives in
// boot-rescue-read.ts (kept free of the jeep-sqlite dependency below so it
// can run under a plain Node fixture for testing).

import { getDb } from "../db/sqlite-client";
import { readPersonalDataBestEffort } from "./boot-rescue-read";
import type { PersonalDataExport } from "./repository";

/** Returns null only if the connection itself won't open — otherwise always returns whatever could be read, even if that's an empty export. */
export async function attemptBootRescueExport(): Promise<PersonalDataExport | null> {
  try {
    const db = await getDb();
    return await readPersonalDataBestEffort(db);
  } catch {
    return null;
  }
}
