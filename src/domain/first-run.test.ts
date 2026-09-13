import { describe, expect, it } from "vitest";
import { BOARD_COLS, BOARD_ROWS } from "../render/framing";
import { type BoardState, createBoard, placeTypedPiece, saveBoard } from "./board";
import {
  FIRST_RUN_GAP,
  FIRST_RUN_HEIGHT,
  FIRST_RUN_LAYOUT,
  FIRST_RUN_WIDTH,
  type FirstRunPiece,
  isFirstRun,
} from "./first-run";
import { getPieceAt, isInside } from "./grid";
import { markOnboarded, ONBOARDED_KEY } from "./onboarding";
import { connectsWith } from "./pieces";

class MemoryStorage {
  private data = new Map<string, string>();
  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
  removeItem(key: string): void {
    this.data.delete(key);
  }
  clear(): void {
    this.data.clear();
  }
}

/** Builds the starter board from the layout, optionally with the gap filled. */
function starterBoard(withRampInGap: boolean): BoardState {
  let board = createBoard(FIRST_RUN_WIDTH, FIRST_RUN_HEIGHT);
  const pieces: FirstRunPiece[] = [...FIRST_RUN_LAYOUT];
  if (withRampInGap) {
    pieces.push({ type: "straight", rotation: 0, x: FIRST_RUN_GAP.x, y: FIRST_RUN_GAP.y });
  }
  pieces.forEach((piece, i) => {
    board = placeTypedPiece(board, { id: `s${i}`, ...piece });
  });
  return board;
}

function mustPiece(board: BoardState, x: number, y: number) {
  const piece = board.pieces.find((p) => p.x === x && p.y === y);
  if (!piece) {
    throw new Error(`No piece at (${x}, ${y})`);
  }
  return piece;
}

describe("FIRST_RUN_LAYOUT", () => {
  it("matches the sandbox board size", () => {
    expect(FIRST_RUN_WIDTH).toBe(BOARD_COLS);
    expect(FIRST_RUN_HEIGHT).toBe(BOARD_ROWS);
  });

  it("places every piece inside unique cells around a single empty gap", () => {
    let board = createBoard(FIRST_RUN_WIDTH, FIRST_RUN_HEIGHT);
    const seen = new Set<string>();
    for (const [i, piece] of FIRST_RUN_LAYOUT.entries()) {
      expect(isInside(board, piece.x, piece.y)).toBe(true);
      const key = `${piece.x},${piece.y}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
      board = placeTypedPiece(board, { id: `s${i}`, ...piece });
    }
    // The gap is the one hole between the chute column pieces.
    expect(getPieceAt(board, FIRST_RUN_GAP.x, FIRST_RUN_GAP.y)).toBeNull();
    expect(getPieceAt(board, FIRST_RUN_GAP.x, FIRST_RUN_GAP.y - 1)).not.toBeNull();
    expect(getPieceAt(board, FIRST_RUN_GAP.x, FIRST_RUN_GAP.y + 1)).not.toBeNull();
  });

  it("starts the run with the chute straight at the spawn cell", () => {
    const board = starterBoard(false);
    expect(mustPiece(board, 4, 0)).toMatchObject({ type: "straight", rotation: 0 });
  });

  it("connects chute → gap → goal once a straight fills the gap", () => {
    const board = starterBoard(true);
    const above = mustPiece(board, FIRST_RUN_GAP.x, FIRST_RUN_GAP.y - 1);
    const ramp = mustPiece(board, FIRST_RUN_GAP.x, FIRST_RUN_GAP.y);
    const below = mustPiece(board, FIRST_RUN_GAP.x, FIRST_RUN_GAP.y + 1);

    // The run is one continuous southbound channel through the gap...
    expect(
      connectsWith(above.type, above.rotation, "south", ramp.type, ramp.rotation, "north"),
    ).toBe(true);
    expect(
      connectsWith(ramp.type, ramp.rotation, "south", below.type, below.rotation, "north"),
    ).toBe(true);

    // ...and ends exactly at the goal cup's north mouth.
    const feeder = mustPiece(board, 4, 4);
    const goal = mustPiece(board, 4, 5);
    expect(goal.type).toBe("goal");
    expect(
      connectsWith(feeder.type, feeder.rotation, "south", goal.type, goal.rotation, "north"),
    ).toBe(true);
  });

  it("uses a single classic (colorless) goal cup", () => {
    const board = starterBoard(false);
    const goals = board.pieces.filter((p) => p.type === "goal");
    expect(goals).toHaveLength(1);
    expect(goals[0]?.color).toBeUndefined();
  });
});

describe("isFirstRun", () => {
  it("is true for a brand-new child (no board, no flag)", () => {
    expect(isFirstRun(new MemoryStorage())).toBe(true);
  });

  it("is false once any board is saved", () => {
    const storage = new MemoryStorage();
    saveBoard(storage, createBoard(FIRST_RUN_WIDTH, FIRST_RUN_HEIGHT));
    expect(isFirstRun(storage)).toBe(false);
  });

  it("is false once the completion flag exists", () => {
    const storage = new MemoryStorage();
    markOnboarded(storage);
    expect(isFirstRun(storage)).toBe(false);
  });

  it("treats a corrupt flag as absent but still respects a saved board", () => {
    const corrupt = new MemoryStorage();
    corrupt.setItem(ONBOARDED_KEY, "banana {");
    expect(isFirstRun(corrupt)).toBe(true);

    const corruptWithSave = new MemoryStorage();
    corruptWithSave.setItem(ONBOARDED_KEY, "banana {");
    saveBoard(corruptWithSave, createBoard(FIRST_RUN_WIDTH, FIRST_RUN_HEIGHT));
    expect(isFirstRun(corruptWithSave)).toBe(false);
  });
});
