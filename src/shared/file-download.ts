// Generic "hand the user a file" flow, shared by any feature that needs to
// let the user save a file for later use outside the app (Settings' personal
// data export, Coverage Report's per-gap CSV export). Three paths depending
// on platform, in priority order:
// - Web with the File System Access API: a real save dialog
//   (`showSaveFilePicker`).
// - Web fallback (older browsers, e.g. Firefox): Blob + `<a download>`.
// - Native (Capacitor Android): write to the cache dir, then hand off to the
//   native share sheet ("Save to Drive", email, etc. — the app never talks
//   to any cloud service directly).
// Originally lived only in personal-data-transfer.ts; extracted so
// Coverage Report's CSV export can reuse the exact same mechanism instead of
// re-implementing it.

import { Capacitor } from "@capacitor/core";
import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

export interface SaveTextFileOptions {
  suggestedName: string;
  mimeType: string;
  /** e.g. ".json", ".csv" — only consulted by the File System Access picker's file-type filter. */
  fileExtension: string;
  /** Shown as the save-dialog "description" / the native share sheet's title. */
  description: string;
}

export async function downloadTextFile(content: string, options: SaveTextFileOptions): Promise<"saved" | "cancelled"> {
  if (Capacitor.getPlatform() === "web") {
    // One-shot save dialogs only — no persistent file handle to manage, so
    // none of the File System Access API's permission/corruption gotchas
    // researched for the (rejected) live-sync approach apply here.
    const w = window as unknown as { showSaveFilePicker?: (opts: unknown) => Promise<FileSystemFileHandle> };
    if (w.showSaveFilePicker) {
      try {
        const handle = await w.showSaveFilePicker({
          suggestedName: options.suggestedName,
          types: [{ description: options.description, accept: { [options.mimeType]: [options.fileExtension] } }],
        });
        const writable = await handle.createWritable();
        await writable.write(content);
        await writable.close();
      } catch (err) {
        if ((err as Error).name === "AbortError") return "cancelled";
        throw err;
      }
      return "saved";
    }
    const blob = new Blob([content], { type: options.mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = options.suggestedName;
    a.click();
    URL.revokeObjectURL(url);
    return "saved";
  }

  const { uri } = await Filesystem.writeFile({
    path: options.suggestedName,
    data: content,
    directory: Directory.Cache,
    encoding: Encoding.UTF8,
  });
  await Share.share({ title: options.description, url: uri });
  return "saved";
}
