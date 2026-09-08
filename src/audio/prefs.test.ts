import { describe, expect, it } from "vitest";
import { SOUND_ON_KEY, isSoundOn, setSoundOn } from "./prefs";

function memoryStorage(initial: Record<string, string> = {}): Storage {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
  } as Storage;
}

describe("sound preference", () => {
  it("defaults to on", () => {
    expect(isSoundOn(memoryStorage())).toBe(true);
  });

  it("round-trips off and on through storage", () => {
    const s = memoryStorage();
    setSoundOn(false, s);
    expect(isSoundOn(s)).toBe(false);
    setSoundOn(true, s);
    expect(isSoundOn(s)).toBe(true);
  });

  it("treats corrupt values as on (forgiving default)", () => {
    expect(isSoundOn(memoryStorage({ [SOUND_ON_KEY]: "banana" }))).toBe(true);
  });

  it("uses the same key the HUD mute button writes", () => {
    expect(SOUND_ON_KEY).toBe("marblescape.sound");
  });
});
