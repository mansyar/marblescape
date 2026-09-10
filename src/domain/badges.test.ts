import { describe, expect, it } from "vitest";
import { BADGES_KEY, hasBadge, loadBadges, setBadge } from "./badges";

interface MemoryStorage {
  data: Map<string, string>;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function memoryStorage(): MemoryStorage {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
  };
}

describe("loadBadges", () => {
  it("returns an empty set when nothing is stored", () => {
    expect(loadBadges(memoryStorage()).size).toBe(0);
  });

  it("loads stored level ids", () => {
    const storage = memoryStorage();
    storage.setItem(BADGES_KEY, JSON.stringify([1, 3]));
    const badges = loadBadges(storage);
    expect(badges.has(1)).toBe(true);
    expect(badges.has(3)).toBe(true);
    expect(badges.has(2)).toBe(false);
  });

  it("forgives corrupt JSON as an empty set", () => {
    const storage = memoryStorage();
    storage.setItem(BADGES_KEY, "not json {");
    expect(loadBadges(storage).size).toBe(0);
  });

  it("ignores non-array payloads", () => {
    const storage = memoryStorage();
    storage.setItem(BADGES_KEY, JSON.stringify({ 1: true }));
    expect(loadBadges(storage).size).toBe(0);
  });

  it("filters out ids outside the level range while keeping 7-9", () => {
    const storage = memoryStorage();
    storage.setItem(BADGES_KEY, JSON.stringify([0, 7, "x", 2.5, 12, 4]));
    const badges = loadBadges(storage);
    expect([...badges].sort((a, b) => a - b)).toEqual([4, 7]);
  });
});

describe("hasBadge", () => {
  it("is true only for solved levels", () => {
    const storage = memoryStorage();
    storage.setItem(BADGES_KEY, JSON.stringify([2]));
    expect(hasBadge(storage, 2)).toBe(true);
    expect(hasBadge(storage, 1)).toBe(false);
  });
});

describe("setBadge", () => {
  it("persists the badge and is idempotent", () => {
    const storage = memoryStorage();
    setBadge(storage, 2);
    setBadge(storage, 2);
    setBadge(storage, 2);
    expect(hasBadge(storage, 2)).toBe(true);
    expect(JSON.parse(storage.getItem(BADGES_KEY) ?? "[]")).toEqual([2]);
  });

  it("round-trips through loadBadges", () => {
    const storage = memoryStorage();
    setBadge(storage, 1);
    setBadge(storage, 6);
    setBadge(storage, 9);
    const badges = loadBadges(storage);
    expect(badges.has(1)).toBe(true);
    expect(badges.has(6)).toBe(true);
    expect(badges.has(9)).toBe(true);
  });

  it("merges with previously stored badges", () => {
    const storage = memoryStorage();
    storage.setItem(BADGES_KEY, JSON.stringify([1]));
    setBadge(storage, 3);
    expect(loadBadges(storage).has(3)).toBe(true);
    expect(loadBadges(storage).has(1)).toBe(true);
  });
});
