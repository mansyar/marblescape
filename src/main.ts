import { Game } from "./game/game";
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
  });
}
