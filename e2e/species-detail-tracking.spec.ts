import { test, expect } from "@playwright/test";

// Charizard has a small, stable form list (no 100+-form Pikachu-style churn)
// and is a real species in the ingested reference data — a safe, deterministic
// target for a fresh browser context (nothing caught yet).
const SPECIES_PATH = "/#/data-entry/species/charizard";

test("species detail Tracking tab: a 4-star toggle cascades to Caught and survives a reload", async ({ page }) => {
  await page.goto(SPECIES_PATH);
  await page.waitForLoadState("networkidle");

  // Expand the first form tile ("⋯") to reveal its Standard achievement
  // checkboxes (Caught/Shiny/Floor IV/4★/Shundo) -- these only exist inside
  // the expanded-in-place panel, not on the tile face itself.
  await page.locator(".form-tile").first().click();

  const fourStarCheckbox = page.getByRole("checkbox", { name: "4★" }).first();
  await expect(fourStarCheckbox).not.toBeChecked();
  await fourStarCheckbox.check();

  // 4-star cascades to Caught (src/db/cascades.ts: fourStar -> base) -- both
  // the expanded panel's own Caught checkbox and the tile's mini Caught badge
  // should reflect it immediately, without a reload.
  await expect(page.getByRole("checkbox", { name: "Caught" }).first()).toBeChecked();
  await expect(page.getByRole("button", { name: "Caught: on" }).first()).toHaveAttribute("aria-pressed", "true");

  await page.reload({ waitUntil: "networkidle" });

  // The expand-in-place UI state is in-memory only (not personal data) and
  // does not survive a reload -- the underlying achievement fact must,
  // visible via the tile's mini Caught badge without re-expanding anything.
  await expect(page.getByRole("button", { name: "Caught: on" }).first()).toHaveAttribute("aria-pressed", "true");

  // Re-expand and confirm the 4-star fact itself also survived the reload.
  await page.locator(".form-tile").first().click();
  await expect(page.getByRole("checkbox", { name: "4★" }).first()).toBeChecked();
});
