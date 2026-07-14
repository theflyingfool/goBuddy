import { test, expect } from "@playwright/test";

// Bulbasaur (dex #1) is a stable, always-present reference slug — a safe,
// deterministic starting point in a fresh browser context (fresh IndexedDB,
// so nothing is caught yet).
const SPECIES_PATH = "/#/data-entry/species/bulbasaur";

test("toggling Registered bumps the Stats KPI and survives a reload", async ({ page }) => {
  await page.goto(SPECIES_PATH);

  const registeredCheckbox = page.getByRole("checkbox", { name: "Registered" });
  await expect(registeredCheckbox).not.toBeChecked();
  await registeredCheckbox.check();

  // Hash writes don't fire a Playwright navigation event — evaluate the hash
  // change directly, then wait on the target route's real content.
  await page.evaluate(() => {
    location.hash = "/stats";
  });

  const registeredCard = page.locator(".stats-kpi-card", { hasText: "Registered" });
  // getCompletionStats awaits the app's write-queue before computing, so this
  // assertion passing is also proof the write actually landed in IndexedDB —
  // the real flush-completion signal the reload below depends on.
  await expect(registeredCard.locator(".stats-kpi-fraction")).toHaveText(/^1\s*\/\s*\d+$/);

  await page.reload();
  await page.goto(SPECIES_PATH);
  await expect(page.getByRole("checkbox", { name: "Registered" })).toBeChecked();
});
