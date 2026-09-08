import type { PieceType, Rotation } from "../domain/pieces";

export interface ColliderDesc {
  /** Half-extents of the box collider in local piece space. */
  hx: number;
  hy: number;
  hz: number;
  /** Local offset from the piece origin (cell center, y=0 board surface). */
  offset: [number, number, number];
}

const RAIL = 0.06; // rail half-thickness
const RAIL_H = 0.18; // rail half-height
const RAIL_INSET = 0.42; // rail distance from piece center
const FLOOR_H = 0.08; // floor slab half-height
const FLOOR_Y = FLOOR_H; // top of floor sits at board surface

function straight(): ColliderDesc[] {
  // Channel runs north-south: floor + rails on either side along z.
  return [
    { hx: 0.48, hy: FLOOR_H, hz: 0.48, offset: [0, FLOOR_Y, 0] },
    { hx: RAIL, hy: RAIL_H, hz: 0.42, offset: [-RAIL_INSET, RAIL_H, 0] },
    { hx: RAIL, hy: RAIL_H, hz: 0.42, offset: [RAIL_INSET, RAIL_H, 0] },
  ];
}

function curved(): ColliderDesc[] {
  // Quarter bend connecting north (z-) to east (x+): floor + two rails that
  // approximate the arc with one L-shaped corner box each.
  return [
    { hx: 0.48, hy: FLOOR_H, hz: 0.48, offset: [0, FLOOR_Y, 0] },
    { hx: RAIL, hy: RAIL_H, hz: 0.48, offset: [RAIL_INSET, RAIL_H, 0] },
    { hx: 0.48, hy: RAIL_H, hz: RAIL, offset: [0, RAIL_H, -RAIL_INSET] },
  ];
}

function slab(): ColliderDesc[] {
  return [{ hx: 0.48, hy: FLOOR_H, hz: 0.48, offset: [0, FLOOR_Y, 0] }];
}

/**
 * Hand-authored collision shapes per piece type, expressed in local space.
 * Rotation is applied by swapping axis extents / offsets (90° steps).
 */
export function colliderDescriptors(type: PieceType, rotation: Rotation): ColliderDesc[] {
  const local = type === "straight" ? straight() : type === "curved" ? curved() : slab();
  if (rotation % 2 === 0) {
    return local;
  }
  // 90° turn: swap x and z extents and offsets (180° is symmetric enough).
  return local.map((d) => ({
    hx: d.hz,
    hy: d.hy,
    hz: d.hx,
    offset: [d.offset[2], d.offset[1], d.offset[0]] as [number, number, number],
  }));
}
