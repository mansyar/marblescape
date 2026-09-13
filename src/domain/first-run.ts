import { loadBoard } from "./board";
import type { MarbleColor } from "./colors";
import { isOnboarded } from "./onboarding";
import type { PieceType, Rotation } from "./pieces";
import type { Storage } from "./storage";

/** Sandbox starter-board size (cross-checked against BOARD_COLS/ROWS by tests). */
export const FIRST_RUN_WIDTH = 8;
export const FIRST_RUN_HEIGHT = 6;

/** The starter run's single empty cell — where the demo hand invites the straight tile. */
export const FIRST_RUN_GAP = { x: 4, y: 2 } as const;

/** A piece of the starter seed; the game assigns normal ids when seeding. */
export interface FirstRunPiece {
  type: PieceType;
  rotation: Rotation;
  x: number;
  y: number;
  color?: MarbleColor;
}

/**
 * One-gap starter run placed once on a brand-new sandbox:
 * chute (4,0) → straights → [gap (4,2)] → straights → classic goal cup (4,5).
 * Filling the gap with a straight completes a working run; every seeded piece
 * stays editable and removable like any child-placed piece.
 */
export const FIRST_RUN_LAYOUT: readonly FirstRunPiece[] = [
  { type: "straight", rotation: 0, x: 4, y: 0 },
  { type: "straight", rotation: 0, x: 4, y: 1 },
  { type: "straight", rotation: 0, x: 4, y: 3 },
  { type: "straight", rotation: 0, x: 4, y: 4 },
  { type: "goal", rotation: 0, x: 4, y: 5 },
];

/**
 * A brand-new child: no saved sandbox board and no completion flag yet.
 * Any save (even the seed itself) ends first-run for good — existing
 * players are never interrupted.
 */
export function isFirstRun(storage: Storage): boolean {
  return loadBoard(storage) === null && !isOnboarded(storage);
}
