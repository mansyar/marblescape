import { expect, test } from "@playwright/test";
import type { PieceType } from "../src/domain/pieces";

declare global {
  interface Window {
    __marblescape?: import("../src/game/game").Game;
  }
}

// Gap placements required to solve each level (level data from src/domain/levels.ts).
const LEVEL_GAPS: Record<number, Array<[number, number, PieceType]>> = {
  1: [[3, 2, "straight"]],
  2: [
    [3, 2, "straight"],
    [3, 4, "curved"],
  ],
  3: [
    [3, 3, "straight"],
    [3, 4, "curved"],
  ],
  4: [
    [3, 2, "straight"],
    [3, 5, "goal"],
  ],
  5: [
    [3, 2, "straight"],
    [3, 4, "funnel"],
  ],
  6: [
    [3, 1, "straight"],
    [3, 3, "funnel"],
    [3, 4, "curved"],
  ],
};

for (const [idStr, gaps] of Object.entries(LEVEL_GAPS)) {
  const id = Number(idStr);

  test(`level ${id} solves end-to-end: select → bridge gaps → marble collected → ✓ badge`, async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForFunction(() => Boolean(window.__marblescape), null, { timeout: 30_000 });

    // Nothing locked: all 7 tiles present from the start.
    await page.getByTestId("hud-home").click();
    for (let tile = 0; tile <= 6; tile += 1) {
      await expect(page.locator(`[data-level-select="${tile === 0 ? "sandbox" : `level-${tile}`}"]`)).toBeVisible();
    }

    // Enter the level through the tile.
    await page.locator(`[data-level-select="level-${id}"]`).click();
    await page.waitForFunction(
      (levelId) => window.__marblescape?.currentLevelId() === levelId,
      id,
      { timeout: 10_000 },
    );

    // Bridge every gap with the palette piece it accepts.
    for (const [x, y, type] of gaps) {
      const placed = await page.evaluate(
        ([px, py, ptype]) => window.__marblescape?.place(ptype, px, py) ?? false,
        [x, y, type],
      );
      expect(placed).toBe(true);
    }

    await page.evaluate(() => window.__marblescape?.play());
    // Generous timeout: cold-start contention (dev server + WASM + glTF) can
    // delay the first physics step; the sim itself is fast once running.
    await page.waitForFunction(
      (levelId) => (window.__marblescape?.collectedCount() ?? 0) >= 1,
      id,
      { timeout: 45_000 },
    );

    // Badge persisted.
    const badges = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("marblescape.badges.v1") ?? "[]"),
    );
    expect(badges).toContain(id);

    // Post-solve overlay → Home → the level tile now shows its ✓ chip.
    await expect(page.locator('[data-testid="solved-overlay"]')).toBeVisible();
    await page.locator('[data-testid="solved-overlay"] button').click();
    await expect(page.locator(`[data-level-select="level-${id}"]`)).toContainText("✓");
  });
}
