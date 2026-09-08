import { describe, expect, it } from "vitest";
import {
  canPlace,
  createGrid,
  getPieceAt,
  isInside,
  isOccupied,
  placePiece,
  removePiece,
  type GridState,
} from "./grid";

describe("createGrid", () => {
  it("creates an empty grid with the given dimensions", () => {
    const grid = createGrid(8, 6);
    expect(grid.width).toBe(8);
    expect(grid.height).toBe(6);
    expect(grid.cells.every((c) => c === null)).toBe(true);
  });

  it("rejects non-positive dimensions", () => {
    expect(() => createGrid(0, 6)).toThrow();
    expect(() => createGrid(8, -1)).toThrow();
  });
});

describe("isInside", () => {
  it("returns true for cells within bounds", () => {
    const grid = createGrid(8, 6);
    expect(isInside(grid, 0, 0)).toBe(true);
    expect(isInside(grid, 7, 5)).toBe(true);
  });

  it("returns false for cells outside bounds", () => {
    const grid = createGrid(8, 6);
    expect(isInside(grid, -1, 0)).toBe(false);
    expect(isInside(grid, 8, 0)).toBe(false);
    expect(isInside(grid, 0, 6)).toBe(false);
    expect(isInside(grid, 0, -1)).toBe(false);
  });
});

describe("placePiece", () => {
  it("places a piece in an empty in-bounds cell", () => {
    const grid = createGrid(8, 6);
    const next = placePiece(grid, "piece-1", 3, 2);
    expect(getPieceAt(next, 3, 2)).toBe("piece-1");
    expect(getPieceAt(grid, 3, 2)).toBeNull(); // original untouched (immutable)
  });

  it("rejects placement outside bounds", () => {
    const grid = createGrid(8, 6);
    expect(canPlace(grid, 8, 2)).toBe(false);
    expect(() => placePiece(grid, "p", -1, 0)).toThrow();
  });

  it("rejects placement on an occupied cell", () => {
    const grid = placePiece(createGrid(8, 6), "a", 1, 1);
    expect(canPlace(grid, 1, 1)).toBe(false);
    expect(() => placePiece(grid, "b", 1, 1)).toThrow();
  });
});

describe("removePiece", () => {
  it("removes a piece and frees the cell", () => {
    let grid: GridState = placePiece(createGrid(8, 6), "a", 4, 4);
    grid = removePiece(grid, 4, 4);
    expect(getPieceAt(grid, 4, 4)).toBeNull();
    expect(canPlace(grid, 4, 4)).toBe(true);
  });

  it("throws when removing from an empty cell", () => {
    const grid = createGrid(8, 6);
    expect(() => removePiece(grid, 0, 0)).toThrow();
  });
});

describe("isOccupied", () => {
  it("reflects occupancy only for placed pieces", () => {
    const grid = placePiece(createGrid(8, 6), "a", 2, 2);
    expect(isOccupied(grid, 2, 2)).toBe(true);
    expect(isOccupied(grid, 3, 2)).toBe(false);
    expect(isOccupied(grid, -1, 2)).toBe(false);
  });
});
