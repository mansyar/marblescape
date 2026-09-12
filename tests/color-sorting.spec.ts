import { expect, test } from "@playwright/test";
import { blockFirstRun } from "./helpers";

declare global {
  interface Window {
    __marblescape?: import("../src/game/game").Game;
  }
}

// Existing player: no first-run seed, so the chute stays empty.
test.beforeEach(async ({ page }) => {
  await blockFirstRun(page);
});

test("sandbox: chute tap cycles the waiting marble; Play drops exactly that color", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.__marblescape), null, { timeout: 30_000 });

  // A marble waits at the chute wearing the next natural drop's color.
  expect(await page.evaluate(() => window.__marblescape?.waitingVisible())).toBe(true);
  expect(await page.evaluate(() => window.__marblescape?.waitingColor())).toBe("raspberry");

  // Chute taps (the empty spawn cell) cycle the waiting marble's color.
  await page.evaluate(() => window.__marblescape?.rotate(4, 0));
  expect(await page.evaluate(() => window.__marblescape?.waitingColor())).toBe("tangerine");
  await page.evaluate(() => window.__marblescape?.rotate(4, 0));
  expect(await page.evaluate(() => window.__marblescape?.waitingColor())).toBe("lemon");

  // Play drops exactly the previewed color, and the preview hides mid-run.
  await page.evaluate(() => window.__marblescape?.play());
  expect(await page.evaluate(() => window.__marblescape?.marbleColors())).toEqual(["lemon"]);
  expect(await page.evaluate(() => window.__marblescape?.waitingVisible())).toBe(false);
});

test("sandbox: the color tile places a colored cup and tapping the cup retints it", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.__marblescape), null, { timeout: 30_000 });

  // Five sandbox tiles: the four pieces + the color-cup tile.
  await expect(page.locator("[data-piece-type]")).toHaveCount(5);
  const colorTile = page.locator('[data-piece-type="goal"][data-color]');
  await expect(colorTile).toHaveAttribute("data-color", "raspberry");

  // Tap the tile: the swatch cycles (tap-vs-drag discrimination)…
  await colorTile.tap();
  await expect(colorTile).toHaveAttribute("data-color", "tangerine");

  // …then drag it onto the board: a tangerine cup lands at the drop cell.
  const tileBox = await colorTile.boundingBox();
  const canvasBox = await page.locator("canvas").boundingBox();
  if (!tileBox || !canvasBox) {
    throw new Error("missing bounding boxes");
  }
  const target = {
    x: canvasBox.x + canvasBox.width / 2 + 40,
    y: canvasBox.y + canvasBox.height / 2 + 30,
  };
  await page.mouse.move(tileBox.x + tileBox.width / 2, tileBox.y + tileBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x, target.y, { steps: 8 });
  await page.mouse.up();
  expect(await page.evaluate(() => window.__marblescape?.cupColorAt(4, 3))).toBe("tangerine");

  // Tap the placed cup: it cycles to the next candy color (no rotate).
  await page.mouse.click(target.x, target.y);
  expect(await page.evaluate(() => window.__marblescape?.cupColorAt(4, 3))).toBe("lemon");
});
