// Generic "hand the user a file" flow, shared by any feature that needs to
// let the user save a file for later use outside the app (Settings' personal
// data export, Coverage Report's per-gap CSV export). Two paths depending on
// platform:
// - Web: Blob + `<a download>`, straight to the browser's Downloads folder.
//   Used to try `showSaveFilePicker` first for a real save-location dialog,
//   but on some setups (observed on Linux/Chromium — likely a desktop-portal
//   issue) the picker never opens and immediately rejects with `AbortError`,
//   which is indistinguishable from a genuine user-cancel — every web export
//   silently "failed" as "Cancelled." with no dialog ever shown. Not worth
//   chasing per-environment: the plain download always works.
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
  /** Shown as the native share sheet's title. */
  description: string;
}

export async function downloadTextFile(content: string, options: SaveTextFileOptions): Promise<void> {
  if (Capacitor.getPlatform() === "web") {
    const blob = new Blob([content], { type: options.mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = options.suggestedName;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }

  const { uri } = await Filesystem.writeFile({
    path: options.suggestedName,
    data: content,
    directory: Directory.Cache,
    encoding: Encoding.UTF8,
  });
  await Share.share({ title: options.description, url: uri });
}
