import { Game } from "./game/game";
import { createGestureTracker } from "./game/gestures";
import { screenToCell } from "./game/picking";
import { BOARD_COLS, BOARD_ROWS, CAMERA_FOV_DEG, computeCameraFraming } from "./render/framing";
import { registerViewportResize } from "./render/resize";
import { cameraReservation, layoutMode, type LayoutMode } from "./ui/layout";
import { createHud } from "./ui/hud";
import { createPalette, pulseReject } from "./ui/palette";
import { createUpdateBanner } from "./ui/update-banner";
import { createConfettiLayer } from "./ui/confetti";
import { createSolvedOverlay } from "./ui/solved-overlay";
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
      const reserved = cameraReservation(window.innerWidth, window.innerHeight);
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
    let paletteMode: LayoutMode = "portrait";
    const buildPalette = () => {
      paletteBar?.remove();
      paletteMode = layoutMode(window.innerWidth, window.innerHeight).mode;
      paletteBar = createPalette(
        app,
        game.currentPalette(),
        (_type, ndcX, ndcY) => {
          const cell = cellFromNdc(ndcX, ndcY);
          game.showHighlight(cell, cell ? game.isPlaceable(cell.x, cell.y, _type) : false);
        },
        (type, ndcX, ndcY, button) => {
          game.hideHighlight();
          const cell = cellFromNdc(ndcX, ndcY);
          if (!cell || !game.place(type, cell.x, cell.y)) {
            // Rejected (occupied, off-board, or not accepted here): the tile
            // shakes and the toy answers with a soft low tick.
            pulseReject(button);
            game.rejectPiece(cell);
          }
        },
        layoutMode(window.innerWidth, window.innerHeight).mode,
      );
      document.body.appendChild(paletteBar);
    };
    buildPalette();

    // Re-lay the palette when the viewport crosses the portrait/landscape
    // boundary (FR3): the camera already re-frames via scene.ts's watcher.
    registerViewportResize(window, () => {
      if (layoutMode(window.innerWidth, window.innerHeight).mode !== paletteMode) {
        buildPalette();
      }
    });

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

    // Solve celebration: confetti shower + ✓ pulse overlay with two big
    // buttons — ▶ replays the same track instantly, 🏠 goes home.
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const confetti = createConfettiLayer(document.body, { reducedMotion: reducedMotion.matches });
    reducedMotion.addEventListener("change", (event) => {
      confetti.setReducedMotion(event.matches);
    });
    const solvedOverlay = createSolvedOverlay(document.body, {
      onReplay: () => {
        solvedOverlay.hide();
        game.play();
      },
      onHome: () => {
        solvedOverlay.hide();
        showLevelSelect(levelSelect);
      },
    });
    game.onLevelSolved = () => {
      confetti.burst();
      solvedOverlay.show();
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
        } else {
          const [ndcX, ndcY] = clientToNdc(g.x, g.y);
          if (ndcY !== null) {
            // The waiting marble floats above the board, so its screen spot
            // lands off-board: route the tap by NDC for the raycast.
            game.tapWaitingMarble(ndcX, ndcY);
          }
        }
      } else if (g.type === "drag-end" && draggingFrom) {
        game.hideHighlight();
        const cell = clientToCell(g.x, g.y);
        const sameCell = cell?.x === draggingFrom.x && cell?.y === draggingFrom.y;
        if (cell && !sameCell) {
          if (!game.move(draggingFrom.x, draggingFrom.y, cell.x, cell.y)) {
            // Occupied/off-limits target: the piece wiggles + answers low.
            game.rejectPiece(draggingFrom);
          }
        } else if (!cell) {
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
