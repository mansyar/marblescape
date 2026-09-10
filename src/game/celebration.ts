import type { BoardState } from "../domain/board";

/** Height above the board surface where collect sparkles appear (cup rim). */
export const CUP_BURST_HEIGHT = 0.2;

/**
 * World position of the goal cup's celebration anchor, or null when the
 * board has no goal piece (collection is impossible then, so no burst).
 */
export function cupBurstPosition(board: BoardState): { x: number; y: number; z: number } | null {
  const goal = board.pieces.find((p) => p.type === "goal");
  if (!goal) {
    return null;
  }
  return { x: goal.x + 0.5, y: CUP_BURST_HEIGHT, z: goal.y + 0.5 };
}
