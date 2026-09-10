import { describe, expect, it } from "vitest";
import type { PlacedPiece } from "./board";
import type { MarbleColor } from "./colors";
import { openCupKeys } from "./cup-lids";

function piece(overrides: Partial<PlacedPiece> & Pick<PlacedPiece, "x" | "y">): PlacedPiece {
  return { id: `p${overrides.x},${overrides.y}`, type: "goal", rotation: 0, ...overrides };
}

describe("openCupKeys", () => {
  it("always opens classic cups", () => {
    const cups = [piece({ x: 3, y: 5 })];
    expect(openCupKeys(cups, "mint")).toEqual(new Set(["3,5"]));
  });

  it("opens a colored cup only for its matching marble", () => {
    const cups = [piece({ x: 3, y: 5, color: "mint" })];
    expect(openCupKeys(cups, "mint")).toEqual(new Set(["3,5"]));
    expect(openCupKeys(cups, "grape")).toEqual(new Set());
  });

  it("ignores pieces that are not goal cups", () => {
    const pieces = [piece({ x: 3, y: 2, type: "straight", color: undefined })];
    expect(openCupKeys(pieces, "mint")).toEqual(new Set());
  });

  it("opens each cup independently in a multi-cup board", () => {
    const cups = [
      piece({ x: 3, y: 5, color: "mint" }),
      piece({ x: 4, y: 5 }),
      piece({ x: 5, y: 5, color: "grape" }),
    ];
    const colors: MarbleColor[] = ["mint", "grape"];
    expect(openCupKeys(cups, colors[0])).toEqual(new Set(["3,5", "4,5"]));
    expect(openCupKeys(cups, colors[1])).toEqual(new Set(["4,5", "5,5"]));
  });
});
