import * as THREE from "three";

export interface ScreenPoint {
  x: number;
  y: number;
}

/**
 * Projects a world-space point onto CSS-pixel screen coordinates for DOM
 * overlays (first-run cues). Pure geometry: the caller owns the viewport
 * size; the render camera supplies the fixed-diorama projection.
 */
export function worldToScreen(
  point: { x: number; y: number; z: number },
  camera: THREE.Camera,
  width: number,
  height: number,
  target = new THREE.Vector3(),
): ScreenPoint {
  target.set(point.x, point.y, point.z).project(camera);
  return { x: ((target.x + 1) / 2) * width, y: ((1 - target.y) / 2) * height };
}
