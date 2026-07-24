import { test, expect } from "@playwright/test";

// New in this task, not part of species-detail.ts's vanilla behavior: the
// species detail page's Log-a-catch FAB deep-links to
// /#/log-catch?species=<slug> (SpeciesDetailPage.vue), and LogCatchPage.vue
// prefills its species picker from that query param (router.ts's log-catch
// route). Kept out of species-detail-tracking.spec.ts, which must also pass
// against the vanilla page (no FAB there).
test("Log-a-catch FAB deep-links from species detail and pre-fills the species picker", async ({ page }) => {
  await page.goto("/#/data-entry/species/charizard");
  await page.waitForLoadState("networkidle");

  await page.getByRole("button", { name: "+ Log a catch" }).click();

  await expect(page).toHaveURL(/#\/log-catch\?species=charizard$/);
  // Prefilled: the species picker shows Charizard already selected (its own
  // "Change" button), not the empty search input.
  await expect(page.getByRole("textbox", { name: /search species/i })).toHaveCount(0);
  await expect(page.getByText("Charizard", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Change" })).toBeVisible();

  // Plain /#/log-catch (no query) still starts empty -- the no-prefill case
  // species-detail.ts's port must not have broken.
  await page.goto("/#/log-catch");
  await expect(page.getByPlaceholder("Search species…")).toBeVisible();
  await expect(page.getByRole("button", { name: "Change" })).toHaveCount(0);
});
