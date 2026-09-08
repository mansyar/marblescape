import { describe, expect, it } from "vitest";
import { MAX_FORCE, impactToPlayback, impactToVolume } from "./pitch";

describe("impactToPlayback", () => {
  it("returns the base rate for a soft touch", () => {
    expect(impactToPlayback(0)).toBe(0.85);
  });

  it("rises with impact force and stays within the musical band", () => {
    const soft = impactToPlayback(1);
    const hard = impactToPlayback(MAX_FORCE);
    expect(hard).toBeGreaterThan(soft);
    expect(hard).toBeLessThanOrEqual(1.6);
  });

  it("clamps absurd forces instead of screeching", () => {
    expect(impactToPlayback(MAX_FORCE * 100)).toBe(impactToPlayback(MAX_FORCE));
  });
});

describe("impactToVolume", () => {
  it("is silent at zero force and rises with it", () => {
    expect(impactToVolume(0)).toBeCloseTo(0.05);
    expect(impactToVolume(MAX_FORCE)).toBeGreaterThan(impactToVolume(1));
  });

  it("clamps at full volume", () => {
    expect(impactToVolume(MAX_FORCE * 100)).toBeLessThanOrEqual(1);
  });
});
