import type { PlacedPiece } from "./board";
import type { MarbleColor } from "./colors";

/**
 * Cups compatible with the collectible marble: classic cups (no color) are
 * always open; a colored cup opens only while it matches. Closed cups keep
 * their floor and closed lid, so a mismatched marble rolls straight over.
 */
export function openCupKeys(
  pieces: ReadonlyArray<PlacedPiece>,
  collectible: MarbleColor,
): Set<string> {
  const open = new Set<string>();
  for (const piece of pieces) {
    if (piece.type !== "goal") {
      continue;
    }
    if (piece.color === undefined || piece.color === collectible) {
      open.add(`${piece.x},${piece.y}`);
    }
  }
  return open;
}
