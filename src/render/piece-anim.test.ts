import { describe, expect, it } from "vitest";
import {
  REJECT_WIGGLE_AMPLITUDE,
  REJECT_WIGGLE_DURATION,
  ROTATE_TWEEN_DURATION,
  SNAP_BOUNCE_DURATION,
  SNAP_BOUNCE_PEAK,
  SNAP_BOUNCE_PEAK_T,
  SNAP_BOUNCE_SQUASH,
  rejectWiggleAngle,
  rotateYaw,
  shortestAngleDelta,
  snapBounceScale,
} from "./piece-anim";

describe("snapBounceScale", () => {
  it("squishes on landing, overshoots past 1, then settles at 1", () => {
    expect(snapBounceScale(0)).toBeCloseTo(SNAP_BOUNCE_SQUASH, 5);
    expect(snapBounceScale(SNAP_BOUNCE_PEAK_T)).toBeCloseTo(SNAP_BOUNCE_PEAK, 5);
    expect(snapBounceScale(1)).toBe(1);
  });

  it("stays inside the squash/peak envelope and always ends settled", () => {
    for (let i = 0; i <= 100; i += 1) {
      const scale = snapBounceScale(i / 100);
      expect(scale).toBeGreaterThanOrEqual(SNAP_BOUNCE_SQUASH - 1e-9);
      expect(scale).toBeLessThanOrEqual(SNAP_BOUNCE_PEAK + 1e-9);
    }
    expect(snapBounceScale(1.5)).toBe(1);
    expect(snapBounceScale(-1)).toBeCloseTo(SNAP_BOUNCE_SQUASH, 5);
  });

  it("is brief (about 200 ms) so placement never feels slow", () => {
    expect(SNAP_BOUNCE_DURATION).toBeGreaterThanOrEqual(0.15);
    expect(SNAP_BOUNCE_DURATION).toBeLessThanOrEqual(0.3);
  });
});

describe("rejectWiggleAngle", () => {
  it("starts and ends at rest", () => {
    expect(rejectWiggleAngle(0)).toBe(0);
    expect(rejectWiggleAngle(1)).toBe(0);
    expect(rejectWiggleAngle(1.5)).toBe(0);
    expect(rejectWiggleAngle(-0.2)).toBe(0);
  });

  it("oscillates both ways and never exceeds the amplitude", () => {
    let sawPositive = false;
    let sawNegative = false;
    for (let i = 1; i < 100; i += 1) {
      const angle = rejectWiggleAngle(i / 100);
      expect(Math.abs(angle)).toBeLessThanOrEqual(REJECT_WIGGLE_AMPLITUDE + 1e-9);
      if (angle > 1e-6) {
        sawPositive = true;
      }
      if (angle < -1e-6) {
        sawNegative = true;
      }
    }
    expect(sawPositive).toBe(true);
    expect(sawNegative).toBe(true);
  });

  it("decays so it finishes calm, not buzzy", () => {
    const early = Math.abs(rejectWiggleAngle(0.1));
    const late = Math.abs(rejectWiggleAngle(0.85));
    expect(early).toBeGreaterThan(late);
    expect(late).toBeLessThan(REJECT_WIGGLE_AMPLITUDE * 0.4);
  });

  it("is short (under half a second)", () => {
    expect(REJECT_WIGGLE_DURATION).toBeGreaterThan(0.15);
    expect(REJECT_WIGGLE_DURATION).toBeLessThan(0.5);
  });
});

describe("shortestAngleDelta", () => {
  it("keeps small deltas and wraps big ones into (-π, π]", () => {
    expect(shortestAngleDelta(0.3)).toBeCloseTo(0.3, 6);
    expect(shortestAngleDelta((3 * Math.PI) / 2)).toBeCloseTo(-Math.PI / 2, 6);
    expect(shortestAngleDelta(-(3 * Math.PI) / 2)).toBeCloseTo(Math.PI / 2, 6);
  });
});

describe("rotateYaw", () => {
  it("interpolates a quarter turn linearly", () => {
    expect(rotateYaw(0, Math.PI / 2, 0)).toBe(0);
    expect(rotateYaw(0, Math.PI / 2, 0.5)).toBeCloseTo(Math.PI / 4, 6);
    expect(rotateYaw(0, Math.PI / 2, 1)).toBeCloseTo(Math.PI / 2, 6);
  });

  it("clamps progress and never overshoots", () => {
    expect(rotateYaw(1, 2, -1)).toBe(1);
    expect(rotateYaw(1, 2, 5)).toBeCloseTo(2, 6);
  });

  it("takes the short way around when crossing zero", () => {
    const from = (3 * Math.PI) / 2; // 270°
    const to = 0;
    expect(shortestAngleDelta(to - from)).toBeCloseTo(Math.PI / 2, 6);
    expect(rotateYaw(from, to, 0.5)).toBeCloseTo(from + Math.PI / 4, 6);
    // 2π ≡ 0 (mod 2π): the same visual yaw the game state already has.
    expect(rotateYaw(from, to, 1)).toBeCloseTo(2 * Math.PI, 6);
  });

  it("is quick (about 140 ms)", () => {
    expect(ROTATE_TWEEN_DURATION).toBeGreaterThan(0.08);
    expect(ROTATE_TWEEN_DURATION).toBeLessThan(0.3);
  });
});
