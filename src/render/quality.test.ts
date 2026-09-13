import { describe, expect, it } from "vitest";
import { QualityGovernor } from "./quality";
import { QUALITY_DOWNGRADE_SUSTAIN_MS, QUALITY_MAX_TIER, QUALITY_TIERS } from "./quality-config";

const FAST_MS = 8; // comfortably inside the 60 fps budget
const SLOW_MS = 40; // comfortably past the downgrade threshold

/** Feed `seconds` worth of frames at a fixed delta. */
function feed(governor: QualityGovernor, deltaMs: number, seconds: number, atRest = true): void {
  const frames = Math.round((seconds * 1000) / deltaMs);
  for (let i = 0; i < frames; i += 1) governor.sample({ deltaMs, atRest });
}

describe("QualityGovernor", () => {
  it("starts at full quality", () => {
    const governor = new QualityGovernor();
    expect(governor.currentTier).toBe(0);
    expect(governor.spec).toBe(QUALITY_TIERS[0]);
  });

  it("ignores junk frame deltas", () => {
    const governor = new QualityGovernor();
    governor.sample({ deltaMs: Number.NaN, atRest: true });
    governor.sample({ deltaMs: -10, atRest: true });
    expect(governor.stats().frameCount).toBe(0);
    expect(governor.currentTier).toBe(0);
  });

  it("stays at full quality through a hiccup shorter than the sustain window", () => {
    const governor = new QualityGovernor();
    feed(governor, FAST_MS, 2);
    feed(governor, SLOW_MS, QUALITY_DOWNGRADE_SUSTAIN_MS / 1000 - 0.5);
    expect(governor.currentTier).toBe(0);
  });

  it("downgrades after a sustained breach, not on single spikes", () => {
    const governor = new QualityGovernor();
    feed(governor, FAST_MS, 2);
    governor.sample({ deltaMs: 250, atRest: true }); // one isolated spike
    feed(governor, FAST_MS, 2);
    expect(governor.currentTier).toBe(0);

    feed(governor, SLOW_MS, 4);
    expect(governor.currentTier).toBe(1);
  });

  it("steps down at most once per cooldown and never below the lean floor", () => {
    const governor = new QualityGovernor();
    feed(governor, SLOW_MS, 6);
    expect(governor.currentTier).toBe(1); // second drop is still blocked by the cooldown
    feed(governor, SLOW_MS, 6);
    expect(governor.currentTier).toBe(2);
    feed(governor, SLOW_MS, 10);
    expect(governor.currentTier).toBe(QUALITY_MAX_TIER);
    expect(governor.stats().downgrades).toBe(2);
  });

  it("upgrades only while the board is at rest", () => {
    const governor = new QualityGovernor();
    feed(governor, SLOW_MS, 6);
    expect(governor.currentTier).toBe(1);

    // Perfect frames while marbles are still running: no upgrade.
    feed(governor, FAST_MS, 20, false);
    expect(governor.currentTier).toBe(1);

    // Same frames once the board is at rest: the governor recovers.
    feed(governor, FAST_MS, 20, true);
    expect(governor.currentTier).toBe(0);
  });

  it("resets the upgrade clock when pacing breaks again", () => {
    const governor = new QualityGovernor();
    feed(governor, SLOW_MS, 6);
    expect(governor.currentTier).toBe(1);

    feed(governor, FAST_MS, 10); // healthy, but not yet 10 s of sustained good time
    expect(governor.currentTier).toBe(1);

    feed(governor, SLOW_MS, 1); // a brief break — the upgrade clock must restart
    feed(governor, FAST_MS, 6.5);
    expect(governor.currentTier).toBe(1); // would have upgraded by now without the reset

    feed(governor, FAST_MS, 20);
    expect(governor.currentTier).toBe(0);
    expect(governor.stats().upgrades).toBe(1);
  });

  it("reports stats for the dev readout", () => {
    const governor = new QualityGovernor();
    feed(governor, SLOW_MS, 6);
    const stats = governor.stats();
    expect(stats.tier).toBe(1);
    expect(stats.downgrades).toBe(1);
    expect(stats.upgrades).toBe(0);
    expect(stats.emaFrameMs).toBeCloseTo(SLOW_MS);
    expect(stats.p95FrameMs).toBeCloseTo(SLOW_MS);
    expect(stats.frameCount).toBeGreaterThan(0);
  });
});
