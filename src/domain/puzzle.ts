import type { BoardState, PlacedPiece } from "./board";
import { createBoard, placeTypedPiece, removeTypedPiece } from "./board";
import type { GapSlot, LevelDef, FixedPiece } from "./levels";
import { rotate as rotatePiece, type PieceType, type Rotation } from "./pieces";

/**
 * Puzzle mode state: a level's fixed furniture plus the pieces the child has
 * placed into its gaps. Pure and immutable — every operation returns a new
 * state (or the same instance when the operation is a no-op).
 */
export interface PuzzleState {
  level: LevelDef;
  /** Child-placed pieces keyed by `${x},${y}`. */
  placements: Map<string, PlacedPiece>;
}

const cellKey = (x: number, y: number) => `${x},${y}`;

export function createPuzzle(level: LevelDef): PuzzleState {
  return { level, placements: new Map() };
}

export function furnitureAt(state: PuzzleState, x: number, y: number): FixedPiece | null {
  return state.level.fixed.find((p) => p.x === x && p.y === y) ?? null;
}

export function placementAt(state: PuzzleState, x: number, y: number): PlacedPiece | null {
  return state.placements.get(cellKey(x, y)) ?? null;
}

export function gapAt(state: PuzzleState, x: number, y: number): GapSlot | null {
  return state.level.gaps.find((g) => g.x === x && g.y === y) ?? null;
}

/** True when `type` may be placed into the (empty) gap at (x, y). */
export function canPlace(state: PuzzleState, type: PieceType, x: number, y: number): boolean {
  if (placementAt(state, x, y)) {
    return false;
  }
  const gap = gapAt(state, x, y);
  return gap?.accepted.includes(type) ?? false;
}

/** Places a piece into a gap; returns the same state when invalid. */
export function place(state: PuzzleState, type: PieceType, x: number, y: number): PuzzleState {
  if (!canPlace(state, type, x, y)) {
    return state;
  }
  const piece: PlacedPiece = {
    id: `q${cellKey(x, y)}`,
    type,
    rotation: 0 as Rotation,
    x,
    y,
  };
  const placements = new Map(state.placements);
  placements.set(cellKey(x, y), piece);
  return { ...state, placements };
}

/** Removes a child-placed piece; furniture and empty cells are no-ops. */
export function remove(state: PuzzleState, x: number, y: number): PuzzleState {
  if (!placementAt(state, x, y)) {
    return state;
  }
  const placements = new Map(state.placements);
  placements.delete(cellKey(x, y));
  return { ...state, placements };
}

/** Cycles a placement's rotation 90° per call; furniture and empty no-op. */
export function rotate(state: PuzzleState, x: number, y: number): PuzzleState {
  const piece = placementAt(state, x, y);
  if (!piece) {
    return state;
  }
  const placements = new Map(state.placements);
  placements.set(cellKey(x, y), {
    ...piece,
    rotation: rotatePiece(piece.type, piece.rotation, 1),
  });
  return { ...state, placements };
}

/** Relocates a placement into another valid gap; invalid targets no-op. */
export function move(
  state: PuzzleState,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
): PuzzleState {
  const piece = placementAt(state, fromX, fromY);
  if (!piece || !canPlace(state, piece.type, toX, toY)) {
    return state;
  }
  const placements = new Map(state.placements);
  placements.delete(cellKey(fromX, fromY));
  placements.set(cellKey(toX, toY), { ...piece, x: toX, y: toY });
  return { ...state, placements };
}

/** Clears every placement; furniture is untouched. */
export function reset(state: PuzzleState): PuzzleState {
  return { ...state, placements: new Map() };
}

/**
 * Merges furniture and placements into a BoardState the physics/render layer
 * already understands. Furniture ids are stable per cell (`f3,1`), so
 * physics-body syncs across repeated calls stay consistent.
 */
export function boardFor(state: PuzzleState): BoardState {
  let board = createBoard(state.level.boardWidth, state.level.boardHeight);
  for (const piece of state.level.fixed) {
    board = placeTypedPiece(board, {
      id: `f${piece.x},${piece.y}`,
      type: piece.type,
      rotation: piece.rotation,
      x: piece.x,
      y: piece.y,
    });
  }
  for (const piece of state.placements.values()) {
    board = placeTypedPiece(board, piece);
  }
  return board;
}

/** Removes a piece from a merged board only when it is a child placement. */
export function removePlacementFromBoard(
  board: BoardState,
  state: PuzzleState,
  x: number,
  y: number,
): BoardState {
  const placement = placementAt(state, x, y);
  if (!placement) {
    return board;
  }
  return removeTypedPiece(board, x, y);
}
