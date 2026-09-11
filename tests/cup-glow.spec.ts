import { expect, test } from "@playwright/test";

declare global {
  interface Window {
    __marblescape?: import("../src/game/game").Game;
  }
}

test("cup glow: level 7 lights only the compatible cup", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.__marblescape), null, { timeout: 30_000 });

  const entered = await page.evaluate(() => window.__marblescape?.enterLevel(7) ?? false);
  expect(entered).toBe(true);

  // The script starts with raspberry: its cup pulses, mint's stays dark.
  await page.waitForFunction(() => (window.__marblescape?.cupGlowAt(3, 5) ?? 0) > 0, null, {
    timeout: 5_000,
  });
  const glow = await page.evaluate(() => ({
    raspberry: window.__marblescape?.cupGlowAt(3, 5) ?? -1,
    mint: window.__marblescape?.cupGlowAt(4, 5) ?? -1,
  }));
  expect(glow.raspberry).toBeGreaterThan(0);
  expect(glow.mint).toBe(0);
});

test("cup glow: a classic sandbox cup glows while waiting", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.__marblescape), null, { timeout: 30_000 });

  const placed = await page.evaluate(() => window.__marblescape?.place("goal", 4, 3) ?? false);
  expect(placed).toBe(true);
  await page.waitForFunction(() => (window.__marblescape?.cupGlowAt(4, 3) ?? 0) > 0, null, {
    timeout: 5_000,
  });
});

test("cup glow: reduced motion holds a steady glow", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.__marblescape), null, { timeout: 30_000 });

  await page.evaluate(() => window.__marblescape?.enterLevel(7));
  await page.waitForFunction(() => (window.__marblescape?.cupGlowAt(3, 5) ?? 0) > 0, null, {
    timeout: 5_000,
  });

  const first = await page.evaluate(() => window.__marblescape?.cupGlowAt(3, 5) ?? -1);
  await page.waitForTimeout(300);
  const second = await page.evaluate(() => window.__marblescape?.cupGlowAt(3, 5) ?? -1);
  expect(first).toBeCloseTo(0.35, 5);
  expect(second).toBeCloseTo(0.35, 5);
});
