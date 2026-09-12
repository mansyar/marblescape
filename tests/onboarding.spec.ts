import { expect, test } from "@playwright/test";

declare global {
  interface Window {
    __marblescape?: import("../src/game/game").Game;
  }
}

const BOARD_KEY = "marblescape.board.v1";
const FLAG_KEY = "marblescape.onboarded.v1";
const STARTER_PIECES = 5;

async function boot(page: import("@playwright/test").Page): Promise<void> {
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.__marblescape), null, { timeout: 30_000 });
}

test("fresh boot: starter track seeded, gap open, and cues at step 'place'", async ({ page }) => {
  await boot(page);

  const seed = await page.evaluate(() => ({
    chute: window.__marblescape?.pieceAt(4, 0)?.type ?? null,
    second: window.__marblescape?.pieceAt(4, 1)?.type ?? null,
    gap: window.__marblescape?.pieceAt(4, 2) ?? null,
    fourth: window.__marblescape?.pieceAt(4, 3)?.type ?? null,
    fifth: window.__marblescape?.pieceAt(4, 4)?.type ?? null,
    goal: window.__marblescape?.pieceAt(4, 5)?.type ?? null,
    goalColor: window.__marblescape?.cupColorAt(4, 5) ?? null,
  }));
  expect(seed).toEqual({
    chute: "straight",
    second: "straight",
    gap: null,
    fourth: "straight",
    fifth: "straight",
    goal: "goal",
    goalColor: null,
  });

  // The seed is saved immediately, before the debounced auto-save fires.
  const saved = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key) ?? "null"),
    BOARD_KEY,
  );
  expect(saved?.pieces).toHaveLength(STARTER_PIECES);

  // Step 1 cues: target ring at the gap, hand gesturing, Ramp tile pulsing.
  const cues = page.locator("[data-onboarding-cues]");
  await expect(cues).toBeVisible();
  await expect(cues).toHaveAttribute("data-onboarding-step", "place");
  await expect(page.locator('[data-onboarding="ring"]')).toBeVisible();
  await expect(page.locator('[data-onboarding="hand"]')).toHaveAttribute(
    "data-onboarding-target",
    "gap",
  );
  await expect(page.locator('[data-piece-type="straight"]')).toHaveClass(/ms-palette-pulse/);

  // Cues never block input and stay out of the accessibility tree.
  expect(await cues.evaluate((el) => getComputedStyle(el).pointerEvents)).toBe("none");
  expect(await cues.evaluate((el) => el.getAttribute("aria-hidden"))).toBe("true");
});

test("placing a piece advances the cues to 'play'", async ({ page }) => {
  await boot(page);

  const placed = await page.evaluate(() => window.__marblescape?.place("straight", 4, 2) ?? false);
  expect(placed).toBe(true);

  const cues = page.locator("[data-onboarding-cues]");
  await expect(cues).toHaveAttribute("data-onboarding-step", "play");
  await expect(page.locator('[data-onboarding="ring"]')).toBeHidden();
  await expect(page.locator('[data-piece-type="straight"]')).not.toHaveClass(/ms-palette-pulse/);
  await expect(page.getByRole("button", { name: "▶" })).toHaveAttribute(
    "data-onboarding",
    "play",
  );
  await expect(page.locator('[data-onboarding="hand"]')).toHaveAttribute(
    "data-onboarding-target",
    "play",
  );
});

test("first Play completes: flag written, cues gone, and the child's board persists", async ({
  page,
}) => {
  await boot(page);

  // The child fills the gap, then presses Play.
  await page.evaluate(() => window.__marblescape?.place("straight", 4, 2));
  await page.evaluate(() => window.__marblescape?.play());

  expect(await page.evaluate((key) => localStorage.getItem(key), FLAG_KEY)).toBe("done");
  const cues = page.locator("[data-onboarding-cues]");
  await expect(cues).toHaveAttribute("data-onboarding-step", "done");
  await expect(cues).toBeHidden();

  // Reload: never shown again, and the child's edit is still saved.
  await page.reload();
  await page.waitForFunction(() => Boolean(window.__marblescape), null, { timeout: 30_000 });
  await expect(page.locator("[data-onboarding-cues]")).toHaveCount(0);
  const after = await page.evaluate(
    (key) => ({
      edit: window.__marblescape?.pieceAt(4, 2)?.type ?? null,
      count: JSON.parse(localStorage.getItem(key) ?? "null")?.pieces?.length ?? -1,
    }),
    BOARD_KEY,
  );
  // Starter track + the child's own piece both survive the reload.
  expect(after).toEqual({ edit: "straight", count: STARTER_PIECES + 1 });
});

