/**
 * Pure animation curves for interaction juice. The game state changes
 * immediately on every tap/drop; these helpers only drive the visual tween
 * (see `Game` pop-tweens), so they stay dependency-free and unit-testable.
 */

/** Valid-drop bounce length in seconds (spec FR3 ~200 ms). */
export const SNAP_BOUNCE_DURATION = 0.22;
/** Landing squash at the start of the bounce. */
export const SNAP_BOUNCE_SQUASH = 0.85;
/** Overshoot past resting scale, for the satisfying "pop". */
export const SNAP_BOUNCE_PEAK = 1.06;
/** Progress at which the overshoot peaks (then eases back to 1). */
export const SNAP_BOUNCE_PEAK_T = 0.4;

/** Invalid-drop wiggle length in seconds. */
export const REJECT_WIGGLE_DURATION = 0.32;
/** Peak wiggle angle in radians (~10°). */
export const REJECT_WIGGLE_AMPLITUDE = 0.18;
/** How many left-right shakes fit in one wiggle. */
export const REJECT_WIGGLE_CYCLES = 2.5;

/** Quarter-turn tween length in seconds (spec FR3 ~140 ms). */
export const ROTATE_TWEEN_DURATION = 0.14;

const TWO_PI = Math.PI * 2;

function clamp01(t: number): number {
  return Math.min(1, Math.max(0, t));
}

/** Smooth 0→1 curve so the bounce eases in and out instead of snapping. */
function smoothstep(x: number): number {
  const c = clamp01(x);
  return c * c * (3 - 2 * c);
}

/**
 * Valid-drop bounce: scale squashes on landing, overshoots past 1, then eases
 * back to exactly 1. `t` is normalised progress over SNAP_BOUNCE_DURATION.
 */
export function snapBounceScale(t: number): number {
  const c = clamp01(t);
  if (c >= 1) {
    return 1;
  }
  if (c <= 0) {
    return SNAP_BOUNCE_SQUASH;
  }
  if (c < SNAP_BOUNCE_PEAK_T) {
    const k = smoothstep(c / SNAP_BOUNCE_PEAK_T);
    return SNAP_BOUNCE_SQUASH + (SNAP_BOUNCE_PEAK - SNAP_BOUNCE_SQUASH) * k;
  }
  const k = smoothstep((c - SNAP_BOUNCE_PEAK_T) / (1 - SNAP_BOUNCE_PEAK_T));
  return SNAP_BOUNCE_PEAK + (1 - SNAP_BOUNCE_PEAK) * k;
}

/**
 * Invalid-drop "try a different piece!" wiggle: an oscillation in radians that
 * starts and ends at rest and decays so it finishes calm.
 */
export function rejectWiggleAngle(t: number): number {
  const c = clamp01(t);
  if (c <= 0 || c >= 1) {
    return 0;
  }
  const decay = 1 - c;
  return REJECT_WIGGLE_AMPLITUDE * decay * Math.sin(TWO_PI * REJECT_WIGGLE_CYCLES * c);
}

/**
 * Wraps an angle delta into (-π, π] so a rotation always takes the short way
 * around (e.g. 270° → 0° turns +90°, not −270°).
 */
export function shortestAngleDelta(delta: number): number {
  let d = delta % TWO_PI;
  if (d > Math.PI) {
    d -= TWO_PI;
  }
  if (d <= -Math.PI) {
    d += TWO_PI;
  }
  return d;
}

/**
 * Rotate-tap yaw interpolation from `from` to `to` (radians) at normalised
 * progress `t`. Game state already holds the new rotation; this only animates
 * the mesh, and the result at t = 1 is visually identical to `to`.
 */
export function rotateYaw(from: number, to: number, t: number): number {
  return from + shortestAngleDelta(to - from) * clamp01(t);
}
