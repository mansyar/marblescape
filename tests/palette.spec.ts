import { expect, test } from "@playwright/test";
import { colorHex, type MarbleColor } from "../src/domain/colors";
import { blockFirstRun } from "./helpers";

declare global {
  interface Window {
    __marblescape?: import("../src/game/game").Game;
  }
}

/** Sandbox palette tiles: four plain pieces + the color-cup tile. */
const SANDBOX_TILES = 5;

async function boot(page: import("@playwright/test").Page): Promise<void> {
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.__marblescape), null, { timeout: 30_000 });
}

/** Waits until every sandbox tile shows a decoded snapshot image. */
async function waitForPictures(page: import("@playwright/test").Page): Promise<void> {
  await page.waitForFunction(
    (tiles) => {
      const imgs = Array.from(document.querySelectorAll<HTMLImageElement>("[data-piece-type] img"));
      return imgs.length === tiles && imgs.every((img) => img.naturalWidth > 0);
    },
    SANDBOX_TILES,
    { timeout: 15_000 },
  );
}

/** hex (#rrggbb) → the rgb() string browsers serialize inline colors to. */
function hexToRgb(hex: string): string {
  const value = Number.parseInt(hex.slice(1), 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgb(${r}, ${g}, ${b})`;
}

test.beforeEach(async ({ page }) => {
  await blockFirstRun(page);
});

test("sandbox palette: every tile is a picture with no visible words", async ({ page }) => {
  await boot(page);
  await waitForPictures(page);

  // Zero visible text on any tile (screen readers get the names instead).
  const texts = await page.locator("[data-piece-type]").allInnerTexts();
  expect(texts.map((text) => text.trim())).toEqual(texts.map(() => ""));

  await expect(page.locator('[data-piece-type="straight"]')).toHaveAttribute("aria-label", "Ramp");
  await expect(page.locator('[data-piece-type="curved"]')).toHaveAttribute("aria-label", "Curve");
  await expect(page.locator('[data-piece-type="funnel"]')).toHaveAttribute("aria-label", "Funnel");
  await expect(page.locator('[data-piece-type="goal"][data-color]')).toHaveAttribute(
    "aria-label",
    "Hole",
  );
});

test("cup tile: the candy dot cycles on tap", async ({ page }) => {
  await boot(page);
  await waitForPictures(page);

  const cup = page.locator('[data-piece-type="goal"][data-color]');
  const before = await cup.getAttribute("data-color");
  await cup.click();
  await expect(cup).not.toHaveAttribute("data-color", before ?? "");

  // The dot repaints with the new candy color.
  const after = (await cup.getAttribute("data-color")) as MarbleColor | null;
  if (after) {
    await expect
      .poll(async () => cup.locator("span").evaluate((el) => getComputedStyle(el).backgroundColor))
      .toBe(hexToRgb(colorHex(after)));
  }
});

test("dragging a picture tile still places the piece", async ({ page }) => {
  await boot(page);
  await waitForPictures(page);

  const tile = page.locator('[data-piece-type="straight"]');
  const box = await tile.boundingBox();
  if (!box) {
    throw new Error("ramp tile not visible");
  }
  const target = await page.evaluate(() => window.__marblescape?.cellToScreen(3, 2) ?? null);
  if (!target) {
    throw new Error("cell anchor unavailable");
  }

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x, target.y, { steps: 8 });
  await page.mouse.up();

  await expect
    .poll(async () => page.evaluate(() => window.__marblescape?.pieceAt(3, 2)?.type ?? null))
    .toBe("straight");
});

test("landscape: picture tiles fill the right rail", async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await boot(page);
  await waitForPictures(page);

  const box = await page.locator('[data-piece-type="straight"]').boundingBox();
  if (!box) {
    throw new Error("ramp tile not visible");
  }
  expect(box.x).toBeGreaterThan(844 * 0.8);
});

test("landscape: every rail tile is hit-testable at its center", async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await boot(page);
  await waitForPictures(page);

  const tiles = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("[data-piece-type]")].map((tile) => {
      const box = tile.getBoundingClientRect();
      const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
      return {
        type: tile.dataset.pieceType,
        reachable: hit !== null && (hit === tile || tile.contains(hit)),
      };
    }),
  );
  for (const tile of tiles) {
    expect(tile.reachable, `${tile.type} tile must be reachable at its center`).toBe(true);
  }
});