test("pressing Play before placing anything also completes the onboarding", async ({ page }) => {
  await boot(page);

  await page.evaluate(() => window.__marblescape?.play());
  expect(await page.evaluate((key) => localStorage.getItem(key), FLAG_KEY)).toBe("done");
  await expect(page.locator("[data-onboarding-cues]")).toHaveAttribute(
    "data-onboarding-step",
    "done",
  );
});

test("an existing player with a saved board gets no seed and no cues", async ({ page }) => {
  await page.addInitScript((key) => {
    localStorage.setItem(
      key,
      JSON.stringify({
        version: 2,
        width: 8,
        height: 6,
        pieces: [{ id: "p9", type: "straight", rotation: 0, x: 0, y: 0 }],
      }),
    );
  }, BOARD_KEY);
  await boot(page);

  await expect(page.locator("[data-onboarding-cues]")).toHaveCount(0);
  const state = await page.evaluate(() => ({
    own: window.__marblescape?.pieceAt(0, 0)?.type ?? null,
    chute: window.__marblescape?.pieceAt(4, 0) ?? null,
  }));
  expect(state).toEqual({ own: "straight", chute: null });
});

test("an existing player with only the completion flag gets no seed and no cues", async ({
  page,
}) => {
  await page.addInitScript((key) => localStorage.setItem(key, "done"), FLAG_KEY);
  await boot(page);

  await expect(page.locator("[data-onboarding-cues]")).toHaveCount(0);
  const state = await page.evaluate(
    (key) => ({
      chute: window.__marblescape?.pieceAt(4, 0) ?? null,
      saved: localStorage.getItem(key),
    }),
    BOARD_KEY,
  );
  expect(state).toEqual({ chute: null, saved: null });
});

test("reduced motion: static hand beside the Ramp tile, still completable", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await boot(page);

  const cues = page.locator("[data-onboarding-cues]");
  await expect(cues).toHaveAttribute("data-onboarding-motion", "static");
  const hand = page.locator('[data-onboarding="hand"]');
  await expect(hand).toBeVisible();
  await expect(hand).toHaveAttribute("data-onboarding-target", "tile");
  await expect(page.locator('[data-onboarding="ring"]')).toBeVisible();

  // The sequence remains completable without any traveling animation.
  await page.evaluate(() => window.__marblescape?.place("straight", 4, 2));
  await expect(hand).toHaveAttribute("data-onboarding-target", "play");
  await page.evaluate(() => window.__marblescape?.play());
  expect(await page.evaluate((key) => localStorage.getItem(key), FLAG_KEY)).toBe("done");
});

test("landscape boot keeps the ring inside the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await boot(page);

  const ring = page.locator('[data-onboarding="ring"]');
  await expect(ring).toBeVisible();
  const box = await ring.boundingBox();
  if (!box) {
    throw new Error("ring not measurable");
  }
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(844);
  expect(box.y + box.height).toBeLessThanOrEqual(390);
});

test("cues hide in puzzle mode and under the level select, resuming in the sandbox", async ({
  page,
}) => {
  await boot(page);
  const cues = page.locator("[data-onboarding-cues]");
  await expect(cues).toBeVisible();

  // Puzzle mode: hidden; returning to the sandbox resumes them.
  await page.evaluate(() => window.__marblescape?.enterLevel(1));
  await expect(cues).toBeHidden();
  await page.evaluate(() => window.__marblescape?.exitLevel());
  await expect(cues).toBeVisible();

  // Level select overlay: hidden; picking the sandbox resumes them.
  await page.getByTestId("hud-home").click();
  await expect(page.locator('[data-level-select="overlay"]')).toBeVisible();
  await expect(cues).toBeHidden();
  await page.locator('[data-level-select="sandbox"]').click();
  await expect(cues).toBeVisible();
});

test("a rejected drop does not silence the Ramp tile pulse", async ({ page }) => {
  await boot(page);
  const tile = page.locator('[data-piece-type="straight"]');

  // Drag the Ramp onto the occupied chute cell: the board rejects the drop.
  const tileBox = await tile.boundingBox();
  if (!tileBox) {
    throw new Error("ramp tile not visible");
  }
  const target = await page.evaluate(() => window.__marblescape?.cellToScreen(4, 0) ?? null);
  if (!target) {
    throw new Error("chute anchor unavailable");
  }
  await page.mouse.move(tileBox.x + tileBox.width / 2, tileBox.y + tileBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x, target.y, { steps: 8 });
  await page.mouse.up();

  // After the reject shake finishes, the invitation pulse must still play.
  await page.waitForTimeout(450);
  expect(await tile.evaluate((el) => getComputedStyle(el).animationName)).toContain(
    "ms-palette-pulse",
  );
});
