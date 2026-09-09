import { CONNECTIONS, PIECE_TYPES, type PieceType, type Rotation, type Side } from "./pieces";

/** A piece pre-placed on a level board (furniture: immovable, unrotatable). */
export interface FixedPiece {
  type: PieceType;
  rotation: Rotation;
  x: number;
  y: number;
}

/** An empty slot the child must bridge with a piece from the palette. */
export interface GapSlot {
  x: number;
  y: number;
  /** Piece types that can bridge this gap (subset of the level's palette). */
  accepted: PieceType[];
}

export interface LevelDef {
  id: number;
  name: string;
  boardWidth: number;
  boardHeight: number;
  /** Furniture pieces; never movable, rotatable, or removable. */
  fixed: FixedPiece[];
  /** The only cells that accept new placements. */
  gaps: GapSlot[];
  /** Pieces available in the tray for this level. */
  palette: PieceType[];
  /** Drop cell (start chute). */
  spawn: { x: number; y: number };
  /** Goal cell — the cup that collects marbles. */
  goal: { x: number; y: number };
}

const SIDE_ORDER: Side[] = ["north", "east", "south", "west"];

const ROTATIONS: Rotation[] = [0, 1, 2, 3];

const OPPOSITE: Record<Side, Side> = {
  north: "south",
  east: "west",
  south: "north",
  west: "east",
};

function sideBetween(from: [number, number], to: [number, number]): Side | null {
  if (to[0] === from[0] && to[1] === from[1] - 1) return "north";
  if (to[0] === from[0] + 1 && to[1] === from[1]) return "east";
  if (to[0] === from[0] && to[1] === from[1] + 1) return "south";
  if (to[0] === from[0] - 1 && to[1] === from[1]) return "west";
  return null;
}

function openSides(type: PieceType, rotation: Rotation): Side[] {
  return CONNECTIONS[type].sides(rotation);
}

/** True when some rotation of some accepted type opens toward `side`. */
function gapAccepts(gap: GapSlot, side: Side): boolean {
  return gap.accepted.some((type) =>
    ROTATIONS.some((rotation) => openSides(type, rotation).includes(side)),
  );
}

// --- Validation ---

