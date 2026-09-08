import { startRenderer } from "./render/scene";

const app = document.querySelector<HTMLDivElement>("#app");
if (app) {
  app.style.position = "fixed";
  app.style.inset = "0";
  startRenderer(app);
}
