import { describe, expect, it } from "vitest";
import { cellToWorld, rotationYaw } from "./piece-view";

describe("cellToWorld", () => {
  it("maps cell (0,0) to the center of its cell", () => {
    const [x, , z] = cellToWorld(0, 0);
    expect(x).toBeCloseTo(0.5);
    expect(z).toBeCloseTo(0.5);
  });

  it("maps cell (col,row) to col+0.5, row+0.5", () => {
    const [x, , z] = cellToWorld(3, 2);
    expect(x).toBeCloseTo(3.5);
    expect(z).toBeCloseTo(2.5);
  });

  it("sits on the board surface plane", () => {
    const [, y] = cellToWorld(0, 0);
    expect(y).toBe(0);
  });
});

describe("rotationYaw", () => {
  it("maps quarter turns to radians", () => {
    expect(rotationYaw(0)).toBeCloseTo(0);
    expect(rotationYaw(1)).toBeCloseTo(-Math.PI / 2);
    expect(rotationYaw(2)).toBeCloseTo(-Math.PI);
    expect(rotationYaw(3)).toBeCloseTo((-3 * Math.PI) / 2);
  });

  it("rotates clockwise when viewed from above (negative yaw)", () => {
    // Domain sides shift clockwise with rotation; in three.js a clockwise
    // turn viewed from +Y is a negative rotation around Y.
    expect(rotationYaw(1)).toBeLessThan(0);
    expect(rotationYaw(3)).toBeLessThan(0);
  });
});
