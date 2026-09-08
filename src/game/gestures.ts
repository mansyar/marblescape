export type Gesture =
  | { type: "tap"; x: number; y: number }
  | { type: "drag-start"; x: number; y: number }
  | { type: "drag-move"; x: number; y: number }
  | { type: "drag-end"; x: number; y: number };

/** Movement (px) beyond which a press becomes a drag. Below it, release = tap. */
export const DRAG_THRESHOLD_PX = 12;

interface Press {
  x: number;
  y: number;
}

/**
 * Pointer gesture recognizer for the play surface: a press-release without
 * meaningful movement is a tap (rotate), moving past the threshold is a drag
 * (move a placed piece). Deliberately forgiving for small hands — time never
 * cancels a tap, only distance does.
 */
export function createGestureTracker() {
  let press: Press | null = null;
  let dragging = false;

  return {
    down(x: number, y: number, _t: number): Gesture | null {
      press = { x, y };
      dragging = false;
      return null;
    },
    move(x: number, y: number, _t: number): Gesture | null {
      if (!press) {
        return null;
      }
      const moved = Math.hypot(x - press.x, y - press.y);
      if (!dragging && moved > DRAG_THRESHOLD_PX) {
        dragging = true;
        return { type: "drag-start", x: press.x, y: press.y };
      }
      if (dragging) {
        return { type: "drag-move", x, y };
      }
      return null;
    },
    up(x: number, y: number, _t: number): Gesture | null {
      if (!press) {
        return null;
      }
      const wasDragging = dragging;
      const origin: Press = { ...press };
      press = null;
      dragging = false;
      return wasDragging ? { type: "drag-end", x, y } : { type: "tap", x: origin.x, y: origin.y };
    },
  };
}
