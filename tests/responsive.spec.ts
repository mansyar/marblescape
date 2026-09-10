import { expect, test } from "@playwright/test";
import { BOARD_COLS, BOARD_ROWS, CAMERA_FOV_DEG, computeCameraFraming } from "../src/render/framing";
import { screenToCell } from "../src/game/picking";
import { cameraReservation } from "../src/ui/layout";

declare global {
  interface Window {
    __marblescape?: import("../src/game/game").Game;
  }
}

const LEVEL_1_GAP = { x: 3, y: 2 };

/**
 * Finds an NDC point whose ray lands on the given board cell, using the same
 * pure math the app runs at pointer time (framing + reservation). Lets the
 * test drive a real pointer drag onto an exact cell.
 */
function ndcForCell(
  target: { x: number; y: number },
  width: number,
  height: number,
): { ndcX: number; ndcY: number } | null {
  const aspect = width / height;
  const framing = computeCameraFraming(
    aspect,
    BOARD_COLS,
    BOARD_ROWS,
    CAMERA_FOV_DEG,
    cameraReservation(width, height),
  );
  for (let i = 0; i <= 48; i += 1) {
    for (let j = 0; j <= 48; j += 1) {
      const ndcX = -0.4 + (0.8 * i) / 48;
      const ndcY = -0.4 + (0.8 * j) / 48;
      const cell = screenToCell(ndcX, ndcY, framing, aspect);
      if (cell && cell.x === target.x && cell.y === target.y) {
        return { ndcX, ndcY };
      }
    }
  }
  return null;
}

async function enterLevel(page: import("@playwright/test").Page, id: number): Promise<void> {
  await page.locator('[data-testid="hud-home"]').click();
  await page.locator(`[data-level-select="level-${id}"]`).click();
  await page.waitForFunction(() => Boolean(window.__marblescape), null, { timeout: 30_000 });
}

test("palette: right-side vertical rail in landscape, bottom bar in portrait", async ({ page }) => {
  const viewport = page.viewportSize();
  if (!viewport) throw new Error("missing viewport");
  await page.goto("/");
  await enterLevel(page, 6); // Finale: palette has all four pieces

  const ramp = page.locator('[data-piece-type="straight"]');
  const curve = page.locator('[data-piece-type="curved"]');
  const funnel = page.locator('[data-piece-type="funnel"]');
  const goal = page.locator('[data-piece-type="goal"]');
  const rampBox = await ramp.boundingBox();
  const curveBox = await curve.boundingBox();
  const funnelBox = await funnel.boundingBox();
  const goalBox = await goal.boundingBox();
  if (!rampBox || !curveBox || !funnelBox || !goalBox) {
    throw new Error("palette buttons not all visible");
  }

  // Every touch target stays ≥ 72px in both modes.
  for (const box of [rampBox, curveBox, funnelBox, goalBox]) {
    expect(box.height).toBeGreaterThanOrEqual(72);
  }

  const isLandscape = viewport.width >= viewport.height;
  if (isLandscape) {
    // Right-side rail: hugs the right edge, ordered top → bottom.
    expect(rampBox.x).toBeGreaterThan(viewport.width * 0.8);
    expect(rampBox.y).toBeLessThan(curveBox.y);
    expect(curveBox.y).toBeLessThan(funnelBox.y);
    expect(funnelBox.y).toBeLessThan(goalBox.y);
  } else {
    // Bottom bar: centered, ordered left → right, resting on the bottom edge.
    expect(rampBox.x).toBeLessThan(curveBox.x);
    expect(curveBox.x).toBeLessThan(funnelBox.x);
    expect(funnelBox.x).toBeLessThan(goalBox.x);
    expect(rampBox.y + rampBox.height).toBeGreaterThan(viewport.height - 30);
  }
});

test("dragging a piece from the rail places it on the board", async ({ page }) => {
  const viewport = page.viewportSize();
  if (!viewport) throw new Error("missing viewport");
  test.skip(viewport.width < viewport.height, "the rail exists only in landscape");

  await page.goto("/");
  await enterLevel(page, 1);

  const ndc = ndcForCell(LEVEL_1_GAP, viewport.width, viewport.height);
  expect(ndc).not.toBeNull();
  if (!ndc) return;

  const canvasBox = await page.locator("canvas").boundingBox();
  if (!canvasBox) throw new Error("canvas not visible");
  const dropX = canvasBox.x + ((ndc.ndcX + 1) / 2) * canvasBox.width;
  const dropY = canvasBox.y + ((1 - ndc.ndcY) / 2) * canvasBox.height;

  const rampBox = await page.locator('[data-piece-type="straight"]').boundingBox();
  if (!rampBox) throw new Error("ramp button not visible");
  await page.mouse.move(rampBox.x + rampBox.width / 2, rampBox.y + rampBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(dropX, dropY, { steps: 8 });
  await page.mouse.up();

  const placed = await page.evaluate(
    () => window.__marblescape?.pieceAt(3, 2)?.type ?? null,
  );
  expect(placed).toBe("straight");
});

test("level select: all seven tiles visible and tappable", async ({ page }) => {
  await page.goto("/");
  await page.locator('[data-testid="hud-home"]').click();
  await expect(page.locator('[data-level-select="sandbox"]')).toBeVisible();
  for (let id = 1; id <= 6; id += 1) {
    const tile = page.locator(`[data-level-select="level-${id}"]`);
    await expect(tile).toBeVisible();
    const box = await tile.boundingBox();
    if (!box) throw new Error(`level ${id} tile not measurable`);
    expect(box.width).toBeGreaterThanOrEqual(72);
    expect(box.height).toBeGreaterThanOrEqual(72);
  }
  await page.locator('[data-level-select="level-1"]').click();
  await expect(page.locator("canvas")).toBeVisible();
});

test("resize to landscape re-frames without reload and keeps the board solvable", async ({ page }) => {
  await page.goto("/");
  await enterLevel(page, 1);

  const placed = await page.evaluate(
    () => window.__marblescape?.place("straight", 3, 2) ?? false,
  );
  expect(placed).toBe(true);

  // Rotate the device: same page, no reload.
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForFunction(
    () => window.__marblescape?.pieceAt(3, 2)?.type === "straight",
    null,
    { timeout: 5_000 },
  );

  await page.evaluate(() => window.__marblescape?.play());
  await page.waitForFunction(() => (window.__marblescape?.collectedCount() ?? 0) >= 1, null, {
    timeout: 15_000,
  });
});