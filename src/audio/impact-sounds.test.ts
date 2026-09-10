import { describe, expect, it } from "vitest";
import { impactParams, MIN_IMPACT_FORCE, selectImpactSound } from "./impact-sounds";
import { impactToPlayback, impactToVolume, MAX_FORCE } from "./pitch";

describe("selectImpactSound", () => {
  it("marble on marble ticks", () => {
    expect(selectImpactSound(true, true)).toBe("tick");
  });

  it("marble on track clacks", () => {
    expect(selectImpactSound(true, false)).toBe("clack");
    expect(selectImpactSound(false, true)).toBe("clack");
  });

  it("track on track is silent", () => {
    expect(selectImpactSound(false, false)).toBeNull();
  });
});

describe("impactParams", () => {
  it("a gentle touch is quiet and low-pitched", () => {
    const params = impactParams(0);
    expect(params.rate).toBeCloseTo(impactToPlayback(0));
    expect(params.volume).toBeCloseTo(impactToVolume(0));
  });

  it("a violent hit clamps at the musical ceiling", () => {
    const params = impactParams(1000);
    expect(params.rate).toBeCloseTo(impactToPlayback(MAX_FORCE));
    expect(params.volume).toBeCloseTo(impactToVolume(MAX_FORCE));
  });

  it("a medium hit rises between the extremes", () => {
    const gentle = impactParams(0);
    const medium = impactParams(MAX_FORCE / 2);
    const violent = impactParams(MAX_FORCE);
    expect(medium.rate).toBeGreaterThan(gentle.rate);
    expect(medium.rate).toBeLessThan(violent.rate);
    expect(medium.volume).toBeGreaterThan(gentle.volume);
  });

  it("the gentle-impact cutoff admits soft ticks the old gate muted", () => {
    // The old code dropped everything below force 1; the new cutoff must
    // sit clearly lower so low-speed clicks still sound (spec FR2).
    expect(MIN_IMPACT_FORCE).toBeGreaterThan(0);
    expect(MIN_IMPACT_FORCE).toBeLessThan(1);
  });
});
