import type { PieceType } from "../domain/pieces";
import type { LayoutMode } from "./layout";

/** Kid-facing button labels, in canonical palette order (Ramp → Hole). */
export const LABELS: Record<PieceType, string> = {
  straight: "Ramp",
  curved: "Curve",
  funnel: "Funnel",
  goal: "Hole",
};

const CONTAINER_PORTRAIT = [
  "position:fixed;left:0;right:0;bottom:0",
  "display:flex;justify-content:center;align-items:center",
  "gap:10px;padding:10px",
  "padding-bottom:max(10px, env(safe-area-inset-bottom))",
  "flex-wrap:wrap",
].join(";");

const CONTAINER_LANDSCAPE = [
  "position:fixed;top:0;right:0;bottom:0",
  "display:flex;flex-direction:column;justify-content:center;align-items:center",
  "gap:10px;padding:10px",
  "padding-right:max(10px, env(safe-area-inset-right))",
].join(";");

const BUTTON_PORTRAIT = [
  "flex:1 1 72px;max-width:110px;min-height:72px",
  "font-size:19px;font-weight:700",
  "border-radius:14px;border:3px solid #2c3e50;background:#fff",
  "touch-action:none",
].join(";");

const BUTTON_LANDSCAPE = [
  "flex:0 0 72px;width:72px;min-height:72px",
  "font-size:19px;font-weight:700",
  "border-radius:14px;border:3px solid #2c3e50;background:#fff",
  "touch-action:none",
].join(";");

export interface PaletteLayout {
  containerCss: string;
  buttonCss: string;
}

/** Container/button styling for the palette in the given layout mode. */
export function paletteLayout(mode: LayoutMode): PaletteLayout {
  return mode === "landscape"
    ? { containerCss: CONTAINER_LANDSCAPE, buttonCss: BUTTON_LANDSCAPE }
    : { containerCss: CONTAINER_PORTRAIT, buttonCss: BUTTON_PORTRAIT };
}

/** One-shot shake applied to a tile whose drop the board rejected. */
export const PALETTE_REJECT_ANIMATION = "ms-palette-reject 0.32s ease-in-out";

/** Keyframes for the rejected-drop tile shake. */
export function paletteRejectKeyframes(): string {
  return [
    "@keyframes ms-palette-reject{",
    "0%,100%{transform:translateX(0)}",
    "20%{transform:translateX(-6px)}",
    "40%{transform:translateX(6px)}",
    "60%{transform:translateX(-4px)}",
    "80%{transform:translateX(4px)}",
    "}",
  ].join("");
}

/** Plays the reject shake on a tile, restarting it on rapid rejected drops. */
export function pulseReject(tile: HTMLElement): void {
  tile.style.animation = "none";
  void tile.offsetWidth; // reflow so the same animation can restart
  tile.style.animation = PALETTE_REJECT_ANIMATION;
}

/** Tile transition for the pickup lift and its release. */
export const PALETTE_PICKUP_TRANSITION = "transform 120ms ease-out";

/** Tile transform while a drag is in progress (lifted) or released (rest). */
export function palettePickupTransform(dragging: boolean): string {
  return dragging ? "translateY(-4px)" : "";
}

/**
 * Bottom palette: one big (64px+) button per piece type. Dragging from a
 * button streams NDC coordinates into the given callbacks until release.
 */
export function createPalette(
  root: HTMLElement,
  types: readonly PieceType[],
  onDrag: (type: PieceType, ndcX: number, ndcY: number | null) => void,
  onDrop: (type: PieceType, ndcX: number, ndcY: number | null, button: HTMLButtonElement) => void,
  mode: LayoutMode,
): HTMLElement {
  const bar = document.createElement("div");
  bar.style.cssText = paletteLayout(mode).containerCss;

  const style = document.createElement("style");
  style.textContent = paletteRejectKeyframes();
  bar.appendChild(style);

  for (const type of types) {
    const btn = document.createElement("button");
    btn.textContent = LABELS[type];
    btn.dataset.pieceType = type;
    btn.style.cssText = paletteLayout(mode).buttonCss;

    const ndcFromEvent = (e: PointerEvent): [number, number | null] => {
      const canvas = root.querySelector("canvas");
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
      const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ndcY = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      return [ndcX, ndcY];
    };

    btn.addEventListener("pointerdown", (e) => {
      btn.setPointerCapture(e.pointerId);
      // Pickup feedback: the tile lifts while the child drags its piece out.
      btn.style.transition = PALETTE_PICKUP_TRANSITION;
      btn.style.transform = palettePickupTransform(true);
    });
    btn.addEventListener("pointermove", (e) => {
      if (!btn.hasPointerCapture(e.pointerId)) {
        return;
      }
      const [ndcX, ndcY] = ndcFromEvent(e);
      onDrag(type, ndcX, ndcY);
    });
    btn.addEventListener("pointerup", (e) => {
      if (!btn.hasPointerCapture(e.pointerId)) {
        return;
      }
      btn.style.transform = palettePickupTransform(false);
      const [ndcX, ndcY] = ndcFromEvent(e);
      onDrop(type, ndcX, ndcY, btn);
    });
    bar.appendChild(btn);
  }
  return bar;
}
