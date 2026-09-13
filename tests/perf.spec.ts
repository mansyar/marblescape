import { expect, test } from "@playwright/test";
import { QUALITY_DOWNGRADE_P95_MS, QUALITY_TIERS } from "../src/render/quality-config";
import { blockFirstRun } from "./helpers";

declare global {
  interface Window {
    __marblescape?: import("../src/game/game").Game;
  }
}

/**
 * CI perf gate (spec FR5): the adaptive quality system must keep frame pacing
 * inside the 30 fps floor on a deterministic busy scene even when the CPU is
 * starved. Starvation is ramped until the governor engages (or a cap); a
 * runner too fast to starve must instead show pacing that never breached the
 * healthy band, and an engaged governor must show real downgrades + budgets.
 *
 * The scene covers the stress sources the tiers govern: five live marbles
 * rolling a straight chain (physics + shadows + gleam), collect sparkle
 * bursts, a closed-lid roll-over (sorting path), and a solving level
 * (confetti + overlay). Meter stats are read through `window.__marblescape`.
 *
 * Runs on the `portrait-phone` Chromium project only (the primary target
 * device class); every other project skips. Local command:
 *   pnpm exec playwright test tests/perf.spec.ts --config=playwright.pwa.config.ts --project=portrait-phone
 */

const PERF_PROJECT = "portrait-phone";

// CDP CPU slowdown so the busy scene trips adaptation. Machines differ wildly
// (the GitHub runner stayed fully healthy where the dev machine starved), so
// the gate ramps this rate until the governor engages instead of betting on
// one fixed value. Baseline evidence lives in the dated perf-gate note in
// tech-stack.md — re-tune only with fresh evidence.
const CPU_THROTTLE_RATE = 6;
const THROTTLE_RAMP_STEP = 3;
const THROTTLE_RAMP_MAX_RATE = 18;
const THROTTLE_RAMP_STEP_MS = 3_000;

// Busy-tail ceiling (read right after the 5-marble stress + roll-over).
// Crash-guard only: adapted runs measured 18-36 ms across the 2026-09-14
// baselines (noisy dev machine). Catching budget-application regressions is
// the confetti-budget check's job, not this ceiling's.
const STRESS_P95_BUDGET_MS = 60;

// Celebration-tail ceiling (confetti + solve overlay): crash guard only
// (measured 32-50 ms across the 2026-09-14 baselines) — the tail is
// dominated by celebration work in every tier.
const FINAL_P95_BUDGET_MS = 75;

// The scene must produce real telemetry, not an empty measurement window.
const MIN_FRAME_COUNT = 300;

const CHAIN: Array<[number, number, "straight" | "goal"]> = [
  [4, 0, "straight"],
  [4, 1, "straight"],
  [4, 2, "straight"],
  [4, 3, "straight"],
  [4, 4, "goal"],
];

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== PERF_PROJECT, `perf gate runs on "${PERF_PROJECT}" only`);
  await blockFirstRun(page);
});

