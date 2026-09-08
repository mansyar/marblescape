import { describe, expect, it } from "vitest";
import { computeCameraFraming } from "../render/framing";
import type { Cell } from "./picking";
import { screenToCell } from "./picking";

const landscape = computeCameraFraming(16 / 9);
const portrait = computeCameraFraming(9 / 16);

function expectCell(cell: Cell | null): Cell {
  if (!cell) {
    throw new Error("expected a cell but got null");
  }
  return cell;
}

describe("screenToCell", () => {
  it("maps the screen center onto the board's center cell", () => {
    const cell = screenToCell(0, 0, landscape, 16 / 9);
    expect(cell).toEqual({ x: 4, y: 3 });
  });

  it("maps portrait center identically (camera refits, lookAt unchanged)", () => {
    const cell = screenToCell(0, 0, portrait, 9 / 16);
    expect(cell).toEqual({ x: 4, y: 3 });
  });

  it("moves right on screen toward higher columns", () => {
    const left = expectCell(screenToCell(-0.3, 0, landscape, 16 / 9));
    const right = expectCell(screenToCell(0.3, 0, landscape, 16 / 9));
    expect(right.x).toBeGreaterThan(left.x);
    expect(right.y).toBe(left.y); // same row along the horizontal axis
  });

  it("moves down on screen toward higher rows (toward the camera)", () => {
    const top = expectCell(screenToCell(0, 0.25, landscape, 16 / 9));
    const bottom = expectCell(screenToCell(0, -0.25, landscape, 16 / 9));
    expect(bottom.y).toBeGreaterThan(top.y);
    expect(bottom.x).toBe(top.x);
  });

  it("returns null for points off the board (screen edges)", () => {
    // With the 1.12 framing margin, the screen edge is past the board edge.
    expect(screenToCell(0.999, 0, landscape, 16 / 9)).toBeNull();
    expect(screenToCell(-0.999, 0, landscape, 16 / 9)).toBeNull();
    expect(screenToCell(0, 0.999, portrait, 9 / 16)).toBeNull();
  });

  it("snaps to a stable cell inside each cell's footprint", () => {
    // Two nearby points within one cell map to the same cell.
    const a = screenToCell(0.01, 0.01, landscape, 16 / 9);
    const b = screenToCell(0.02, 0.02, landscape, 16 / 9);
    expect(a).toEqual(b);
  });
});
