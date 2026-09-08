import { BOARD_COLS, BOARD_ROWS, CAMERA_FOV_DEG, type CameraFraming } from "../render/framing";

export interface Cell {
  x: number;
  y: number;
}

type Vec3 = [number, number, number];

function sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function normalize(v: Vec3): Vec3 {
  const len = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / len, v[1] / len, v[2] / len];
}

/**
 * Maps a screen point (NDC, -1..1) onto a board cell via ray-plane
 * intersection with the y=0 board surface. Returns null when the ray lands
 * off the board.
 */
export function screenToCell(
  ndcX: number,
  ndcY: number,
  framing: CameraFraming,
  aspect: number,
): Cell | null {
  const pos = framing.position;
  const la = framing.lookAt;
  const tanHalf = Math.tan((CAMERA_FOV_DEG * Math.PI) / 360);

  // Camera basis: forward toward lookAt, right and up in world space.
  const f = normalize(sub(la, pos));
  const r = normalize(cross(f, [0, 1, 0]));
  const u = cross(r, f);

  // Ray direction through the NDC point on the near-plane.
  const dir = normalize([
    f[0] + r[0] * (ndcX * tanHalf * aspect) + u[0] * (ndcY * tanHalf),
    f[1] + r[1] * (ndcX * tanHalf * aspect) + u[1] * (ndcY * tanHalf),
    f[2] + r[2] * (ndcX * tanHalf * aspect) + u[2] * (ndcY * tanHalf),
  ]);

  if (dir[1] >= 0) {
    return null; // pointing up, never hits the board
  }
  const t = -pos[1] / dir[1];
  const px = pos[0] + t * dir[0];
  const pz = pos[2] + t * dir[2];

  const cellX = Math.floor(px);
  const cellY = Math.floor(pz);
  if (cellX < 0 || cellX >= BOARD_COLS || cellY < 0 || cellY >= BOARD_ROWS) {
    return null;
  }
  return { x: cellX, y: cellY };
}