export function validateLevel(level: LevelDef): void {
  if (!Number.isInteger(level.id) || level.id < 1 || level.id > 6) {
    throw new Error(`Level id must be an integer in 1..6, got ${level.id}`);
  }
  if (typeof level.name !== "string" || level.name.length === 0) {
    throw new Error(`Level name must be a non-empty string`);
  }
  if (
    !Number.isInteger(level.boardWidth) ||
    !Number.isInteger(level.boardHeight) ||
    level.boardWidth < 1 ||
    level.boardHeight < 1
  ) {
    throw new Error(`Invalid board dimensions ${level.boardWidth}x${level.boardHeight}`);
  }
  if (level.palette.length === 0) {
    throw new Error(`Palette must not be empty`);
  }
  const seen = new Set<PieceType>();
  for (const type of level.palette) {
    if (!PIECE_TYPES.includes(type)) {
      throw new Error(`Unknown palette piece type '${type}'`);
    }
    if (seen.has(type)) {
      throw new Error(`Palette contains duplicate piece type '${type}'`);
    }
    seen.add(type);
  }
  if (level.gaps.length === 0) {
    throw new Error(`Level must have at least one gap`);
  }

  const occupied = new Set<string>();
  const key = (x: number, y: number) => `${x},${y}`;

  const inside = (x: number, y: number) =>
    x >= 0 && x < level.boardWidth && y >= 0 && y < level.boardHeight;

  // Fixed pieces: bounds, valid type/rotation, no overlaps, at most one goal.
  let goalPieces = 0;
  for (const piece of level.fixed) {
    if (!inside(piece.x, piece.y)) {
      throw new Error(`Fixed piece outside board at (${piece.x}, ${piece.y})`);
    }
    if (!PIECE_TYPES.includes(piece.type)) {
      throw new Error(`Unknown fixed piece type '${piece.type}'`);
    }
    if (
      !Number.isInteger(piece.rotation) ||
      piece.rotation < 0 ||
      piece.rotation > 3 ||
      (!CONNECTIONS[piece.type].rotatable && piece.rotation !== 0)
    ) {
      throw new Error(`Invalid rotation ${piece.rotation} for ${piece.type} piece`);
    }
    const k = key(piece.x, piece.y);
    if (occupied.has(k)) {
      throw new Error(`Fixed pieces overlap at (${piece.x}, ${piece.y})`);
    }
    occupied.add(k);
    if (piece.type === "goal") {
      goalPieces += 1;
    }
  }
  if (goalPieces > 1) {
    throw new Error(`Level must contain at most one goal piece, found ${goalPieces}`);
  }

  // Start chute: exactly one fixed straight (rotation 0) at the spawn cell.
  const chute = level.fixed.filter((p) => p.x === level.spawn.x && p.y === level.spawn.y);
  if (chute.length !== 1) {
    throw new Error(
      `Spawn cell (${level.spawn.x}, ${level.spawn.y}) must hold exactly one start chute piece`,
    );
  }
  if (chute[0].type !== "straight" || chute[0].rotation !== 0) {
    throw new Error(
      `Start chute at (${level.spawn.x}, ${level.spawn.y}) must be a straight with rotation 0`,
    );
  }

  // Goal cell must be inside and hold exactly one goal piece (fixed or gap).
  if (!inside(level.goal.x, level.goal.y)) {
    throw new Error(`Goal cell outside board at (${level.goal.x}, ${level.goal.y})`);
  }
  const fixedGoalAtGoal = level.fixed.some(
    (p) => p.type === "goal" && p.x === level.goal.x && p.y === level.goal.y,
  );

  // Gaps: bounds, no overlap with furniture/spawn, valid accepted types.
  const gapCells = new Set<string>();
  let goalGap = 0;
  for (const gap of level.gaps) {
    if (!inside(gap.x, gap.y)) {
      throw new Error(`Gap outside board at (${gap.x}, ${gap.y})`);
    }
    const k = key(gap.x, gap.y);
    if (occupied.has(k)) {
      throw new Error(`Gap overlaps fixed piece at (${gap.x}, ${gap.y})`);
    }
    if (gapCells.has(k)) {
      throw new Error(`Gaps overlap at (${gap.x}, ${gap.y})`);
    }
    gapCells.add(k);
    if (gap.x === level.spawn.x && gap.y === level.spawn.y) {
      throw new Error(`Gap overlaps spawn cell at (${gap.x}, ${gap.y})`);
    }
    if (gap.accepted.length === 0) {
      throw new Error(`Gap at (${gap.x}, ${gap.y}) must have a non-empty accepted piece list`);
    }
    for (const type of gap.accepted) {
      if (!PIECE_TYPES.includes(type)) {
        throw new Error(`Gap at (${gap.x}, ${gap.y}) accepts unknown piece type '${type}'`);
      }
      if (!seen.has(type)) {
        throw new Error(
          `Gap at (${gap.x}, ${gap.y}) accepts '${type}' which is not in the palette`,
        );
      }
    }
    if (gap.accepted.includes("goal")) {
      goalGap += 1;
    }
  }

  if (goalPieces + goalGap !== 1) {
    throw new Error(
      `Level goal must be exactly one goal piece (fixed or gap), found ${goalPieces + goalGap}`,
    );
  }
  if (goalPieces === 1 && !fixedGoalAtGoal) {
    throw new Error(
      `Fixed goal piece must sit on the goal cell (${level.goal.x}, ${level.goal.y})`,
    );
  }
  if (goalGap === 1 && !level.gaps.some((g) => g.x === level.goal.x && g.y === level.goal.y)) {
    throw new Error(`Goal gap must sit on the goal cell (${level.goal.x}, ${level.goal.y})`);
  }
}

// --- Solvability ---

/**
 * Static connectivity check: does a route exist from the spawn chute to the
 * goal cup, given the fixed pieces and the pieces the restricted palette can
 * bridge? Physics fidelity (tilt, ramps, bounces) is not simulated — this is
 * the mouth-graph guarantee required by the spec.
 */
