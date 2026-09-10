import { describe, expect, it } from "vitest";
import { PHYSICS } from "./physics-config";

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

  it("drops a single marble per Play press (user preference)", () => {
    expect(PHYSICS.maxMarblesPerDrop).toBe(1);
  });

  it("is frozen against accidental runtime mutation", () => {
    expect(Object.isFrozen(PHYSICS)).toBe(true);
    expect(() => {
      (PHYSICS as Record<string, unknown>).marbleRadius = 99;
    }).toThrow();
  });

  it("keeps gravity tilted due south (direction fixed, spec FR1)", () => {
    expect(PHYSICS.gravity[0]).toBe(0); // no east-west drift
    expect(PHYSICS.gravity[2]).toBeGreaterThan(1.5); // south pull preserved
  });

  it("keeps momentum between the v1 mud-band and the too-fast extreme", () => {
    expect(PHYSICS.linearDamping).toBeGreaterThan(0); // still settles
    expect(PHYSICS.linearDamping).toBeLessThan(0.45);
    expect(PHYSICS.angularDamping).toBeGreaterThan(0);
    expect(PHYSICS.angularDamping).toBeLessThan(0.6);
  });

  it("bounces livelier than v1 for click-clack drama", () => {
    expect(PHYSICS.marbleRestitution).toBeGreaterThanOrEqual(0.25);
    expect(PHYSICS.boardRestitution).toBeGreaterThanOrEqual(0.15);
  });

  it("drops from high enough for an audible entrance", () => {
    expect(PHYSICS.spawnHeight).toBeGreaterThanOrEqual(0.8);
  });
});
