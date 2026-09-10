import { hasBadge, setBadge } from "./badges";
import type { MarbleColor } from "./colors";
import { isScriptComplete, type LevelDef } from "./levels";

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

/**
 * True when the level's script is fully collected. Classic levels (no
 * script) complete on any catch; sorting levels need every scripted color.
 */
export function isLevelComplete(
  level: Pick<LevelDef, "marbleColors">,
  collected: ReadonlyMap<MarbleColor, number>,
): boolean {
  const script = level.marbleColors;
  if (!script) {
    return true;
  }
  return isScriptComplete(script, collected);
}
