import { expect, test } from "@playwright/test";

declare global {
  interface Window {
    __marblescape?: import("../src/game/game").Game;
  }
}

const PRESSES = 8;
const TABLE_LIMIT = 5; // PHYSICS.maxMarblesOnTable (spec FR1)

test("table limit: rapid drops keep five live marbles and recycle the oldest", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.__marblescape), null, { timeout: 30_000 });

  for (let i = 0; i < PRESSES; i += 1) {
    await page.evaluate(() => window.__marblescape?.play());
  }

  const state = await page.evaluate(() => ({
    marbles: window.__marblescape?.marbleCount() ?? -1,
    recycled: window.__marblescape?.recycledCount() ?? -1,
    rescued: window.__marblescape?.rescuedCount() ?? -1,
  }));
  expect(state.marbles).toBe(TABLE_LIMIT);
  expect(state.recycled).toBe(PRESSES - TABLE_LIMIT);
  expect(state.rescued).toBe(0);

  // The gentle fades finish on their own and leave nothing behind.
  await page.waitForFunction(() => (window.__marblescape?.marbleFadeCount() ?? -1) === 0, null, {
    timeout: 5_000,
  });
});

test("table limit: the same rule holds inside a level", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.__marblescape), null, { timeout: 30_000 });

  const entered = await page.evaluate(() => window.__marblescape?.enterLevel(1) ?? false);
  expect(entered).toBe(true);
  const baseline = await page.evaluate(() => window.__marblescape?.recycledCount() ?? -1);

  for (let i = 0; i < PRESSES; i += 1) {
    await page.evaluate(() => window.__marblescape?.play());
  }

  const state = await page.evaluate(() => ({
    marbles: window.__marblescape?.marbleCount() ?? -1,
    recycled: window.__marblescape?.recycledCount() ?? -1,
  }));
  expect(state.marbles).toBeLessThanOrEqual(TABLE_LIMIT);
  expect(state.recycled).toBeGreaterThan(baseline);
});

test("reduced motion: recycled marbles vanish instantly with no lingering fades", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.__marblescape), null, { timeout: 30_000 });

  for (let i = 0; i < PRESSES; i += 1) {
    await page.evaluate(() => window.__marblescape?.play());
  }

  const state = await page.evaluate(() => ({
    marbles: window.__marblescape?.marbleCount() ?? -1,
    recycled: window.__marblescape?.recycledCount() ?? -1,
    fades: window.__marblescape?.marbleFadeCount() ?? -1,
  }));
  expect(state.marbles).toBe(TABLE_LIMIT);
  expect(state.recycled).toBe(PRESSES - TABLE_LIMIT);
  expect(state.fades).toBe(0);
});
