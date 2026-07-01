// Manual cross-device transfer of personal data (see TODO.md / the plan that
// added this) — deliberately not a live sync. Export writes a file the user
// places wherever they like (Drive, email, USB — the app never talks to any
// cloud service directly); import reads one back in. Two platform-specific
// file I/O paths, one shared format (Repository.exportPersonalData /
// importPersonalData, defined once in src/data/in-memory-store.ts so both
// backends get it for free).

import { Capacitor } from "@capacitor/core";
import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { CURRENT_PERSONAL_SCHEMA_VERSION } from "../../db/schema";
import type { PersonalDataExport, Repository } from "../../data/repository";

function fileName(): string {
  return `gobuddy-export-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
}

export async function exportPersonalData(repo: Repository): Promise<"saved" | "cancelled"> {
  const data = repo.exportPersonalData();
  const json = JSON.stringify(data, null, 2);

  if (Capacitor.getPlatform() === "web") {
    // One-shot save dialogs only — no persistent file handle to manage, so
    // none of the File System Access API's permission/corruption gotchas
    // researched for the (rejected) live-sync approach apply here.
    const w = window as unknown as { showSaveFilePicker?: (opts: unknown) => Promise<FileSystemFileHandle> };
    if (w.showSaveFilePicker) {
      try {
        const handle = await w.showSaveFilePicker({
          suggestedName: fileName(),
          types: [{ description: "GoBuddy export", accept: { "application/json": [".json"] } }],
        });
        const writable = await handle.createWritable();
        await writable.write(json);
        await writable.close();
      } catch (err) {
        if ((err as Error).name === "AbortError") return "cancelled";
        throw err;
      }
      return "saved";
    }
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName();
    a.click();
    URL.revokeObjectURL(url);
    return "saved";
  }

  const { uri } = await Filesystem.writeFile({
    path: fileName(),
    data: json,
    directory: Directory.Cache,
    encoding: Encoding.UTF8,
  });
  await Share.share({ title: "GoBuddy export", url: uri });
  return "saved";
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
