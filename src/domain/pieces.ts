export type PieceType = "straight" | "curved" | "funnel" | "goal";

/** Quarter turns clockwise from the default orientation. */
export type Rotation = 0 | 1 | 2 | 3;

export type Side = "north" | "east" | "south" | "west";

const SIDE_ORDER: Side[] = ["north", "east", "south", "west"];

const BASE = "/models/pieces";

export interface PieceDef {
  /** Kenney Marble Kit glTF model served from /models/pieces. */
  model: string;
  /** Whether tap-to-rotate cycles this piece through 4 orientations. */
  rotatable: boolean;
  /** Open connection sides for a given rotation. */
  sides: (rotation: Rotation) => Side[];
}

function shiftSides(sides: Side[], rotation: Rotation): Side[] {
  return sides.map((side) => SIDE_ORDER[(SIDE_ORDER.indexOf(side) + rotation) % 4]);
}

export const CONNECTIONS: Record<PieceType, PieceDef> = {
  straight: {
    model: `${BASE}/straight.glb`,
    rotatable: true,
    // A straight channel: enters one side, exits the opposite.
    sides: (r) => shiftSides(["north", "south"], r),
  },
  curved: {
    model: `${BASE}/bend.glb`,
    rotatable: true,
    // A quarter bend: enters one side, exits the adjacent side.
    sides: (r) => shiftSides(["north", "east"], r),
  },
  funnel: {
    model: `${BASE}/funnel.glb`,
    rotatable: false,
    // Marble drops in from above; orientation-independent.
    sides: () => ["north"],
  },
  goal: {
    model: `${BASE}/end-hole-square.glb`,
    rotatable: false,
    // Marble falls through the hole; orientation-independent.
    sides: () => ["north"],
  },
};

export const PIECE_TYPES: PieceType[] = ["straight", "curved", "funnel", "goal"];

export function assertValidRotation(type: PieceType, rotation: Rotation): void {
  if (!Number.isInteger(rotation) || rotation < 0 || rotation > 3) {
    throw new Error(`Invalid rotation ${rotation} for piece type ${type}`);
  }
}

/** Next orientation when the player taps the piece (90° steps). */
export function nextRotation(type: PieceType, rotation: Rotation): Rotation {
  assertValidRotation(type, rotation);
  if (!CONNECTIONS[type].rotatable) {
    return 0;
  }
  return ((rotation + 1) % 4) as Rotation;
}

/** Apply n quarter turns (negative values rotate counter-clockwise). */
export function rotate(type: PieceType, rotation: Rotation, turns: number): Rotation {
  assertValidRotation(type, rotation);
  if (!CONNECTIONS[type].rotatable) {
    return 0;
  }
  return ((((rotation + turns) % 4) + 4) % 4) as Rotation;
}

/**
 * True when piece A has an open side facing `sideA` and piece B has an open
 * side facing `sideB` — i.e. a marble can pass between them.
 */
export function connectsWith(
  typeA: PieceType,
  rotationA: Rotation,
  sideA: Side,
  typeB: PieceType,
  rotationB: Rotation,
  sideB: Side,
): boolean {
  return (
    CONNECTIONS[typeA].sides(rotationA).includes(sideA) &&
    CONNECTIONS[typeB].sides(rotationB).includes(sideB)
  );
}
