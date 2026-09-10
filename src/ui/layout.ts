/**
 * Viewport layout classification for the dual-orientation UI.
 * Landscape shows the palette as a right-side rail; the rail reserves a
 * fraction of the viewport width so camera framing keeps the board visible.
 */

export type LayoutMode = "portrait" | "landscape";

/** Fraction of viewport width reserved by the landscape palette rail. */
export const LANDSCAPE_RAIL_FRACTION = 0.18;

export interface ViewportLayout {
  mode: LayoutMode;
  reservedWidth: number;
}

export function layoutMode(width: number, height: number): ViewportLayout {
  const mode: LayoutMode = width >= height ? "landscape" : "portrait";
  return {
    mode,
    reservedWidth: mode === "landscape" ? LANDSCAPE_RAIL_FRACTION : 0,
  };
}

/** Reserved viewport-width fraction the camera must avoid (rail in landscape). */
export function cameraReservation(width: number, height: number): number {
  return layoutMode(width, height).reservedWidth;
}
