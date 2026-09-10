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

    // Collect celebration (FR1): a sparkle burst fired at the cup.
    await page.waitForFunction(() => (window.__marblescape?.burstCount() ?? 0) >= 1, null, {
      timeout: 15_000,
    });

    // Solve celebration (FR2): confetti shower + ▶ replay affordance.
    await expect(page.locator('[data-testid="confetti-layer"]')).toHaveAttribute("data-bursts", "1");
    await expect(page.getByTestId("solved-replay")).toBeVisible();

    // Badge persisted.
    const badges = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("marblescape.badges.v1") ?? "[]"),
    );
    expect(badges).toContain(id);

    // Post-solve overlay → Home → the level tile now shows its ✓ chip.
    await expect(page.locator('[data-testid="solved-overlay"]')).toBeVisible();
    await page
      .locator('[data-testid="solved-overlay"] button[aria-label="Back to level select"]')
      .click();
    await expect(page.locator(`[data-level-select="level-${id}"]`)).toContainText("✓");
  });
}

test("level 1: ▶ replay re-runs the same track without altering placements", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.__marblescape), null, { timeout: 30_000 });

  await page.getByTestId("hud-home").click();
  await page.locator('[data-level-select="level-1"]').click();
  await page.waitForFunction(() => window.__marblescape?.currentLevelId() === 1, null, {
    timeout: 10_000,
  });

  const placed = await page.evaluate(() => window.__marblescape?.place("straight", 3, 2) ?? false);
  expect(placed).toBe(true);

  await page.evaluate(() => window.__marblescape?.play());
  await page.waitForFunction(() => (window.__marblescape?.collectedCount() ?? 0) >= 1, null, {
    timeout: 45_000,
  });

  const overlay = page.locator('[data-testid="solved-overlay"]');
  await expect(overlay).toBeVisible();
  await expect(page.locator('[data-testid="confetti-layer"]')).toHaveAttribute("data-bursts", "1");

  // ▶ Play again: overlay hides, a fresh marble drops on the untouched track.
  await page.getByTestId("solved-replay").click();
  await expect(overlay).toBeHidden();
  await page.waitForFunction(() => (window.__marblescape?.collectedCount() ?? 0) >= 2, null, {
    timeout: 45_000,
  });
  await expect(overlay).toBeVisible();
  await expect(page.locator('[data-testid="confetti-layer"]')).toHaveAttribute("data-bursts", "2");

  // Never left the level; 🏠 still returns to the ✓ tile.
  expect(await page.evaluate(() => window.__marblescape?.currentLevelId())).toBe(1);
  await page
    .locator('[data-testid="solved-overlay"] button[aria-label="Back to level select"]')
    .click();
  await expect(page.locator('[data-level-select="level-1"]')).toContainText("✓");
});
