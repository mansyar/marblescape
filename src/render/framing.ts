/**
 * Fixed-camera diorama framing (spec: camera never moves; placement stays 2D).
 * The camera looks down the board's center axis at a fixed elevation angle,
 * and its distance is solved so the whole board fits the viewport with margin.
 */

/** Board size in cells (1 world unit per cell). */
export const BOARD_COLS = 8;
export const BOARD_ROWS = 6;

/** Fixed diorama tilt from the board plane, degrees. */
export const CAMERA_ELEVATION_DEG = 50;

/** Default vertical field of view, degrees. */
export const CAMERA_FOV_DEG = 45;

/** Fraction of the viewport edge kept empty around the board. */
export const FRAMING_MARGIN = 1.12;

export interface CameraFraming {
  distance: number;
  position: [number, number, number];
  lookAt: [number, number, number];
}

export function computeCameraFraming(
  aspect: number,
  cols: number = BOARD_COLS,
  rows: number = BOARD_ROWS,
  fovDeg: number = CAMERA_FOV_DEG,
): CameraFraming {
  const fovRad = (fovDeg * Math.PI) / 180;

  // Distance needed to fit each axis, then take the tighter constraint.
  const fitHeight = rows / 2 / Math.tan(fovRad / 2);
  const fitWidth = cols / 2 / (Math.tan(fovRad / 2) * aspect);
  const distance = Math.max(fitHeight, fitWidth) * FRAMING_MARGIN;

  const lookAt: [number, number, number] = [cols / 2, 0, rows / 2];

  const elevationRad = (CAMERA_ELEVATION_DEG * Math.PI) / 180;
  const horizontal = distance * Math.cos(elevationRad);
  const position: [number, number, number] = [
    lookAt[0],
    distance * Math.sin(elevationRad),
    lookAt[2] + horizontal,
  ];

  return { distance, position, lookAt };
}
