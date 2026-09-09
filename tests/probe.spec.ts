import { expect, test } from "@playwright/test";

declare global {
  interface Window {
    __marblescape?: import("../src/game/game").Game;
  }
}

test("probe: level 1 marble reaches the goal cup", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.__marblescape), null, { timeout: 30_000 });

  const entered = await page.evaluate(() => window.__marblescape?.enterLevel(1) ?? false);
  expect(entered).toBe(true);
  const placed = await page.evaluate(() => window.__marblescape?.place("straight", 3, 2) ?? false);
  expect(placed).toBe(true);
  await page.evaluate(() => window.__marblescape?.play());

  await page.waitForFunction(() => (window.__marblescape?.collectedCount() ?? 0) >= 1, null, {
    timeout: 20_000,
  });

  // Post-solve flow: badge persisted + ✓ overlay with big Home visible.
  const badges = await page.evaluate(() => localStorage.getItem("marblescape.badges.v1"));
  expect(badges).toContain("1");
  await expect(page.locator('[data-testid="solved-overlay"]')).toBeVisible();
  await page.locator('[data-testid="solved-overlay"] button').click();
  await expect(page.locator('[data-testid="solved-overlay"]')).toBeHidden();
  await expect(page.locator('[data-level-select="level-1"]')).toBeVisible();

  await page.waitForTimeout(500);
  await page.screenshot({ path: "probe-level1-solved.png" });
});