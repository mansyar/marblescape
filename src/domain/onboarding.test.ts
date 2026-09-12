import { describe, expect, it } from "vitest";
import {
  isOnboarded,
  markOnboarded,
  nextOnboardingStep,
  ONBOARDED_KEY,
  ONBOARDED_VALUE,
} from "./onboarding";

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

describe("nextOnboardingStep", () => {
  it("advances from place to play on the first successful placement", () => {
    expect(nextOnboardingStep("place", "piece-placed")).toBe("play");
  });

  it("stays on play when the child places extra pieces", () => {
    expect(nextOnboardingStep("play", "piece-placed")).toBe("play");
  });

  it("completes on the first Play press from place (skip-ahead)", () => {
    expect(nextOnboardingStep("place", "play-pressed")).toBe("done");
  });

  it("completes on the first Play press from play", () => {
    expect(nextOnboardingStep("play", "play-pressed")).toBe("done");
  });

  it("keeps done terminal", () => {
    expect(nextOnboardingStep("done", "piece-placed")).toBe("done");
    expect(nextOnboardingStep("done", "play-pressed")).toBe("done");
  });
});

describe("onboarding flag", () => {
  it("uses a stable versioned storage key", () => {
    expect(ONBOARDED_KEY).toBe("marblescape.onboarded.v1");
  });

  it("is not onboarded when nothing is stored", () => {
    expect(isOnboarded(new MemoryStorage())).toBe(false);
  });

  it("forgives corrupt or foreign values as not onboarded", () => {
    const storage = new MemoryStorage();
    storage.setItem(ONBOARDED_KEY, "banana {");
    expect(isOnboarded(storage)).toBe(false);
  });

  it("is onboarded after marking and marking is idempotent", () => {
    const storage = new MemoryStorage();
    markOnboarded(storage);
    markOnboarded(storage);
    expect(isOnboarded(storage)).toBe(true);
    expect(storage.getItem(ONBOARDED_KEY)).toBe(ONBOARDED_VALUE);
  });
});
