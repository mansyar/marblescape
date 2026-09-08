import { expect, test } from "@playwright/test";

declare global {
  interface Window {
    __marblescape?: import("../src/game/game").Game;
  }
}

const RUNS = 20;
const MARBLES_PER_RUN = 1; // PHYSICS.maxMarblesPerDrop (user preference)

test("reliability gate: 20 consecutive drops, every marble collected, zero escapes", async ({
  page,
}) => {
  test.setTimeout(300_000);
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.__marblescape), null, { timeout: 30_000 });

  // Hole piece directly under the spawn point.
  const placed = await page.evaluate(() => window.__marblescape?.place("goal", 4, 0) ?? false);
  expect(placed).toBe(true);

  for (let run = 1; run <= RUNS; run += 1) {
    await page.evaluate(() => window.__marblescape?.play());
    // Every marble must leave the board (collected) before the next drop.
    await page.waitForFunction(
      () => (window.__marblescape?.marbleCount() ?? -1) === 0,
      null,
      { timeout: 30_000 },
    );
    const rescued = await page.evaluate(() => window.__marblescape?.rescuedCount() ?? -1);
    expect(rescued, `run ${run}: marbles escaped the board`).toBe(0);
  }

  const final = await page.evaluate(() => ({
    collected: window.__marblescape?.collectedCount() ?? -1,
    rescued: window.__marblescape?.rescuedCount() ?? -1,
  }));
  expect(final.collected).toBe(RUNS * MARBLES_PER_RUN);
  expect(final.rescued).toBe(0);
});
