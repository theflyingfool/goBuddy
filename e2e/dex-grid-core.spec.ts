import { test, expect } from "@playwright/test";

// Characterization test for Task 6 (Vue migration): must pass unchanged
// against both the vanilla species-grid.ts render and the ported
// DexGridPage.vue. Covers only core rendering/search — select-mode,
// bulk-apply, and the species/form granularity toggle are Task 7's scope.
test("dex grid: search filters the tile list and survives a reload", async ({ page }) => {
  await page.goto("/#/data-entry");
  await page.waitForLoadState("networkidle");

  const initialCount = await page.locator(".species-tile").count();
  expect(initialCount).toBeGreaterThan(0);

  await page.getByRole("searchbox").fill("charizard");
  await page.waitForTimeout(300);
  const filteredCount = await page.locator(".species-tile").count();
  expect(filteredCount).toBeLessThan(initialCount);
  expect(filteredCount).toBeGreaterThan(0);

  await page.reload();
  await page.waitForLoadState("networkidle");
  const afterReloadCount = await page.locator(".species-tile").count();
  expect(afterReloadCount).toBe(initialCount);
});
