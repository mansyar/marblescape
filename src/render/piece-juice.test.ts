import { describe, expect, it } from "vitest";
import { REJECT_WIGGLE_DURATION, ROTATE_TWEEN_DURATION, SNAP_BOUNCE_DURATION } from "./piece-anim";
import { PieceJuice } from "./piece-juice";

interface FakeTarget {
  rotation: { y: number };
  scaleValue: number;
  scale: { set: (x: number) => void };
}

function makeTarget(yaw = 0): FakeTarget {
  const target: FakeTarget = {
    rotation: { y: yaw },
    scaleValue: 1,
    scale: {
      set: (x: number) => {
        target.scaleValue = x;
      },
    },
  };
  return target;
}

describe("PieceJuice", () => {
  it("squashes a dropped piece, overshoots, then settles at scale 1", () => {
    const juice = new PieceJuice();
    const target = makeTarget();
    juice.snapBounce(target);
    expect(target.scaleValue).toBeLessThan(1); // squashed on landing
    juice.update(SNAP_BOUNCE_DURATION / 2);
    expect(target.scaleValue).toBeGreaterThan(1);
    juice.update(SNAP_BOUNCE_DURATION / 2);
    expect(target.scaleValue).toBe(1);
    expect(juice.activeCount).toBe(0);
  });

  it("wiggles a rejected piece and returns it to its base yaw", () => {
    const juice = new PieceJuice();
    const target = makeTarget(0.7);
    juice.wiggle(target);
    juice.update(REJECT_WIGGLE_DURATION * 0.1);
    expect(Math.abs(target.rotation.y - 0.7)).toBeGreaterThan(0.01);
    juice.update(REJECT_WIGGLE_DURATION);
    expect(target.rotation.y).toBeCloseTo(0.7, 6);
    expect(juice.activeCount).toBe(0);
  });

  it("tweens a rotate tap from the old yaw to the new one", () => {
    const juice = new PieceJuice();
    const target = makeTarget();
    juice.rotate(target, 0, -Math.PI / 2);
    juice.update(ROTATE_TWEEN_DURATION / 2);
    expect(target.rotation.y).toBeCloseTo(-Math.PI / 4, 6);
    juice.update(ROTATE_TWEEN_DURATION / 2);
    expect(target.rotation.y).toBeCloseTo(-Math.PI / 2, 6);
    expect(juice.activeCount).toBe(0);
  });

  it("re-triggers cleanly: a new tween cancels the old one and restores rest", () => {
    const juice = new PieceJuice();
    const target = makeTarget();
    juice.snapBounce(target);
    juice.update(SNAP_BOUNCE_DURATION / 2);
    juice.wiggle(target);
    expect(target.scaleValue).toBe(1);
    expect(juice.activeCount).toBe(1);
  });

  it("keeps targets independent and never leaves a tween stuck", () => {
    const juice = new PieceJuice();
    const a = makeTarget();
    const b = makeTarget();
    juice.snapBounce(a);
    juice.rotate(b, 0, Math.PI / 2);
    juice.update(10); // one huge frame (tab wake-up)
    expect(a.scaleValue).toBe(1);
    expect(b.rotation.y).toBeCloseTo(Math.PI / 2, 6);
    expect(juice.activeCount).toBe(0);
  });

  it("huge frames stay bounded and finite", () => {
    const juice = new PieceJuice();
    const target = makeTarget();
    juice.wiggle(target);
    juice.update(50);
    expect(Number.isFinite(target.rotation.y)).toBe(true);
    expect(juice.activeCount).toBe(0);
  });
});
