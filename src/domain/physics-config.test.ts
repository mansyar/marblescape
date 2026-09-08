import { describe, expect, it } from "vitest";
import { PHYSICS, MARBLE_PALETTE } from "./physics-config";

describe("PHYSICS tuning config", () => {
  it("uses a fixed 60Hz timestep with substepping", () => {
    expect(PHYSICS.fixedTimeStep).toBeCloseTo(1 / 60);
    expect(PHYSICS.maxSubSteps).toBeGreaterThan(0);
  });

  it("points gravity downward on the board plane", () => {
    expect(PHYSICS.gravity[1]).toBeLessThan(0);
  });

  it("damps marble motion so marbles settle instead of jittering forever", () => {
    expect(PHYSICS.linearDamping).toBeGreaterThan(0);
    expect(PHYSICS.angularDamping).toBeGreaterThan(0);
  });

  it("keeps restitution below 1 (no energy-creating bounces)", () => {
    expect(PHYSICS.marbleRestitution).toBeGreaterThanOrEqual(0);
    expect(PHYSICS.marbleRestitution).toBeLessThan(1);
    expect(PHYSICS.boardRestitution).toBeGreaterThanOrEqual(0);
    expect(PHYSICS.boardRestitution).toBeLessThan(1);
  });

  it("defines a positive marble radius smaller than a grid cell", () => {
    expect(PHYSICS.marbleRadius).toBeGreaterThan(0);
    expect(PHYSICS.marbleRadius).toBeLessThan(PHYSICS.cellSize);
  });

  it("spawns marbles above the board so they drop in", () => {
    expect(PHYSICS.spawnHeight).toBeGreaterThan(0);
  });

  it("limits simultaneous marbles to the spec range (2-5)", () => {
    expect(PHYSICS.maxMarblesPerDrop).toBeGreaterThanOrEqual(2);
    expect(PHYSICS.maxMarblesPerDrop).toBeLessThanOrEqual(5);
  });

  it("is frozen against accidental runtime mutation", () => {
    expect(Object.isFrozen(PHYSICS)).toBe(true);
    expect(() => {
      (PHYSICS as Record<string, unknown>).marbleRadius = 99;
    }).toThrow();
  });
});

describe("MARBLE_PALETTE", () => {
  it("offers several candy colors for random marble assignment", () => {
    expect(MARBLE_PALETTE.length).toBeGreaterThanOrEqual(4);
    for (const color of MARBLE_PALETTE) {
      expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });
});
