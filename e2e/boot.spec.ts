import { test, expect } from "@playwright/test";

test("app boots into the dex grid, not the boot-failure-rescue screen", async ({ page }) => {
  await page.goto("/");

  // .app-loading is reused by both the normal loading state and
  // boot-failure-rescue.ts's own failure message, so "loading gone" alone
  // isn't a safe assertion — assert the real grid renders, positively.
  // One .species-grid div per collapsible region section, so there are many —
  // any one of them being visible is a real boot success signal.
  await expect(page.locator(".species-grid").first()).toBeVisible();
  await expect(page.getByText("Couldn't open the on-device database")).toHaveCount(0);
});
