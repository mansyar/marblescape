import { describe, expect, it } from "vitest";
import { CONFETTI_MAX_PIECES } from "../ui/confetti";
import { SPARKLE_MAX_PARTICLES_PER_BURST } from "./sparkles";
import {
  FRAME_BUDGET_MS,
  QUALITY_DOWNGRADE_P95_MS,
  QUALITY_MAX_TIER,
  QUALITY_MIN_SAMPLES,
  QUALITY_TIERS,
} from "./quality-config";

describe("quality budgets", () => {
  it("tier 0 reproduces today's full-quality budgets exactly (drift guard)", () => {
    const full = QUALITY_TIERS[0];
    expect(full.dprCap).toBe(2);
    expect(full.sparkleParticleCount).toBe(SPARKLE_MAX_PARTICLES_PER_BURST);
    expect(full.confettiPieces).toBe(CONFETTI_MAX_PIECES);
    expect(full.shadows).toBe(true);
    expect(full.gleam).toBe(true);
  });

  it("only ever drops budgets down the ladder", () => {
    for (let i = 1; i <= QUALITY_MAX_TIER; i += 1) {
      const prev = QUALITY_TIERS[i - 1];
      const cur = QUALITY_TIERS[i];
      expect(cur.dprCap).toBeLessThan(prev.dprCap);
      expect(cur.sparkleParticleCount).toBeLessThan(prev.sparkleParticleCount);
      expect(cur.confettiPieces).toBeLessThan(prev.confettiPieces);
      expect(cur.shadows && !prev.shadows).toBe(false);
      expect(cur.gleam && !prev.gleam).toBe(false);
    }
  });

  it("ends at the lean floor: dpr 1, shadow and gleam sprites off", () => {
    const floor = QUALITY_TIERS[QUALITY_MAX_TIER];
    expect(floor.dprCap).toBe(1);
    expect(floor.shadows).toBe(false);
    expect(floor.gleam).toBe(false);
  });
});

describe("quality policy thresholds", () => {
  it("triggers a downgrade between the 60 fps budget and the 30 fps failure floor", () => {
    expect(QUALITY_DOWNGRADE_P95_MS).toBeGreaterThan(FRAME_BUDGET_MS);
    expect(QUALITY_DOWNGRADE_P95_MS).toBeLessThan(1000 / 30);
  });

  it("waits for a warm-up window before any policy decision", () => {
    expect(QUALITY_MIN_SAMPLES).toBeGreaterThan(0);
  });
});
