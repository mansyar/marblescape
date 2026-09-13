import { PerfMeter, clampFrameSample } from "./perf-meter";
import {
  QUALITY_COOLDOWN_MS,
  QUALITY_DOWNGRADE_P95_MS,
  QUALITY_DOWNGRADE_SUSTAIN_MS,
  QUALITY_MAX_TIER,
  QUALITY_MIN_SAMPLES,
  QUALITY_TIERS,
  QUALITY_UPGRADE_P95_MS,
  QUALITY_UPGRADE_SUSTAIN_MS,
  type QualityTierSpec,
} from "./quality-config";

export interface QualitySample {
  /** Frame delta since the previous sample, in milliseconds. */
  deltaMs: number;
  /** True while no marble is in flight and no overlay is animating. */
  atRest: boolean;
}

export interface QualityStats {
  /** Current ladder tier (0 = full). */
  tier: number;
  emaFrameMs: number;
  p95FrameMs: number;
  frameCount: number;
  downgrades: number;
  upgrades: number;
}

/**
 * Adaptive quality governor: consumes frame-pacing samples and steps a
 * monotonic tier ladder with hysteresis — sustained windows instead of single
 * spikes, a quiet cooldown between any two changes, and never below the lean
 * floor. Downgrades apply as soon as the policy fires (that is the point);
 * upgrades only accumulate while the board is at rest, so resolution never
 * pops mid-run. Pure — callers feed it deltas from the render loop.
 */
export class QualityGovernor {
  private readonly meter: PerfMeter;
  private tier = 0;
  private badMs = 0;
  private goodMs = 0;
  private cooldownMs = 0;
  private downgrades = 0;
  private upgrades = 0;

  constructor(meter: PerfMeter = new PerfMeter()) {
    this.meter = meter;
  }

  /** Current tier index (0 = full quality). */
  get currentTier(): number {
    return this.tier;
  }

  /** Budget spec for the current tier. */
  get spec(): QualityTierSpec {
    return QUALITY_TIERS[this.tier];
  }

  /** Feed one frame of pacing data; the policy updates in place. */
  sample(sample: QualitySample): void {
    const dt = clampFrameSample(sample.deltaMs);
    this.meter.sample(dt);
    if (dt <= 0) {
      return;
    }
    if (this.cooldownMs > 0) {
      this.cooldownMs = Math.max(0, this.cooldownMs - dt);
    }
    if (this.meter.sampleCount < QUALITY_MIN_SAMPLES) {
      return;
    }

    const p95 = this.meter.p95FrameMs;

    if (p95 > QUALITY_DOWNGRADE_P95_MS) {
      this.badMs += dt;
    } else {
      this.badMs = 0;
    }
    if (sample.atRest && p95 < QUALITY_UPGRADE_P95_MS && this.cooldownMs <= 0) {
      this.goodMs += dt;
    } else {
      this.goodMs = 0;
    }

    if (
      this.badMs >= QUALITY_DOWNGRADE_SUSTAIN_MS &&
      this.tier < QUALITY_MAX_TIER &&
      this.cooldownMs <= 0
    ) {
      this.changeTier(this.tier + 1);
      this.downgrades += 1;
    } else if (this.goodMs >= QUALITY_UPGRADE_SUSTAIN_MS && this.tier > 0) {
      this.changeTier(this.tier - 1);
      this.upgrades += 1;
    }
  }

  /** Snapshot for the dev readout and e2e perf gate. */
  stats(): QualityStats {
    return {
      tier: this.tier,
      emaFrameMs: this.meter.emaFrameMs,
      p95FrameMs: this.meter.p95FrameMs,
      frameCount: this.meter.sampleCount,
      downgrades: this.downgrades,
      upgrades: this.upgrades,
    };
  }

  private changeTier(next: number): void {
    this.tier = next;
    this.cooldownMs = QUALITY_COOLDOWN_MS;
    this.badMs = 0;
    this.goodMs = 0;
  }
}
