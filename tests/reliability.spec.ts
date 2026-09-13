import { expect, test } from "@playwright/test";
import type { PieceType } from "../src/domain/pieces";
import { blockFirstRun } from "./helpers";

declare global {
  interface Window {
    __marblescape?: import("../src/game/game").Game;
  }
}

// Existing player: drops must not land on a first-run starter track.
test.beforeEach(async ({ page }) => {
  await blockFirstRun(page);
});

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

const COLORED_RUNS = 20;

test("reliability gate: 20 consecutive colored drops into a matching cup, zero escapes", async ({
  page,
}) => {
  test.setTimeout(300_000);
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.__marblescape), null, { timeout: 30_000 });

  // A mint cup sits directly under the spawn point; every drop is mint.
  const placed = await page.evaluate(
    () => window.__marblescape?.place("goal", 4, 0, "mint") ?? false,
  );
  expect(placed).toBe(true);

  for (let run = 1; run <= COLORED_RUNS; run += 1) {
    await page.evaluate(() => window.__marblescape?.play("mint"));
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
  expect(final.collected).toBe(COLORED_RUNS);
  expect(final.rescued).toBe(0);
});

test("mismatch roll-over: a mismatched marble skips the closed cup, never escapes, leaves no body behind", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.__marblescape), null, { timeout: 30_000 });

  const placed = await page.evaluate(
    () => window.__marblescape?.place("goal", 4, 0, "mint") ?? false,
  );
  expect(placed).toBe(true);

  // A grape marble closes the mint cup: the flush lid must carry it over.
  await page.evaluate(() => window.__marblescape?.play("grape"));
  await page.waitForFunction(
    () => (window.__marblescape?.marblePositions()[0]?.z ?? 0) > 1.2,
    null,
    { timeout: 30_000 },
  );

  const after = await page.evaluate(() => ({
    collected: window.__marblescape?.collectedCount() ?? -1,
    rescued: window.__marblescape?.rescuedCount() ?? -1,
    marbles: window.__marblescape?.marbleCount() ?? -1,
    y: window.__marblescape?.marblePositions()[0]?.y ?? -1,
  }));
  expect(after.collected).toBe(0); // the closed cup caught nothing
  expect(after.rescued).toBe(0); // and nothing escaped
  expect(after.marbles).toBe(1); // exactly one live marble: no body leak
  expect(after.y).toBeGreaterThan(0.2); // rolling on the floor, not sunk below it
});

const FLOW_CHAIN: Array<[number, number, PieceType]> = [
  [4, 0, "straight"],
  [4, 1, "straight"],
  [4, 2, "straight"],
  [4, 3, "goal"],
];

test("lean flow: a dropped marble rolls a flat straight chain into a downstream cup", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.__marblescape), null, { timeout: 30_000 });

  // Flat straights chain south from the chute; the board's ~6° lean is the
  // only drive — no manufactured ramp may assist the roll.
  for (const [x, y, type] of FLOW_CHAIN) {
    const placed = await page.evaluate(
      ([px, py, ptype]) => window.__marblescape?.place(ptype, px, py) ?? false,
      [x, y, type],
    );
    expect(placed, `could not place ${type} at (${x}, ${y})`).toBe(true);
  }

  await page.evaluate(() => window.__marblescape?.play());

  // Leaves the chute cell: it cannot rest on a flat floor while the table leans.
  await page.waitForFunction(
    () => (window.__marblescape?.marblePositions()[0]?.z ?? 0) > 1.5,
    null,
    { timeout: 30_000 },
  );
  // Traverses the whole chain, joints included.
  await page.waitForFunction(
    () => (window.__marblescape?.marblePositions()[0]?.z ?? 0) > 2.5,
    null,
    { timeout: 30_000 },
  );
  // The downstream cup collects it; nothing escapes and nothing leaks.
  await page.waitForFunction(
    () => (window.__marblescape?.collectedCount() ?? 0) >= 1,
    null,
    { timeout: 45_000 },
  );
  const after = await page.evaluate(() => ({
    rescued: window.__marblescape?.rescuedCount() ?? -1,
    live: window.__marblescape?.marbleCount() ?? -1,
  }));
  expect(after.rescued).toBe(0);
  expect(after.live).toBe(0);
});