export function isLevelSolvable(level: LevelDef): boolean {
  const key = (x: number, y: number) => `${x},${y}`;
  const inside = (x: number, y: number) =>
    x >= 0 && x < level.boardWidth && y >= 0 && y < level.boardHeight;

  const fixedAt = new Map<string, FixedPiece>();
  for (const piece of level.fixed) {
    fixedAt.set(key(piece.x, piece.y), piece);
  }
  const gapAt = new Map<string, GapSlot>();
  for (const gap of level.gaps) {
    gapAt.set(key(gap.x, gap.y), gap);
  }

  const isGoal = (x: number, y: number) => x === level.goal.x && y === level.goal.y;
  const isNode = (x: number, y: number) =>
    isGoal(x, y) || fixedAt.has(key(x, y)) || gapAt.has(key(x, y));

  /** Can a marble exit cell (x,y) toward `side`, or enter it from `side`? */
  const acceptsFrom = (x: number, y: number, side: Side): boolean => {
    if (isGoal(x, y)) {
      return true; // the cup catches marbles from any side
    }
    const fixed = fixedAt.get(key(x, y));
    if (fixed) {
      return openSides(fixed.type, fixed.rotation).includes(side);
    }
    const gap = gapAt.get(key(x, y));
    if (gap) {
      return gapAccepts(gap, side);
    }
    return false;
  };

  // BFS from spawn to goal.
  const start = `${level.spawn.x},${level.spawn.y}`;
  const queue: Array<[number, number]> = [[level.spawn.x, level.spawn.y]];
  const visited = new Set<string>([start]);
  const parent = new Map<string, [number, number] | null>([[start, null]]);

  let found = false;
  while (queue.length > 0) {
    const [x, y] = queue[0];
    queue.shift();
    if (isGoal(x, y)) {
      found = true;
      break;
    }
    for (const side of SIDE_ORDER) {
      const nx = side === "east" ? x + 1 : side === "west" ? x - 1 : x;
      const ny = side === "south" ? y + 1 : side === "north" ? y - 1 : y;
      if (!inside(nx, ny) || !isNode(nx, ny)) {
        continue;
      }
      const nk = key(nx, ny);
      if (visited.has(nk)) {
        continue;
      }
      // A must open toward `side`; B must open toward the opposite side.
      if (!acceptsFrom(x, y, side) || !acceptsFrom(nx, ny, OPPOSITE[side])) {
        continue;
      }
      visited.add(nk);
      parent.set(nk, [x, y]);
      queue.push([nx, ny]);
    }
  }
  if (!found) {
    return false;
  }

  // Verify each gap on the found path is bridgeable by ONE piece/rotation
  // that covers every side the path uses (e.g. a curved gap needing north
  // + west must be the single curved rotation that opens both).
  const used = new Map<string, Side[]>();
  let current: [number, number] | null = [level.goal.x, level.goal.y];
  let prev = parent.get(key(current[0], current[1])) ?? null;
  while (current && prev) {
    const side = sideBetween(prev, current);
    if (side) {
      // `side` is the side of `prev` facing `current`, so `current` opens
      // toward prev on the opposite side and `prev` opens toward current
      // on `side`.
      const entry = used.get(key(current[0], current[1])) ?? [];
      if (!entry.includes(OPPOSITE[side])) entry.push(OPPOSITE[side]);
      used.set(key(current[0], current[1]), entry);
      const back = used.get(key(prev[0], prev[1])) ?? [];
      if (!back.includes(side)) back.push(side);
      used.set(key(prev[0], prev[1]), back);
    }
    current = prev;
    prev = parent.get(key(current[0], current[1])) ?? null;
  }

  for (const [cellKey, sides] of used) {
    const gap = gapAt.get(cellKey);
    if (!gap) {
      continue; // fixed pieces and endpoints need no bridge check
    }
    const coverable = gap.accepted.some((type) =>
      ROTATIONS.some((rotation) => {
        const open = openSides(type, rotation);
        return sides.every((s) => open.includes(s));
      }),
    );
    if (!coverable) {
      return false;
    }
  }
  return true;
}

// --- The six shipped levels ---
// Board is 8 cols x 6 rows; rows run north (0) to south (5); the tilted table
// drains south, so routes always flow north → south toward the cup.

