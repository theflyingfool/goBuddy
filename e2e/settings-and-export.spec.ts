import { test, expect } from "@playwright/test";

const SPECIES_PATH = "/#/data-entry/species/bulbasaur";
const SETTINGS_PATH = "/#/settings";

test("settings toggles and the export/import round-trip survive a reload", async ({ page }) => {
  await page.goto(SETTINGS_PATH);

  await page.getByRole("button", { name: "Dark", exact: true }).click();
  await expect(page.getByRole("button", { name: "Dark", exact: true })).toHaveClass(/filter-chip-active/);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  const backupToggle = page.getByRole("checkbox", { name: "Back up before import" });
  await backupToggle.check();

  // Data to export: turn Registered on for bulbasaur.
  await page.goto(SPECIES_PATH);
  await page.getByRole("checkbox", { name: "Registered" }).check();

  await page.goto(SETTINGS_PATH);
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Export personal data" }).click(),
  ]);
  const exportPath = await download.path();
  if (!exportPath) throw new Error("Download did not produce a local file path");

  // Turn Registered back off so import below has something visible to restore.
  await page.goto(SPECIES_PATH);
  await page.getByRole("checkbox", { name: "Registered" }).uncheck();

  await page.goto(SETTINGS_PATH);
  // The import handler's window.confirm fires asynchronously (after reading
  // the file), so the dialog listener must already be attached before the
  // file input's change event is triggered.
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator('input[type="file"]').setInputFiles(exportPath);
  await expect(page.getByText("Imported.")).toBeVisible();

  await page.reload();

  await expect(page.getByRole("button", { name: "Dark", exact: true })).toHaveClass(/filter-chip-active/);
  await expect(page.getByRole("checkbox", { name: "Back up before import" })).toBeChecked();

  await page.goto(SPECIES_PATH);
  await expect(page.getByRole("checkbox", { name: "Registered" })).toBeChecked();
});
