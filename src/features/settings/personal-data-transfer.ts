// Manual cross-device transfer of personal data (see TODO.md / the plan that
// added this) — deliberately not a live sync. Export writes a file the user
// places wherever they like (Drive, email, USB — the app never talks to any
// cloud service directly); import reads one back in. The platform-specific
// file I/O is shared (src/shared/file-download.ts); the format itself comes
// from Repository.exportPersonalData/importPersonalData, defined once in
// src/data/in-memory-store.ts so both backends get it for free.

import { CURRENT_PERSONAL_SCHEMA_VERSION } from "../../db/schema";
import type { PersonalDataExport, Repository } from "../../data/repository";
import { downloadTextFile } from "../../shared/file-download";

function fileName(): string {
  return `gobuddy-export-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
}

export async function exportPersonalData(repo: Repository): Promise<void> {
  const data = repo.exportPersonalData();
  const json = JSON.stringify(data, null, 2);
  await downloadTextFile(json, {
    suggestedName: fileName(),
    mimeType: "application/json",
    description: "GoBuddy export",
  });
}

/** Reads and validates a picked file; the caller (Settings UI) handles confirmation and the actual importPersonalData call. */
export async function readPersonalDataFile(file: File): Promise<{ data: PersonalDataExport; schemaMismatch: boolean }> {
  const text = await file.text();
  const data = JSON.parse(text) as PersonalDataExport;
  if (typeof data.schemaVersion !== "number" || !data.speciesPersonal || !data.formPersonal || !data.appSettings) {
    throw new Error("This doesn't look like a GoBuddy export file.");
  }
  return { data, schemaMismatch: data.schemaVersion !== CURRENT_PERSONAL_SCHEMA_VERSION };
}
