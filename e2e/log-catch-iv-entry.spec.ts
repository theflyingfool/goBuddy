import { test, expect } from "@playwright/test";

test("logging a catch with IV components computes and persists the correct IV%", async ({ page }) => {
  // The mobile <select> path is used here because it's viewport-independent
  // and exact to select — but we still force a narrow viewport explicitly
  // (see log-catch-iv-entry-responsive.spec.ts for the wide/narrow visual
  // split check) since the desktop slider+number pair is hidden below
  // 720px via CSS and .iv-component-mobile is hidden at/above it.
  await page.setViewportSize({ width: 400, height: 800 });

  await page.goto("/#/log-catch");
  await page.waitForLoadState("networkidle");

  await page.getByRole("searchbox").fill("bulbasaur");
  await page.getByText("Bulbasaur", { exact: false }).first().click();

  // The "Full details" mode toggle is a plain <button>, not an ARIA tab.
  await page.getByRole("button", { name: "Full details" }).click();

  const selects = page.locator(".iv-component-mobile");
  await selects.nth(0).selectOption("15");
  await selects.nth(1).selectOption("15");
  await selects.nth(2).selectOption("15");

  await expect(page.getByText("100%")).toBeVisible();

  await page.getByRole("button", { name: /^save$/i }).click();
  await page.waitForTimeout(500);

  await page.goto("/#/collection");
  await page.waitForLoadState("networkidle");
  await expect(page.getByText("100% IV")).toBeVisible();
});

test("desktop (>=720px) shows the slider+number pair; mobile (<720px) shows the dropdown", async ({ page }) => {
  await page.goto("/#/log-catch");
  await page.waitForLoadState("networkidle");

  await page.getByRole("searchbox").fill("bulbasaur");
  await page.getByText("Bulbasaur", { exact: false }).first().click();
  await page.getByRole("button", { name: "Full details" }).click();

  await page.setViewportSize({ width: 1200, height: 900 });
  await expect(page.locator(".iv-component-desktop").first()).toBeVisible();
  await expect(page.locator(".iv-component-mobile").first()).toBeHidden();

  // Dragging/typing/arrow-clicking the slider and number input stay in sync.
  const desktopGroup = page.locator(".iv-component-desktop").first();
  const slider = desktopGroup.locator('input[type="range"]');
  const number = desktopGroup.locator('input[type="number"]');
  await slider.fill("12");
  await expect(number).toHaveValue("12");
  await number.fill("7");
  await expect(slider).toHaveValue("7");

  await page.setViewportSize({ width: 400, height: 800 });
  await expect(page.locator(".iv-component-desktop").first()).toBeHidden();
  await expect(page.locator(".iv-component-mobile").first()).toBeVisible();
});
