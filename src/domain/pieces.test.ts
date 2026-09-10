import { describe, expect, it } from "vitest";
import {
  canCarryColor,
  CONNECTIONS,
  connectsWith,
  nextRotation,
  PIECE_TYPES,
  rotate,
  type Rotation,
} from "./pieces";

describe("piece catalog", () => {
  it("defines exactly the four v1 piece types", () => {
    expect(PIECE_TYPES).toEqual(["straight", "curved", "funnel", "goal"]);
  });

  it("maps each piece type to a Kenney model file", () => {
    for (const type of PIECE_TYPES) {
      expect(CONNECTIONS[type].model).toMatch(/\.glb$/);
    }
  });

  it("maps straight to the straight.glb model", () => {
    expect(CONNECTIONS.straight.model).toBe("/models/pieces/straight.glb");
  });

  it("maps curved and funnel to true 1x1-cell models with yaw offsets", () => {
    // bend.glb (1x2) and funnel.glb (1.7x1) overhang neighboring cells;
    // corner.glb and straight-hole.glb are exact 1x1 replacements.
    expect(CONNECTIONS.curved.model).toBe("/models/pieces/corner.glb");
    expect(CONNECTIONS.funnel.model).toBe("/models/pieces/straight-hole.glb");
    // Model mouths sit 90° off the domain sides; the offset realigns them.
    expect(CONNECTIONS.curved.modelYawOffset).toBe(-Math.PI / 2);
    expect(CONNECTIONS.funnel.modelYawOffset).toBe(0);
    expect(CONNECTIONS.straight.modelYawOffset).toBe(0);
    expect(CONNECTIONS.goal.modelYawOffset).toBe(0);
  });

  it("gives the straight piece a downhill slope (ramp), others flat", () => {
    // ~5°: high end north, low end south — marbles must roll, not sit.
    expect(CONNECTIONS.straight.slope).toBeCloseTo(0.09, 2);
    expect(CONNECTIONS.curved.slope ?? 0).toBe(0);
    expect(CONNECTIONS.funnel.slope ?? 0).toBe(0);
    expect(CONNECTIONS.goal.slope ?? 0).toBe(0);
  });
});

describe("rotation state machine", () => {
  it("cycles straight through 4 orientations", () => {
    expect(nextRotation("straight", 0)).toBe(1);
    expect(nextRotation("straight", 1)).toBe(2);
    expect(nextRotation("straight", 2)).toBe(3);
    expect(nextRotation("straight", 3)).toBe(0);
  });

  it("cycles curved through 4 orientations", () => {
    expect(nextRotation("curved", 0)).toBe(1);
    expect(nextRotation("curved", 3)).toBe(0);
  });

  it("goal is orientation-independent (stays at 0)", () => {
    expect(nextRotation("goal", 0)).toBe(0);
  });

  it("funnel (drop trap) cycles through 4 orientations", () => {
    expect(nextRotation("funnel", 0)).toBe(1);
    expect(nextRotation("funnel", 3)).toBe(0);
  });

  it("rotate applies n quarter turns modulo valid orientations", () => {
    expect(rotate("straight", 0 as Rotation, 5)).toBe(1);
    expect(rotate("straight", 3 as Rotation, 1)).toBe(0);
    expect(rotate("curved", 0 as Rotation, 2)).toBe(2);
    expect(rotate("funnel", 0 as Rotation, 2)).toBe(2);
  });

  it("throws on invalid rotation values", () => {
    expect(() => nextRotation("straight", 4 as Rotation)).toThrow();
    expect(() => nextRotation("straight", -1 as Rotation)).toThrow();
  });
});

describe("connections", () => {
  it("straight at 0 connects north and south", () => {
    expect(CONNECTIONS.straight.sides(0).sort()).toEqual(["north", "south"]);
  });

  it("straight at 1 connects east and west", () => {
    expect(CONNECTIONS.curved.sides(0).length).toBe(2);
    expect(CONNECTIONS.straight.sides(1).sort()).toEqual(["east", "west"]);
  });

  it("curved at 0 connects two adjacent sides", () => {
    const sides = CONNECTIONS.curved.sides(0);
    expect(sides.length).toBe(2);
    expect(sides).not.toEqual(CONNECTIONS.straight.sides(0));
  });

  it("rotating curved shifts its sides by one quarter turn", () => {
    const r0 = CONNECTIONS.curved.sides(0);
    const r1 = CONNECTIONS.curved.sides(1);
    for (const side of r0) {
      expect(r1).toContain(shift(side));
    }
    expect(r1.length).toBe(2);
  });

  it("funnel is a straight drop channel: north + south mouths, shifting with rotation", () => {
    expect(CONNECTIONS.funnel.sides(0).sort()).toEqual(["north", "south"]);
    expect(CONNECTIONS.funnel.sides(1).sort()).toEqual(["east", "west"]);
  });

  it("goal exposes its single connection side regardless of rotation", () => {
    expect(CONNECTIONS.goal.sides(0).length).toBe(1);
    expect(CONNECTIONS.goal.sides(2)).toEqual(CONNECTIONS.goal.sides(0));
  });

  it("connectsWith returns true when two placements share an open side pair", () => {
    // straight at (0,0) rot 0 (N-S) next to straight at (0,1) rot 0 (N-S):
    // south side of upper piece faces north side of lower piece.
    expect(connectsWith("straight", 0, "south", "straight", 0, "north")).toBe(true);
    expect(connectsWith("straight", 0, "south", "straight", 1, "north")).toBe(false);
  });
});

function shift(side: string): string {
  const order = ["north", "east", "south", "west"];
  return order[(order.indexOf(side) + 1) % 4];
}

describe("color support", () => {
  it("only the goal cup can carry a candy color", () => {
    expect(canCarryColor("goal")).toBe(true);
    expect(canCarryColor("straight")).toBe(false);
    expect(canCarryColor("curved")).toBe(false);
    expect(canCarryColor("funnel")).toBe(false);
  });
});
