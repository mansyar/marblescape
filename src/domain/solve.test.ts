import { describe, expect, it } from "vitest";
import { markSolved } from "./solve";
import { loadBadges } from "./badges";

class MemoryStorage {
  private data = new Map<string, string>();
  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
  removeItem(key: string): void {
    this.data.delete(key);
  }
  clear(): void {
    this.data.clear();
  }
}

describe("markSolved", () => {
  it("returns true and persists the badge on the first solve", () => {
    const storage = new MemoryStorage();
    expect(markSolved(storage, 1)).toBe(true);
    expect(loadBadges(storage).has(1)).toBe(true);
  });

  it("returns false on repeat solves without writing twice", () => {
    const storage = new MemoryStorage();
    expect(markSolved(storage, 2)).toBe(true);
    expect(markSolved(storage, 2)).toBe(false);
    expect(JSON.parse(storage.getItem("marblescape.badges.v1") ?? "[]")).toEqual([2]);
  });

  it("keeps other badges when solving a new level", () => {
    const storage = new MemoryStorage();
    markSolved(storage, 1);
    expect(markSolved(storage, 4)).toBe(true);
    expect(loadBadges(storage).has(1)).toBe(true);
    expect(loadBadges(storage).has(4)).toBe(true);
  });

  it("persists across reload (fresh storage reads the same badge)", () => {
    const first = new MemoryStorage();
    markSolved(first, 5);
    const reloaded = new MemoryStorage();
    // Simulate reload: same underlying map
    const raw = first.getItem("marblescape.badges.v1");
    if (raw) {
      reloaded.setItem("marblescape.badges.v1", raw);
    }
    expect(loadBadges(reloaded).has(5)).toBe(true);
    expect(markSolved(reloaded, 5)).toBe(false);
  });
});
