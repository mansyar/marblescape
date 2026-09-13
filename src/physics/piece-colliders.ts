import type { PieceType, Rotation } from "../domain/pieces";

export interface ColliderDesc {
  /** Half-extents of the box collider in local piece space. */
  hx: number;
  hy: number;
  hz: number;
  /** Local offset from the piece origin (cell center, y=0 board surface). */
  offset: [number, number, number];
  /** Optional yaw (radians about Y) for diagonal deflectors. */
  yaw?: number;
  /** Optional pitch (radians about the piece-local X axis); unused today — every piece sits flush. */
  pitch?: number;
}

const RAIL = 0.06; // rail half-thickness
const RAIL_H = 0.18; // rail half-height
const RAIL_INSET = 0.42; // rail distance from piece center
const FLOOR_H = 0.08; // floor slab half-height
const FLOOR_Y = FLOOR_H; // top of floor sits at board surface

function straight(): ColliderDesc[] {
  // Channel runs north-south: FLAT floor + rails. The marble rolls on the
  // world's tilted gravity, not on piece pitch — a pitched floor creates a
  // step-up WALL at every joint (the next piece's north end sits higher
  // than this piece's south exit), which traps slow marbles: observed
  // ~25% jam rate at the chute joint on level runs (marble embeds in the
  // joint wall face and freezes). Flat floors are flush everywhere, so a
  // marble rolls continuously with no walls to climb.
  return [
    { hx: 0.48, hy: FLOOR_H, hz: 0.48, offset: [0, FLOOR_Y, 0] },
    { hx: RAIL, hy: RAIL_H, hz: 0.42, offset: [-RAIL_INSET, RAIL_H, 0] },
    { hx: RAIL, hy: RAIL_H, hz: 0.42, offset: [RAIL_INSET, RAIL_H, 0] },
  ];
}

function curved(): ColliderDesc[] {
  // Quarter bend with mouths north (z-) and east (x+): floor + rails that
  // block the closed sides (south z+, west x-), plus a 45° diagonal
  // deflector across the south-west quadrant that routes a marble moving
  // south into the east mouth (and one moving west into the north mouth).
  return [
    { hx: 0.48, hy: FLOOR_H, hz: 0.48, offset: [0, FLOOR_Y, 0] },
    { hx: RAIL, hy: RAIL_H, hz: 0.48, offset: [-RAIL_INSET, RAIL_H, 0] },
    { hx: 0.48, hy: RAIL_H, hz: RAIL, offset: [0, RAIL_H, RAIL_INSET] },
    { hx: 0.3, hy: RAIL_H, hz: RAIL, offset: [-0.08, RAIL_H, 0.28], yaw: -Math.PI / 4 },
  ];
}

function goalWithHole(): ColliderDesc[] {
  // End-hole piece: floor ring around a central hole. Hole half-size 0.43
  // gives a 0.3-radius marble 0.13 clearance on each axis — wider than the
  // ±0.1 spawn jitter so every dropped marble falls through, not on the rim.
  const ring = 0.035;
  const center = 0.465;
  return [
    { hx: ring, hy: FLOOR_H, hz: 0.48, offset: [-center, FLOOR_Y, 0] },
    { hx: ring, hy: FLOOR_H, hz: 0.48, offset: [center, FLOOR_Y, 0] },
    { hx: 0.48, hy: FLOOR_H, hz: ring, offset: [0, FLOOR_Y, -center] },
    { hx: 0.48, hy: FLOOR_H, hz: ring, offset: [0, FLOOR_Y, center] },
  ];
}

function funnel(): ColliderDesc[] {
  // Straight drop channel (north↔south): side rails keep the marble in,
  // and the floor is split around a center hole (z half-size 0.2) that a
  // rolling marble always falls through.
  const holeHalf = 0.2;
  const strip = 0.48 - holeHalf;
  const stripCenter = holeHalf + strip / 2;
  return [
    { hx: RAIL, hy: RAIL_H, hz: 0.42, offset: [-RAIL_INSET, RAIL_H, 0] },
    { hx: RAIL, hy: RAIL_H, hz: 0.42, offset: [RAIL_INSET, RAIL_H, 0] },
    { hx: RAIL_INSET, hy: FLOOR_H, hz: strip, offset: [0, FLOOR_Y, -stripCenter] },
    { hx: RAIL_INSET, hy: FLOOR_H, hz: strip, offset: [0, FLOOR_Y, stripCenter] },
  ];
}

function goalClosed(): ColliderDesc[] {
  // Closed lid: the open cup's border ring plus a center plug, all slabs at
  // the flush floor height so a marble rolls straight over with no step. The
  // plug overlaps the ring so no seam gap remains anywhere in the cell.
  const ring = 0.035;
  const center = 0.465;
  return [
    { hx: ring, hy: FLOOR_H, hz: 0.48, offset: [-center, FLOOR_Y, 0] },
    { hx: ring, hy: FLOOR_H, hz: 0.48, offset: [center, FLOOR_Y, 0] },
    { hx: 0.48, hy: FLOOR_H, hz: ring, offset: [0, FLOOR_Y, -center] },
    { hx: 0.48, hy: FLOOR_H, hz: ring, offset: [0, FLOOR_Y, center] },
    { hx: center, hy: FLOOR_H, hz: center, offset: [0, FLOOR_Y, 0] },
  ];
}

/**
 * Hand-authored collision shapes per piece type, expressed in local space.
 * Rotation is applied by swapping axis extents / offsets (90° steps).
 */
export type GoalLid = "open" | "closed";

export function colliderDescriptors(
  type: PieceType,
  rotation: Rotation,
  goalLid: GoalLid = "open",
): ColliderDesc[] {
  const local =
    type === "straight"
      ? straight()
      : type === "curved"
        ? curved()
        : type === "funnel"
          ? funnel()
          : goalLid === "closed"
            ? goalClosed()
            : goalWithHole();
  // Apply `rotation` clockwise quarter turns (matches the domain side
  // shift north→east): offsets rotate (x,z)→(−z,x) per turn; axis-aligned
  // boxes swap extents, yawed boxes keep local extents and add +90° yaw.
  const turns = rotation % 4;
  return local.map((d) => {
    let [x, y, z] = d.offset;
    let hx = d.hx;
    let hz = d.hz;
    let yaw = d.yaw ?? 0;
    for (let i = 0; i < turns; i++) {
      const nx = -z;
      z = x;
      x = nx;
      if (d.yaw === undefined) {
        const t = hx;
        hx = hz;
        hz = t;
      } else {
        yaw += Math.PI / 2;
      }
    }
    return d.yaw === undefined
      ? { hx, hy: d.hy, hz, offset: [x, y, z] as [number, number, number], pitch: d.pitch }
      : {
          hx: d.hx,
          hy: d.hy,
          hz: d.hz,
          offset: [x, y, z] as [number, number, number],
          yaw,
          pitch: d.pitch,
        };
  });
}