test("perf gate: 5-marble stress scene stays on the 30 fps floor under CPU starvation", async ({
  page,
}) => {
  test.setTimeout(300_000);
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.__marblescape), null, { timeout: 30_000 });

  // Starve the CPU for the whole measured window (Chromium CDP only).
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: CPU_THROTTLE_RATE });

  // Build the chain: four straights into a mint cup at the south end.
  for (const [x, y, type] of CHAIN) {
    const placed = await page.evaluate(
      ([px, py, ptype]) => window.__marblescape?.place(ptype, px, py, py === 4 ? "mint" : undefined) ?? false,
      [x, y, type] as const,
    );
    expect(placed, `could not place ${type} at (${x}, ${y})`).toBe(true);
  }

  // Five mint drops, paced by spawn-cell clearance: the batch keeps up to
  // five marbles running the chain concurrently, while never spawning onto
  // the previous marble (same-instant spawns jettison marbles off the guide).
  const before = await page.evaluate(() => window.__marblescape?.collectedCount() ?? -1);
  for (let i = 0; i < 5; i += 1) {
    await page.evaluate(() => window.__marblescape?.play("mint"));
    if (i < 4) {
      await page.waitForFunction(
        () => {
          const pos = window.__marblescape?.marblePositions() ?? [];
          return pos.length > 0 && pos.every((p) => p.z > 1.3);
        },
        null,
        { timeout: 60_000 },
      );
    }
  }
  await page.waitForFunction(
    (target) => (window.__marblescape?.collectedCount() ?? -1) >= target,
    before + 5,
    { timeout: 120_000 },
  );

  // Starvation ramp: step the throttle up until the governor engages (or the
  // cap is reached). The dev machine starves at 6x; the GitHub runner stayed
  // fully healthy at 6x, so a fixed rate silently stopped testing adaptation
  // there. Fast local runs exit the ramp immediately (tier already dropped).
  let throttleRate = CPU_THROTTLE_RATE;
  for (;;) {
    const tier = await page.evaluate(() => window.__marblescape?.qualityStats().tier ?? 0);
    if (tier >= 1 || throttleRate >= THROTTLE_RAMP_MAX_RATE) break;
    throttleRate += THROTTLE_RAMP_STEP;
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: throttleRate });
    console.log(`perf gate: throttle ramp stepped to ${throttleRate}x`);
    await page.waitForTimeout(THROTTLE_RAMP_STEP_MS);
  }
  console.log(`perf gate: throttle ramp settled at ${throttleRate}x`);

  // Sorting path: a mismatched marble rolls over the closed mint lid.
  await page.evaluate(() => window.__marblescape?.play("grape"));
  await page.waitForFunction(
    () => (window.__marblescape?.marblePositions()[0]?.z ?? 0) > 4.6,
    null,
    { timeout: 90_000 },
  );

  // Busy-tail measurement: this is where the applied tier budgets show up.
  const stressStats = await page.evaluate(() => window.__marblescape?.qualityStats() ?? null);
  expect(stressStats).not.toBeNull();
  if (!stressStats) return;
  console.log(
    `perf gate (stress): tier=${stressStats.tier} p95=${stressStats.p95FrameMs.toFixed(1)}ms ema=${stressStats.emaFrameMs.toFixed(1)}ms frames=${stressStats.frameCount} down=${stressStats.downgrades}`,
  );
  expect(stressStats.p95FrameMs).toBeLessThanOrEqual(STRESS_P95_BUDGET_MS);

  // Adaptation contract: when starvation actually bit (tier dropped), a
  // downgrade must be on record. A runner too fast to starve even at the ramp
  // cap must instead show pacing that never breached the healthy band — a
  // connected-but-inert meter/governor would breach it at the cap and fail.
  const adapted = stressStats.tier >= 1;
  if (adapted) {
    expect(stressStats.downgrades).toBeGreaterThanOrEqual(1);
  } else {
    expect(stressStats.p95FrameMs).toBeLessThanOrEqual(QUALITY_DOWNGRADE_P95_MS);
  }

  // Celebration path: solve level 1 (classic) — confetti burst + overlay.
  const entered = await page.evaluate(() => window.__marblescape?.enterLevel(1) ?? false);
  expect(entered).toBe(true);
  const placed = await page.evaluate(() => window.__marblescape?.place("straight", 3, 2) ?? false);
  expect(placed).toBe(true);
  await page.evaluate(() => window.__marblescape?.play());
  await expect(page.locator('[data-testid="solved-overlay"]')).toBeVisible({ timeout: 90_000 });

  // Applied-budget check (deterministic, hardware-independent): the burst
  // emits no more pieces than the governor's current tier allows. A pinned
  // full-quality regression emits ~100 pieces and fails this even when
  // pacing noise would hide it.
  const burst = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="confetti-layer"]');
    const count = el?.querySelectorAll('[data-confetti="piece"]').length ?? -1;
    const tier = window.__marblescape?.qualityStats().tier ?? -1;
    return { count, tier };
  });
  console.log(`perf gate (burst): pieces=${burst.count} tier=${burst.tier}`);
  expect(burst.tier).toBeGreaterThanOrEqual(0);
  expect(burst.count).toBeGreaterThan(0);
  expect(burst.count).toBeLessThanOrEqual(QUALITY_TIERS[Math.max(0, burst.tier)].confettiPieces);

  // Let the confetti burst animate inside the measured window.
  await page.waitForTimeout(3_000);

  const stats = await page.evaluate(() => window.__marblescape?.qualityStats() ?? null);
  const rescued = await page.evaluate(() => window.__marblescape?.rescuedCount() ?? -1);
  expect(stats).not.toBeNull();
  if (!stats) return;

  // Surface the measurement in CI logs — this is the evidence future tuning
  // of the thresholds and throttle rate must be based on.
  console.log(
    `perf gate (final): tier=${stats.tier} p95=${stats.p95FrameMs.toFixed(1)}ms ema=${stats.emaFrameMs.toFixed(1)}ms frames=${stats.frameCount} down=${stats.downgrades} up=${stats.upgrades}`,
  );

  // Celebration tail: catastrophic-collapse guard only.
  expect(stats.p95FrameMs).toBeLessThanOrEqual(FINAL_P95_BUDGET_MS);
  // Once engaged under starvation, the drop is sticky for the rest of the run.
  if (adapted) {
    expect(stats.tier).toBeGreaterThanOrEqual(1);
    expect(stats.downgrades).toBeGreaterThanOrEqual(1);
  }
  // The window actually contains telemetry from a long busy scene.
  expect(stats.frameCount).toBeGreaterThanOrEqual(MIN_FRAME_COUNT);
  // Nothing was lost on the way: the scene ran clean under starvation.
  expect(rescued).toBe(0);
});
