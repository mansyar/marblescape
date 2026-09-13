import { expect, test } from "@playwright/test";
import { blockFirstRun } from "./helpers";

declare global {
  interface Window {
    __marblescape?: import("../src/game/game").Game;
  }
}

async function boot(page: import("@playwright/test").Page): Promise<void> {
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.__marblescape), null, { timeout: 30_000 });
}

/** Waits until all ten tiles show a decoded, camera-matched preview image. */
async function waitForTilePictures(page: import("@playwright/test").Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const tiles = Array.from(document.querySelectorAll<HTMLElement>("button[data-level-select]"));
      if (tiles.length !== 10) {
        return false;
      }
      return tiles.every((tile) => {
        const img = tile.querySelector("img");
        return img instanceof HTMLImageElement && img.naturalWidth > 0;
      });
    },
    null,
    { timeout: 15_000 },
  );
}

test.beforeEach(async ({ page }) => {
  await blockFirstRun(page);
});

test("level select: every tile is a picture with no visible text and a big target", async ({
  page,
}) => {
  await boot(page);
  await page.getByTestId("hud-home").click();
  await waitForTilePictures(page);

  // No visible words on any tile; screen readers get names instead.
  const texts = await page.locator("button[data-level-select]").allInnerTexts();
  expect(texts.map((text) => text.trim())).toEqual(texts.map(() => ""));
  await expect(page.locator('button[data-level-select="sandbox"]')).toHaveAttribute(
    "aria-label",
    "Sandbox",
  );
  await expect(page.locator('button[data-level-select="level-1"]')).toHaveAttribute(
    "aria-label",
    "Level 1",
  );
  await expect(page.locator('button[data-level-select="level-9"]')).toHaveAttribute(
    "aria-label",
    "Level 9",
  );

  // Small fingers: every tile stays a ≥64px target in every orientation.
  const boxes = await page.locator("button[data-level-select]").evaluateAll((els) =>
    els.map((el) => {
      const rect = el.getBoundingClientRect();
      return { width: rect.width, height: rect.height };
    }),
  );
  expect(boxes).toHaveLength(10);
  for (const box of boxes) {
    expect(box.width).toBeGreaterThanOrEqual(64);
    expect(box.height).toBeGreaterThanOrEqual(64);
  }
});

test("sandbox tile: the snapshot follows the child's build", async ({ page }) => {
  await boot(page);
  await page.getByTestId("hud-home").click();
  await waitForTilePictures(page);
  const before = await page.locator('button[data-level-select="sandbox"] img').getAttribute("src");

  await page.locator('button[data-level-select="sandbox"]').click();
  await page.evaluate(() => window.__marblescape?.place("straight", 2, 2));
  await page.evaluate(() => window.__marblescape?.place("curved", 4, 3));
  await page.getByTestId("hud-home").click();
  await waitForTilePictures(page);

  const after = await page.locator('button[data-level-select="sandbox"] img').getAttribute("src");
  expect(after).not.toBe(before);
});

test("sandbox tile: keeps showing the parked build while a level is loaded", async ({ page }) => {
  await boot(page);
  await page.evaluate(() => window.__marblescape?.place("straight", 2, 2));
  await page.getByTestId("hud-home").click();
  await waitForTilePictures(page);
  const parked = await page
    .locator('button[data-level-select="sandbox"] img')
    .getAttribute("src");

  await page.locator('button[data-level-select="level-1"]').click();
  await page.waitForFunction(() => window.__marblescape?.currentLevelId() === 1, null, {
    timeout: 10_000,
  });
  await page.getByTestId("hud-home").click();
  await waitForTilePictures(page);

  // Same build, same snapshot — never the level's furniture.
  await expect(page.locator('button[data-level-select="sandbox"] img')).toHaveAttribute(
    "src",
    parked ?? "",
  );
});

test("solved levels keep their ✓ chip over picture tiles", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("marblescape.badges.v1", "[3]");
  });
  await boot(page);
  await page.getByTestId("hud-home").click();
  await waitForTilePictures(page);

  await expect(page.locator('button[data-level-select="level-3"]')).toContainText("✓");
  await expect(page.locator('button[data-level-select="level-4"]')).not.toContainText("✓");
});
