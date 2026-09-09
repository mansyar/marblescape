import { describe, expect, it } from "vitest";
import { getLevel, type LevelDef } from "./levels";
import {
  boardFor,
  canPlace,
  createPuzzle,
  furnitureAt,
  gapAt,
  move,
  place,
  placementAt,
  remove,
  reset,
  rotate,
} from "./puzzle";

function level(id: number): LevelDef {
  const lvl = getLevel(id);
  if (!lvl) {
    throw new Error(`Test level ${id} missing`);
  }
  return lvl;
}

describe("createPuzzle", () => {
  it("holds the level and starts with no placements", () => {
    const lvl = level(1);
    const p = createPuzzle(lvl);
    expect(p.level.id).toBe(1);
    expect(p.placements.size).toBe(0);
  });
});

describe("canPlace", () => {
  const lvl = level(1); // gap at (3,2) accepting straight
  const p = createPuzzle(lvl);

  it("accepts the gap's accepted piece type", () => {
    expect(canPlace(p, "straight", 3, 2)).toBe(true);
  });

  it("rejects pieces not accepted by the gap", () => {
    expect(canPlace(p, "curved", 3, 2)).toBe(false);
  });

  it("rejects furniture cells", () => {
    expect(canPlace(p, "straight", 3, 1)).toBe(false); // fixed straight
    expect(canPlace(p, "straight", 3, 5)).toBe(false); // fixed goal
  });

  it("rejects off-board and non-gap cells", () => {
    expect(canPlace(p, "straight", 0, 0)).toBe(false);
    expect(canPlace(p, "straight", 3, 0)).toBe(false); // spawn cell
    expect(canPlace(p, "straight", 4, 4)).toBe(false);
  });

  it("rejects an occupied gap", () => {
    const placed = place(p, "straight", 3, 2);
    expect(canPlace(placed, "straight", 3, 2)).toBe(false);
  });
});

describe("place", () => {
  it("places a piece into a gap and keeps it out of furniture", () => {
    const p = place(createPuzzle(level(1)), "straight", 3, 2);
    expect(placementAt(p, 3, 2)?.type).toBe("straight");
    expect(furnitureAt(p, 3, 1)?.type).toBe("straight");
  });

  it("returns the same state when placing onto furniture or a wrong type", () => {
    const p = createPuzzle(level(1));
    expect(place(p, "straight", 3, 1)).toBe(p); // furniture
    expect(place(p, "curved", 3, 2)).toBe(p); // wrong type
    const occupied = place(p, "straight", 3, 2);
    expect(place(occupied, "straight", 3, 2)).toBe(occupied); // occupied
  });

  it("supports a goal piece placed into a goal gap (level 4)", () => {
    const lvl = level(4); // goal cup is a gap at (3,5)
    const p = createPuzzle(lvl);
    expect(canPlace(p, "goal", 3, 5)).toBe(true);
    const placed = place(p, "goal", 3, 5);
    expect(placementAt(placed, 3, 5)?.type).toBe("goal");
  });
});

describe("remove", () => {
  it("clears a placement but leaves furniture alone", () => {
    const p = place(createPuzzle(level(1)), "straight", 3, 2);
    const cleared = remove(p, 3, 2);
    expect(placementAt(cleared, 3, 2)).toBeNull();
    expect(canPlace(cleared, "straight", 3, 2)).toBe(true);
    expect(remove(cleared, 3, 1)).toBe(cleared); // furniture: no-op
    expect(remove(cleared, 9, 9)).toBe(cleared); // empty: no-op
  });
});

describe("rotate", () => {
  it("cycles a placement's rotation and ignores furniture", () => {
    const p = place(createPuzzle(level(1)), "straight", 3, 2);
    const r1 = rotate(p, 3, 2);
    expect(placementAt(r1, 3, 2)?.rotation).toBe(1); // straight rot 1 = east-west
    const r2 = rotate(r1, 3, 2);
    expect(placementAt(r2, 3, 2)?.rotation).toBe(2);
    expect(rotate(p, 3, 1)).toBe(p); // furniture no-op
    expect(rotate(p, 9, 9)).toBe(p); // empty no-op
  });
});

describe("move", () => {
  it("relocates a placement into another valid gap and rejects invalid targets", () => {
    // Level 6: straight gaps at (3,1) and (2,4); curved-only gap at (3,3).
    const lvl = level(6);
    const p = place(createPuzzle(lvl), "straight", 3, 1);
    const moved = move(p, 3, 1, 2, 4);
    expect(placementAt(moved, 3, 1)).toBeNull();
    expect(placementAt(moved, 2, 4)?.type).toBe("straight");
    expect(move(moved, 2, 4, 4, 4)).toBe(moved); // not a gap
    expect(move(moved, 2, 4, 3, 2)).toBe(moved); // furniture
    expect(move(moved, 2, 4, 3, 3)).toBe(moved); // gap accepts curved only
    // Moving back into the now-free original gap is valid.
    const back = move(moved, 2, 4, 3, 1);
    expect(placementAt(back, 2, 4)).toBeNull();
    expect(placementAt(back, 3, 1)?.type).toBe("straight");
    // Occupied targets are rejected.
    const both = place(place(createPuzzle(lvl), "straight", 3, 1), "straight", 2, 4);
    expect(move(both, 3, 1, 2, 4)).toBe(both);
  });
});

describe("reset", () => {
  it("clears all placements, keeping furniture", () => {
    const lvl = level(2);
    let p = createPuzzle(lvl);
    p = place(p, "straight", 3, 2);
    p = place(p, "curved", 3, 4);
    const cleared = reset(p);
    expect(cleared.placements.size).toBe(0);
    expect(placementAt(cleared, 3, 2)).toBeNull();
    expect(furnitureAt(cleared, 3, 1)?.type).toBe("straight");
  });
});

describe("boardFor", () => {
  it("merges furniture and placements into a board with level dimensions", () => {
    const lvl = level(2);
    const p = place(place(createPuzzle(lvl), "straight", 3, 2), "curved", 3, 4);
    const board = boardFor(p);
    expect(board.width).toBe(8);
    expect(board.height).toBe(6);
    expect(board.pieces).toHaveLength(6); // 4 fixed + 2 placed
    const fixed = board.pieces.filter((piece) => piece.id.startsWith("f"));
    expect(fixed).toHaveLength(4);
    expect(board.pieces.some((piece) => piece.type === "goal")).toBe(true);
  });

  it("exposes the goal gap as empty until the child places the goal piece", () => {
    const lvl = level(4);
    const empty = boardFor(createPuzzle(lvl));
    expect(empty.pieces.some((piece) => piece.type === "goal")).toBe(false);
    const withGoal = place(createPuzzle(lvl), "goal", 3, 5);
    const board = boardFor(withGoal);
    expect(
      board.pieces.some((piece) => piece.type === "goal" && piece.x === 3 && piece.y === 5),
    ).toBe(true);
  });

  it("assigns stable ids to furniture pieces", () => {
    const board = boardFor(createPuzzle(level(1)));
    const fixed = board.pieces.filter((piece) => piece.id.startsWith("f"));
    expect(fixed.map((piece) => piece.id)).toEqual(["f3,1", "f3,3", "f3,4", "f3,5"]);
  });
});

describe("gapAt", () => {
  it("returns the gap slot for a gap cell and null elsewhere", () => {
    const p = createPuzzle(level(1));
    expect(gapAt(p, 3, 2)?.accepted).toEqual(["straight"]);
    expect(gapAt(p, 3, 1)).toBeNull();
    expect(gapAt(p, 9, 9)).toBeNull();
  });
});
