import { describe, expect, it } from "vitest";
import { createBoard, placeTypedPiece, type PlacedPiece } from "../domain/board";
import { CUP_BURST_HEIGHT, cupBurstPosition } from "./celebration";

function boardWith(pieces: PlacedPiece[]) {
  let board = createBoard(8, 6);
  for (const piece of pieces) {
    board = placeTypedPiece(board, piece);
  }
  return board;
}

describe("cupBurstPosition", () => {
  it("anchors at the goal cell center, just above the board surface", () => {
    const board = boardWith([{ id: "g1", type: "goal", rotation: 0, x: 3, y: 5 }]);
    const position = cupBurstPosition(board);
    expect(position).not.toBeNull();
    expect(position?.x).toBeCloseTo(3.5);
    expect(position?.z).toBeCloseTo(5.5);
    expect(position?.y).toBeCloseTo(CUP_BURST_HEIGHT);
    expect(position?.y).toBeGreaterThan(0);
    expect(position?.y).toBeLessThan(0.5);
  });

  it("returns null when the board has no goal piece", () => {
    const board = boardWith([{ id: "p1", type: "straight", rotation: 0, x: 0, y: 0 }]);
    expect(cupBurstPosition(board)).toBeNull();
  });
});
