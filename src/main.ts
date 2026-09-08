import { Game } from "./game/game";
import { createGestureTracker } from "./game/gestures";
import { screenToCell } from "./game/picking";
import { computeCameraFraming } from "./render/framing";
import { createPalette } from "./ui/palette";

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
      return screenToCell(ndcX, ndcY, computeCameraFraming(aspect()), aspect());
    };

    // Palette: drag new pieces onto the board.
    const palette = createPalette(
      app,
      ["straight", "curved", "funnel", "goal"],
      (_type, ndcX, ndcY) => {
        const cell = cellFromNdc(ndcX, ndcY);
        game.showHighlight(cell, cell ? game.isPlaceable(cell.x, cell.y) : false);
      },
      (type, ndcX, ndcY) => {
        game.hideHighlight();
        const cell = cellFromNdc(ndcX, ndcY);
        if (cell) {
          game.place(type, cell.x, cell.y);
        }
      },
    );
    document.body.appendChild(palette);

    // Play surface: tap rotates, hold-drag moves a placed piece.
    const gestures = createGestureTracker();
    let draggingFrom: { x: number; y: number } | null = null;
    const ndcFromPointer = (e: PointerEvent): [number, number | null] => {
      const canvas = app.querySelector("canvas");
      if (!canvas) {
        return [0, null];
      }
      const rect = canvas.getBoundingClientRect();
      const inside =
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom;
      if (!inside) {
        return [0, null];
      }
      return [
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -(((e.clientY - rect.top) / rect.height) * 2 - 1),
      ];
    };

    app.addEventListener("pointerdown", (e) => {
      gestures.down(e.clientX, e.clientY, e.timeStamp);
    });
    app.addEventListener("pointermove", (e) => {
      const g = gestures.move(e.clientX, e.clientY, e.timeStamp);
      if (!g) {
        return;
      }
      const [ndcX, ndcY] = ndcFromPointer(e);
      const cell = cellFromNdc(ndcX, ndcY);
      if (g.type === "drag-start") {
        const origin = cellFromNdc(ndcX, ndcY) ?? null;
        draggingFrom = origin && game.pieceAt(origin.x, origin.y) ? origin : null;
      } else if (g.type === "drag-move" && draggingFrom) {
        game.showHighlight(cell, cell ? game.isPlaceable(cell.x, cell.y) : false);
      }
    });
    app.addEventListener("pointerup", (e) => {
      const g = gestures.up(e.clientX, e.clientY, e.timeStamp);
      if (!g) {
        return;
      }
      const [ndcX, ndcY] = ndcFromPointer(e);
      const cell = cellFromNdc(ndcX, ndcY);
      if (g.type === "tap" && cell) {
        game.rotate(cell.x, cell.y);
      } else if (g.type === "drag-end" && draggingFrom) {
        game.hideHighlight();
        if (cell) {
          game.move(draggingFrom.x, draggingFrom.y, cell.x, cell.y);
        } else {
          // Released off the board: the piece pops back to the palette.
          game.popOut(draggingFrom.x, draggingFrom.y);
        }
        draggingFrom = null;
      }
    });
  });
}
