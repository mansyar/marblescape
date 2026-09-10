import { Game } from "./game/game";
import { createGestureTracker } from "./game/gestures";
import { screenToCell } from "./game/picking";
import { BOARD_COLS, BOARD_ROWS, CAMERA_FOV_DEG, computeCameraFraming } from "./render/framing";
import { layoutMode } from "./ui/layout";
import { createHud } from "./ui/hud";
import { createPalette } from "./ui/palette";
import { createUpdateBanner } from "./ui/update-banner";
import { registerSW } from "virtual:pwa-register";
import { LEVELS } from "./domain/levels";
import { createLevelSelect, hideLevelSelect, showLevelSelect } from "./ui/level-select";

declare global {
  interface Window {
    __marblescape?: Game;
  }
}

const app = document.querySelector<HTMLDivElement>("#app");
if (app) {
  app.style.position = "fixed";
  app.style.inset = "0";
  const game = new Game(app);
  void game.start().then(() => {
    const aspect = () => window.innerWidth / window.innerHeight;
    const cellFromNdc = (ndcX: number, ndcY: number | null) => {
      if (ndcY === null) {
        return null;
      }
      const reserved = layoutMode(window.innerWidth, window.innerHeight).reservedWidth;
      const framing = computeCameraFraming(
        aspect(),
        BOARD_COLS,
        BOARD_ROWS,
        CAMERA_FOV_DEG,
        reserved,
      );
      return screenToCell(ndcX, ndcY, framing, aspect());
    };

    // Palette: drag new pieces onto the board. Rebuilt per mode so level
    // palettes stay restricted to the pieces that solve that level.
    let paletteBar: HTMLElement | null = null;
    const buildPalette = () => {
      paletteBar?.remove();
      paletteBar = createPalette(
        app,
        game.currentPalette(),
        (_type, ndcX, ndcY) => {
          const cell = cellFromNdc(ndcX, ndcY);
          game.showHighlight(cell, cell ? game.isPlaceable(cell.x, cell.y, _type) : false);
        },
        (type, ndcX, ndcY) => {
          game.hideHighlight();
          const cell = cellFromNdc(ndcX, ndcY);
          if (cell) {
            game.place(type, cell.x, cell.y);
          }
        },
      );
      document.body.appendChild(paletteBar);
    };
    buildPalette();

    // Level select: 7 tiles (sandbox + 6 levels), nothing locked.
    const levelSelect = createLevelSelect(document.body, LEVELS, new Set(), (pick) => {
      hideLevelSelect(levelSelect);
      if (pick === "sandbox") {
        game.exitLevel();
        buildPalette();
      } else if (game.currentLevelId() !== pick) {
        game.exitLevel();
        game.enterLevel(pick);
        buildPalette();
      }
      // Picking the level already open keeps its placements (board replayable).
    });
    createHud(game, document.body, () => showLevelSelect(levelSelect));

    // Update banner: prompts when a new version finished installing.
    // Tap Update to apply (page reloads); ✕ dismisses until the next update.
    const updateBanner = createUpdateBanner(document.body, () => {
      updateSW(true);
    });
    const updateSW = registerSW({
      immediate: true,
      onNeedRefresh: () => updateBanner.show(),
      onOfflineReady: () => {},
    });

    // Post-solve overlay: ✓ pulse + big Home button on the first successful run.
    const solvedOverlay = document.createElement("div");
    solvedOverlay.dataset.testid = "solved-overlay";
    solvedOverlay.style.cssText =
      "position:fixed;inset:0;z-index:18;display:none;align-items:center;justify-content:center;flex-direction:column;gap:24px;background:rgba(20,30,40,0.55)";
    const solvedCheck = document.createElement("div");
    solvedCheck.textContent = "✓";
    solvedCheck.style.cssText =
      "width:112px;height:112px;border-radius:50%;background:#06d6a0;color:#fff;font-size:64px;font-weight:800;display:flex;align-items:center;justify-content:center;animation:ms-pop 0.5s ease-out;box-shadow:0 8px 24px rgba(6,214,160,0.6)";
    const solvedHome = document.createElement("button");
    solvedHome.textContent = "🏠";
    solvedHome.setAttribute("aria-label", "Back to level select");
    solvedHome.style.cssText =
      "min-width:112px;min-height:112px;font-size:52px;border-radius:24px;border:3px solid #2c3e50;background:#073b4c;touch-action:manipulation";
    const solvedLabel = document.createElement("div");
    solvedLabel.textContent = "Level solved!";
    solvedLabel.style.cssText = "color:#f8f3e9;font-size:28px;font-weight:700";
    solvedOverlay.append(solvedCheck, solvedLabel, solvedHome);
    document.body.appendChild(solvedOverlay);
    const hideSolved = () => {
      solvedOverlay.style.display = "none";
    };
    solvedHome.addEventListener("click", () => {
      hideSolved();
      showLevelSelect(levelSelect);
    });
    game.onLevelSolved = () => {
      solvedOverlay.style.display = "flex";
    };
    const style = document.createElement("style");
    style.textContent =
      "@keyframes ms-pop{0%{transform:scale(0.4)}60%{transform:scale(1.15)}100%{transform:scale(1)}}";
    document.head.appendChild(style);

    // Test hook for Playwright smoke/reliability runs.
    window.__marblescape = game;

    // Play surface: tap rotates, hold-drag moves a placed piece.
    const gestures = createGestureTracker();
    let draggingFrom: { x: number; y: number } | null = null;
    const clientToNdc = (cx: number, cy: number): [number, number | null] => {
      const canvas = app.querySelector("canvas");
      if (!canvas) {
        return [0, null];
      }
      const rect = canvas.getBoundingClientRect();
      const inside = cx >= rect.left && cx <= rect.right && cy >= rect.top && cy <= rect.bottom;
      if (!inside) {
        return [0, null];
      }
      return [((cx - rect.left) / rect.width) * 2 - 1, -(((cy - rect.top) / rect.height) * 2 - 1)];
    };
    const clientToCell = (cx: number, cy: number) => {
      const [ndcX, ndcY] = clientToNdc(cx, cy);
      return cellFromNdc(ndcX, ndcY);
    };

    app.addEventListener("pointerdown", (e) => {
      gestures.down(e.clientX, e.clientY, e.timeStamp);
    });
    app.addEventListener("pointermove", (e) => {
      const g = gestures.move(e.clientX, e.clientY, e.timeStamp);
      if (!g) {
        return;
      }
      if (g.type === "drag-start") {
        // The gesture reports the PRESS origin — a fast finger may already be
        // a cell away by the time the threshold is crossed.
        const origin = clientToCell(g.x, g.y);
        draggingFrom = origin && game.pieceAt(origin.x, origin.y) ? origin : null;
      } else if (g.type === "drag-move" && draggingFrom) {
        const cell = clientToCell(g.x, g.y);
        game.showHighlight(cell, cell ? game.isPlaceable(cell.x, cell.y) : false);
      }
    });
    app.addEventListener("pointerup", (e) => {
      const g = gestures.up(e.clientX, e.clientY, e.timeStamp);
      if (!g) {
        return;
      }
      if (g.type === "tap") {
        const cell = clientToCell(g.x, g.y);
        if (cell) {
          game.rotate(cell.x, cell.y);
        }
      } else if (g.type === "drag-end" && draggingFrom) {
        game.hideHighlight();
        const cell = clientToCell(g.x, g.y);
        if (cell) {
          game.move(draggingFrom.x, draggingFrom.y, cell.x, cell.y);
        } else {
          // Released off the board: the piece pops back to the palette.
          game.popOut(draggingFrom.x, draggingFrom.y);
        }
        draggingFrom = null;
      }
    });
    // Touch devices: scroll/zoom takeover fires pointercancel mid-gesture —
    // abort cleanly so no stray tap/drag-end lands after the cancel.
    app.addEventListener("pointercancel", () => {
      gestures.cancel();
      draggingFrom = null;
      game.hideHighlight();
    });
  });
}
