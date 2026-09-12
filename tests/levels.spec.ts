import { expect, test } from "@playwright/test";
import type { PieceType } from "../src/domain/pieces";
import { blockFirstRun } from "./helpers";

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

    // Nothing locked: all ten tiles (sandbox + nine levels) from the start.
    await page.getByTestId("hud-home").click();
    for (let tile = 0; tile <= 9; tile += 1) {
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

test("level 7: two colors need one reroute before the level completes", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.__marblescape), null, { timeout: 30_000 });

  await page.getByTestId("hud-home").click();
  await page.locator('[data-level-select="level-7"]').click();
  await page.waitForFunction(() => window.__marblescape?.currentLevelId() === 7, null, {
    timeout: 10_000,
  });
  expect(await page.evaluate(() => window.__marblescape?.waitingColor())).toBe("raspberry");

  // Raspberry route: the straight bridge at (3,2) drops it into its cup.
  const placed = await page.evaluate(() => window.__marblescape?.place("straight", 3, 2) ?? false);
  expect(placed).toBe(true);
  await page.evaluate(() => window.__marblescape?.play());
  await page.waitForFunction(() => (window.__marblescape?.collectedCount() ?? 0) >= 1, null, {
    timeout: 45_000,
  });

  // Partial progress is not a solve; the chute waits with the next color.
  await expect(page.locator('[data-testid="solved-overlay"]')).toBeHidden();
  await page.waitForFunction(() => window.__marblescape?.waitingColor() === "mint", null, {
    timeout: 10_000,
  });

  // Reroute: swap the bridge for a curve so mint can turn toward its cup.
  await page.evaluate(() => window.__marblescape?.remove(3, 2));
  const replaced = await page.evaluate(() => window.__marblescape?.place("curved", 3, 2) ?? false);
  expect(replaced).toBe(true);
  await page.evaluate(() => window.__marblescape?.play());
  await page.waitForFunction(() => (window.__marblescape?.collectedCount() ?? 0) >= 2, null, {
    timeout: 45_000,
  });

  // Solved: celebration, badge, and the ✓ chip after going home.
  await expect(page.locator('[data-testid="solved-overlay"]')).toBeVisible();
  const badges = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("marblescape.badges.v1") ?? "[]"),
  );
  expect(badges).toContain(7);
  await page
    .locator('[data-testid="solved-overlay"] button[aria-label="Back to level select"]')
    .click();
  await expect(page.locator('[data-level-select="level-7"]')).toContainText("✓");
});

test("levels 8-9 ship playable: scripted previews, cups, and a live drop", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.__marblescape), null, { timeout: 30_000 });
  await page.getByTestId("hud-home").click();

  // Level 8: the funnel lesson; lemon waits at the chute.
  await page.locator('[data-level-select="level-8"]').click();
  await page.waitForFunction(() => window.__marblescape?.currentLevelId() === 8, null, {
    timeout: 10_000,
  });
  expect(await page.evaluate(() => window.__marblescape?.waitingColor())).toBe("lemon");
  const bridged = await page.evaluate(() => window.__marblescape?.place("funnel", 3, 2) ?? false);
  expect(bridged).toBe(true);
  await page.evaluate(() => window.__marblescape?.play());
  await page.waitForFunction(() => (window.__marblescape?.marbleColors() ?? []).includes("lemon"), null, {
    timeout: 30_000,
  });

  // Fresh session for level 9: three cups, three colors.
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.__marblescape), null, { timeout: 30_000 });
  await page.getByTestId("hud-home").click();
  await page.locator('[data-level-select="level-9"]').click();
  await page.waitForFunction(() => window.__marblescape?.currentLevelId() === 9, null, {
    timeout: 10_000,
  });
  expect(await page.evaluate(() => window.__marblescape?.waitingColor())).toBe("raspberry");
  const cups = await page.evaluate(() => [
    window.__marblescape?.cupColorAt(3, 5) ?? null,
    window.__marblescape?.cupColorAt(4, 5) ?? null,
    window.__marblescape?.cupColorAt(5, 5) ?? null,
  ]);
  expect(cups).toEqual(["raspberry", "mint", "grape"]);
});

test("a mismatched marble rolls away quietly; the next Play clears it and collects", async ({
  page,
}) => {
  await blockFirstRun(page);
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.__marblescape), null, { timeout: 30_000 });

  // Mint cup under the chute; a grape marble must roll over the closed lid.
  const placed = await page.evaluate(
    () => window.__marblescape?.place("goal", 4, 0, "mint") ?? false,
  );
  expect(placed).toBe(true);
  await page.evaluate(() => window.__marblescape?.play("grape"));
  await page.waitForFunction(
    () => (window.__marblescape?.marblePositions()[0]?.z ?? 0) > 1.2,
    null,
    { timeout: 30_000 },
  );
  expect(await page.evaluate(() => window.__marblescape?.collectedCount())).toBe(0);

  // Wait until the wanderer truly rests (position stable across polls), then
  // give the settle detector its consecutive still steps.
  let before: { x: number; y: number; z: number } | undefined;
  for (let i = 0; i < 30; i += 1) {
    const now = await page.evaluate(() => window.__marblescape?.marblePositions()[0]);
    if (before && now && Math.hypot(now.x - before.x, now.y - before.y, now.z - before.z) < 0.02) {
      break;
    }
    before = now;
    await page.waitForTimeout(800);
  }
  await page.waitForTimeout(1200);

  // The next Play quietly replaces the leftover and drops the matching color.
  await page.evaluate(() => window.__marblescape?.play("mint"));
  await page.waitForFunction(() => (window.__marblescape?.collectedCount() ?? 0) >= 1, null, {
    timeout: 45_000,
  });
  expect(await page.evaluate(() => window.__marblescape?.rescuedCount())).toBe(0);
  expect(await page.evaluate(() => window.__marblescape?.marbleCount())).toBe(0);
});
