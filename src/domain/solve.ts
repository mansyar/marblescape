import { hasBadge, setBadge } from "./badges";

/**
 * Marks a level as solved. Returns true only when this was the FIRST solve
 * (badge not previously present); repeat solves return false without writing.
 */
export function markSolved(
  storage: Pick<Storage, "getItem" | "setItem">,
  levelId: number,
): boolean {
  if (hasBadge(storage, levelId)) {
    return false;
  }
  setBadge(storage, levelId);
  return true;
}
