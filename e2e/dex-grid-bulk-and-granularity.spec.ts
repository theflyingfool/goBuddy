import { test, expect } from "@playwright/test";

// Characterization test for Task 7 (Vue migration): must pass unchanged
// against both the vanilla species-grid.ts/bulk-form-edit.ts render and the
// ported DexGridPage.vue/BulkFormEditPanel.vue. Covers select-mode,
// species-field bulk-apply, and the species/form granularity toggle — the
// parts of the Dex grid Task 6 deliberately left untouched.
test("dex grid: select mode, species-field bulk apply, and the form-granularity toggle work", async ({ page }) => {
  await page.goto("/#/data-entry");
  await page.waitForLoadState("networkidle");

  // Enter select mode.
  await page.getByRole("button", { name: /^select$/i }).click();
  await expect(page.getByRole("button", { name: /selecting/i })).toBeVisible();

  // Pick an uncaught tile (default bulk field is "Registered" = On), remember
  // its label so we can re-find it after the grid re-renders post-apply.
  const targetWrap = page.locator(".species-tile-wrap", { has: page.locator(".species-tile.uncaught") }).first();
  const label = (await targetWrap.locator(".tile-label").innerText()).trim();
  await targetWrap.locator(".species-tile").click();

  // Bulk bar should appear once something is selected, defaulting to
  // Registered/On — apply it.
  await expect(page.locator(".bulk-action-bar")).toBeVisible();
  await page.locator(".bulk-apply-button").click();
  await page.waitForTimeout(500);

  // The species tile with that label should no longer be "uncaught".
  const wrapAfter = page.locator(".species-tile-wrap").filter({ hasText: label }).first();
  await expect(wrapAfter.locator(".species-tile")).not.toHaveClass(/uncaught/);

  // Granularity toggle: switching to "Form fields" hands the content area to
  // the bulk-form-edit panel (still in select mode from above).
  await page.getByRole("button", { name: /form fields/i }).click();
  await expect(page.getByText("Bulk edit forms")).toBeVisible();
  await expect(page.locator(".form-grid")).toBeVisible();
});
