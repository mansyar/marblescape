/**
 * Adaptive quality tuning — single source of truth, mirroring physics-config.ts.
 * Tiers are ordered from full quality (index 0) to the lean floor (last index):
 * budgets only ever drop down the ladder, and the game never goes below the
 * floor. Every per-tier value is drift-guarded by quality-config.test.ts.
 */

/** Frame budget for the 60 fps target, in milliseconds. */
export const FRAME_BUDGET_MS = 1000 / 60;

/** Frames kept for the rolling p95 (≈4 s at 60 fps). */
export const PERF_WINDOW_FRAMES = 240;
/** EMA smoothing factor for the dev readout (higher = more reactive). */
export const PERF_EMA_ALPHA = 0.1;
/** Frame deltas longer than this are hop artifacts (hidden tab, debugger pause). */
export const PERF_MAX_SAMPLE_MS = 250;

/** No policy decision is made before this many samples (warm-up). */
export const QUALITY_MIN_SAMPLES = 30;
/** Downgrade when p95 exceeds this (1.5× the 60 fps budget) … */
export const QUALITY_DOWNGRADE_P95_MS = 25;
/** … for this long, continuously. */
export const QUALITY_DOWNGRADE_SUSTAIN_MS = 3000;
/** Upgrade only once p95 sits inside the 60 fps budget … */
export const QUALITY_UPGRADE_P95_MS = FRAME_BUDGET_MS;
/** … for this long, with the board at rest. */
export const QUALITY_UPGRADE_SUSTAIN_MS = 10000;
/** Quiet window after any tier change, so the ladder can never thrash. */
export const QUALITY_COOLDOWN_MS = 5000;

export interface QualityTierSpec {
  /** Cap on `devicePixelRatio`; renderers use min(devicePixelRatio, cap). */
  dprCap: number;
  /** Cap on sparkle particles per burst. */
  sparkleParticleCount: number;
  /** Cap on confetti pieces per shower. */
  confettiPieces: number;
  /** Whether pooled contact shadows render. */
  shadows: boolean;
  /** Whether marble gleam sprites render. */
  gleam: boolean;
}

/** Full → reduced → lean floor (frozen at runtime, like physics-config.ts). */
export const QUALITY_TIERS: readonly QualityTierSpec[] = Object.freeze([
  // Tier 0 reproduces today's full-quality budgets exactly (drift guard).
  Object.freeze({
    dprCap: 2,
    sparkleParticleCount: 64,
    confettiPieces: 120,
    shadows: true,
    gleam: true,
  }),
  // Tier 1: cheaper pixels and particles; grounding cues stay.
  Object.freeze({
    dprCap: 1.5,
    sparkleParticleCount: 32,
    confettiPieces: 60,
    shadows: true,
    gleam: true,
  }),
  // Tier 2 (floor): leanest pixels; minimal particles; shadow + gleam sprites off.
  Object.freeze({
    dprCap: 1,
    sparkleParticleCount: 16,
    confettiPieces: 30,
    shadows: false,
    gleam: false,
  }),
]);

/** Highest tier index (the lean floor). */
export const QUALITY_MAX_TIER = QUALITY_TIERS.length - 1;
