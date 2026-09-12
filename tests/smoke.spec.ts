import { expect, test } from "@playwright/test";
import { blockFirstRun } from "./helpers";

declare global {
  interface Window {
    __marblescape?: import("../src/game/game").Game;
  }
}

test("app boots on a touch phone without console errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(String(err)));
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      errors.push(msg.text());
    }
  });
  await page.goto("/");
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.getByRole("button", { name: "▶" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("a scripted marble rolls, falls through the hole and is collected", async ({ page }) => {
  // Existing player: the sandbox starts empty (no first-run seed).
  await blockFirstRun(page);
  await page.goto("/");
  // Wait for the game (renderer + physics + models) to be fully started.
  await page.waitForFunction(() => Boolean(window.__marblescape), null, { timeout: 30_000 });

  // Place the hole piece directly under the spawn point, then play.
  const placed = await page.evaluate(() => window.__marblescape?.place("goal", 4, 0) ?? false);
  expect(placed).toBe(true);
  await page.evaluate(() => window.__marblescape?.play());

  await page.waitForFunction(() => (window.__marblescape?.collectedCount() ?? 0) >= 1, null, {
    timeout: 15_000,
  });

  // Collect celebration (FR1): a sparkle burst fired at the cup.
  await page.waitForFunction(() => (window.__marblescape?.burstCount() ?? 0) >= 1, null, {
    timeout: 15_000,
  });
});
