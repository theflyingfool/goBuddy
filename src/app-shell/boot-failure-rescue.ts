// Rendered by main.ts when createSqliteRepository() itself rejects (DB
// wouldn't open, a migration failed — including the downgrade guard in
// src/db/migrations.ts — or reference-sync failed). Offers a raw personal-
// data export as a last resort, bypassing the entire failed boot path — see
// docs/features.md#5-data-safety-net.

import { attemptBootRescueExport } from "../data/boot-rescue";
import { downloadTextFile } from "../shared/file-download";
import { el } from "../ui/dom";

function exportFileName(): string {
  return `gobuddy-rescue-export-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
}

export function renderBootFailureRescue(container: HTMLElement, bootError: unknown): void {
  const message = el("p", { class: "app-loading" }, [
    "Couldn't open the on-device database. Try reloading — if that keeps failing, you can still try to save a copy of your personal data below.",
  ]);
  const detail = el("p", { class: "gap-note" }, [bootError instanceof Error ? bootError.message : String(bootError)]);
  const exportButton = el("button", { type: "button" }, ["Try to export my data anyway"]);
  const statusEl = el("p", { class: "gap-note" }, []);

  exportButton.addEventListener("click", async () => {
    exportButton.disabled = true;
    statusEl.textContent = "Reading whatever's on-device…";
    try {
      const data = await attemptBootRescueExport();
      if (!data) {
        statusEl.textContent = "Couldn't even open the database to read from — nothing to export.";
        return;
      }
      const rowCount = Object.keys(data.speciesPersonal).length + Object.keys(data.formPersonal).length;
      const json = JSON.stringify(data, null, 2);
      await downloadTextFile(json, {
        suggestedName: exportFileName(),
        mimeType: "application/json",
        description: "GoBuddy rescue export",
      });
      statusEl.textContent = `Exported (${rowCount} personal row(s) recovered).`;
    } catch (err) {
      statusEl.textContent = `Export failed: ${(err as Error).message}`;
    } finally {
      exportButton.disabled = false;
    }
  });

  container.append(message, detail, exportButton, statusEl);
}