export const LEVELS: LevelDef[] = [
  {
    id: 1,
    name: "Straight",
    boardWidth: 8,
    boardHeight: 6,
    fixed: [
      { type: "straight", rotation: 0, x: 3, y: 0 },
      { type: "straight", rotation: 0, x: 3, y: 1 },
      { type: "straight", rotation: 0, x: 3, y: 3 },
      { type: "straight", rotation: 0, x: 3, y: 4 },
      { type: "goal", rotation: 0, x: 3, y: 5 },
    ],
    gaps: [{ x: 3, y: 2, accepted: ["straight"] }],
    palette: ["straight"],
    spawn: { x: 3, y: 0 },
    goal: { x: 3, y: 5 },
  },
  {
    id: 2,
    name: "Curved",
    boardWidth: 8,
    boardHeight: 6,
    fixed: [
      { type: "straight", rotation: 0, x: 3, y: 0 },
      { type: "straight", rotation: 0, x: 3, y: 1 },
      { type: "straight", rotation: 0, x: 3, y: 3 },
      { type: "curved", rotation: 2, x: 4, y: 4 },
      { type: "goal", rotation: 0, x: 4, y: 5 },
    ],
    gaps: [
      { x: 3, y: 2, accepted: ["straight"] },
      { x: 3, y: 4, accepted: ["curved"] },
    ],
    palette: ["straight", "curved"],
    spawn: { x: 3, y: 0 },
    goal: { x: 4, y: 5 },
  },
  {
    id: 3,
    name: "Mix",
    boardWidth: 8,
    boardHeight: 6,
    fixed: [
      { type: "straight", rotation: 0, x: 3, y: 0 },
      { type: "straight", rotation: 0, x: 3, y: 1 },
      { type: "straight", rotation: 0, x: 3, y: 2 },
      { type: "curved", rotation: 2, x: 4, y: 4 },
      { type: "goal", rotation: 0, x: 4, y: 5 },
    ],
    gaps: [
      { x: 3, y: 3, accepted: ["straight"] },
      { x: 3, y: 4, accepted: ["curved"] },
    ],
    palette: ["straight", "curved"],
    spawn: { x: 3, y: 0 },
    goal: { x: 4, y: 5 },
  },
  {
    id: 4,
    name: "Goal",
    boardWidth: 8,
    boardHeight: 6,
    fixed: [
      { type: "straight", rotation: 0, x: 3, y: 0 },
      { type: "straight", rotation: 0, x: 3, y: 1 },
      { type: "straight", rotation: 0, x: 3, y: 3 },
      { type: "straight", rotation: 0, x: 3, y: 4 },
    ],
    gaps: [
      { x: 3, y: 2, accepted: ["straight"] },
      { x: 3, y: 5, accepted: ["goal"] },
    ],
    palette: ["straight", "goal"],
    spawn: { x: 3, y: 0 },
    goal: { x: 3, y: 5 },
  },
  {
    id: 5,
    name: "Funnel",
    boardWidth: 8,
    boardHeight: 6,
    fixed: [
      { type: "straight", rotation: 0, x: 3, y: 0 },
      { type: "straight", rotation: 0, x: 3, y: 1 },
      { type: "straight", rotation: 0, x: 3, y: 3 },
      { type: "goal", rotation: 0, x: 3, y: 5 },
    ],
    gaps: [
      { x: 3, y: 2, accepted: ["straight"] },
      { x: 3, y: 4, accepted: ["funnel"] },
    ],
    palette: ["straight", "funnel"],
    spawn: { x: 3, y: 0 },
    goal: { x: 3, y: 5 },
  },
  {
    id: 6,
    name: "Finale",
    boardWidth: 8,
    boardHeight: 6,
    fixed: [
      { type: "straight", rotation: 0, x: 3, y: 0 },
      { type: "straight", rotation: 0, x: 3, y: 2 },
      { type: "curved", rotation: 2, x: 4, y: 4 },
      { type: "goal", rotation: 0, x: 4, y: 5 },
    ],
    gaps: [
      { x: 3, y: 1, accepted: ["straight"] },
      { x: 3, y: 3, accepted: ["funnel"] },
      { x: 3, y: 4, accepted: ["curved"] },
    ],
    palette: ["straight", "curved", "funnel", "goal"],
    spawn: { x: 3, y: 0 },
    goal: { x: 4, y: 5 },
  },
];

/** Returns the level with the given id, or undefined when out of range. */
export function getLevel(id: number): LevelDef | undefined {
  return LEVELS.find((lvl) => lvl.id === id);
}
