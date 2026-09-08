import { describe, expect, it } from "vitest";
import {
  createBoard,
  fromJSON,
  placeTypedPiece,
  saveBoard,
  loadBoard,
  toJSON,
  type BoardState,
} from "./board";
import type { Storage } from "./storage";

function sampleBoard(): BoardState {
  const board = createBoard(8, 6);
  return placeTypedPiece(board, { id: "p1", type: "straight", rotation: 0, x: 2, y: 3 });
}

const STORAGE_KEY = "marblescape.board.v1";

describe("board state", () => {
  it("extends the grid with piece metadata (type + rotation)", () => {
    const board = sampleBoard();
    expect(board.pieces.length).toBe(1);
    expect(board.pieces[0]).toEqual({ id: "p1", type: "straight", rotation: 0, x: 2, y: 3 });
  });
});

describe("serialization round-trip", () => {
  it("serializes to a versioned JSON string", () => {
    const json = toJSON(sampleBoard());
    const parsed = JSON.parse(json) as { version: number; pieces: unknown[] };
    expect(parsed.version).toBe(1);
    expect(parsed.pieces).toHaveLength(1);
  });

  it("round-trips piece data losslessly", () => {
    const board = sampleBoard();
    const restored = fromJSON(toJSON(board));
    expect(restored).toEqual(board);
  });

  it("round-trips an empty board", () => {
    const restored = fromJSON(toJSON(createBoard(8, 6)));
    expect(restored?.pieces).toEqual([]);
    expect(restored?.width).toBe(8);
  });
});

describe("fromJSON validation", () => {
  it("returns null for unparseable JSON", () => {
    expect(fromJSON("not json{")).toBeNull();
  });

  it("returns null for unknown schema versions", () => {
    expect(fromJSON('{"version":999,"pieces":[]}')).toBeNull();
  });

  it("returns null when structural fields are missing", () => {
    expect(fromJSON('{"pieces":[]}')).toBeNull();
    expect(fromJSON('{"version":1}')).toBeNull();
    expect(fromJSON('{"version":1,"pieces":"nope"}')).toBeNull();
  });

  it("returns null when a piece entry is malformed", () => {
    expect(
      fromJSON('{"version":1,"pieces":[{"id":"a","type":"banana","rotation":0,"x":0,"y":0}]}'),
    ).toBeNull();
    expect(
      fromJSON('{"version":1,"pieces":[{"id":"a","type":"straight","rotation":9,"x":0,"y":0}]}'),
    ).toBeNull();
    expect(
      fromJSON('{"version":1,"pieces":[{"id":"a","type":"straight","rotation":0,"x":"x","y":0}]}'),
    ).toBeNull();
  });
});

describe("localStorage persistence", () => {
  it("saves the board under the versioned key", () => {
    const storage = memoryStorage();
    saveBoard(storage, sampleBoard());
    expect(storage.getItem(STORAGE_KEY)).toBeTypeOf("string");
  });

  it("loads a saved board back", () => {
    const storage = memoryStorage();
    const board = sampleBoard();
    saveBoard(storage, board);
    expect(loadBoard(storage)).toEqual(board);
  });

  it("returns null when nothing is saved", () => {
    expect(loadBoard(memoryStorage())).toBeNull();
  });

  it("returns null (fresh start) when saved data is corrupt", () => {
    const storage = memoryStorage();
    storage.setItem(STORAGE_KEY, "garbage!!!");
    expect(loadBoard(storage)).toBeNull();
  });
});

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
    clear: () => void map.clear(),
  };
}
