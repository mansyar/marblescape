export const BADGES_KEY = "marblescape.badges.v1";

/** Solved puzzle levels are stored as a JSON array of level ids. */
export function loadBadges(storage: Pick<Storage, "getItem">): Set<number> {
  const raw = storage.getItem(BADGES_KEY);
  if (!raw) {
    return new Set();
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return new Set();
    }
    const ids = new Set<number>();
    for (const id of parsed) {
      if (Number.isInteger(id) && id >= 1 && id <= 6) {
        ids.add(id as number);
      }
    }
    return ids;
  } catch {
    return new Set();
  }
}

export function hasBadge(storage: Pick<Storage, "getItem">, levelId: number): boolean {
  return loadBadges(storage).has(levelId);
}

export function setBadge(storage: Pick<Storage, "getItem" | "setItem">, levelId: number): void {
  const badges = loadBadges(storage);
  badges.add(levelId);
  storage.setItem(BADGES_KEY, JSON.stringify([...badges].sort((a, b) => a - b)));
}
