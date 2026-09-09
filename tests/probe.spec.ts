import { test } from "@playwright/test";

declare global {
  interface Window {
    __marblescape?: import("../src/game/game").Game;
  }
}

/**
 * Reliability probe for the funnel level: 8 consecutive solves on one page.
 * The funnel piece sits mid-run, so this guards the solve path that the
 * sandbox gate never exercises (chained pieces + mid-run hole).
 */
test("probe: level 5 funnel reliability (8 runs)", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.__marblescape), null, { timeout: 30_000 });

  for (let run = 1; run <= 8; run += 1) {
    await page.evaluate(() => window.__marblescape?.enterLevel(5));
    await page.evaluate(() => window.__marblescape?.place("straight", 3, 2));
    await page.evaluate(() => window.__marblescape?.place("funnel", 3, 4));
    await page.evaluate(() => window.__marblescape?.play());

    const collected = await page
      .waitForFunction(
        () => (window.__marblescape?.collectedCount() ?? 0) >= 1,
        null,
        { timeout: 15_000 },
      )
      .then(() => true)
      .catch(() => false);

    if (!collected) {
      await page.screenshot({ path: `probe-l5-run${run}-stuck.png` });
    }
    test.expect(collected, `run ${run} should reach the cup`).toBe(true);
    // Reset for next run: exit and re-enter clears placements.
    await page.evaluate(() => window.__marblescape?.exitLevel());
  }
});