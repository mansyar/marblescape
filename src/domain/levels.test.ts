import { describe, expect, it } from "vitest";
import type { MarbleColor } from "./colors";
import {
  LEVELS,
  getLevel,
  isLevelSolvable,
  isScriptComplete,
  nextScriptedColor,
  requiredMarbleCounts,
  validateLevel,
  type FixedPiece,
  type GapSlot,
  type LevelDef,
} from "./levels";
import type { PieceType, Rotation } from "./pieces";

function fixed(type: PieceType, x: number, y: number, rotation: Rotation = 0) {
  return { type, rotation, x, y };
}

function gap(x: number, y: number, accepted: PieceType[]): GapSlot {
  return { x, y, accepted };
}

function level(overrides: Partial<LevelDef>): LevelDef {
  const base: LevelDef = {
    id: 1,
    name: "Test",
    boardWidth: 8,
    boardHeight: 6,
    fixed: [fixed("straight", 3, 0), fixed("straight", 3, 1), fixed("goal", 3, 5)],
    gaps: [gap(3, 2, ["straight"])],
    palette: ["straight"],
    spawn: { x: 3, y: 0 },
    goal: { x: 3, y: 5 },
  };
  return { ...base, ...overrides };
}

function cup(color: MarbleColor, x: number, y: number): FixedPiece {
  return { type: "goal", rotation: 0, x, y, color };
}

/** Valid sorting level: shared trunk, then a per-color final leg via the gap. */
function sortingLevel(overrides: Partial<LevelDef> = {}): LevelDef {
  const base: LevelDef = {
    id: 7,
    name: "Sort",
    boardWidth: 8,
    boardHeight: 6,
    fixed: [
      fixed("straight", 3, 0),
      fixed("straight", 3, 1),
      fixed("straight", 3, 3),
      fixed("curved", 4, 2, 2),
      cup("raspberry", 3, 4),
      cup("mint", 4, 3),
    ],
    gaps: [gap(3, 2, ["straight", "curved"])],
    palette: ["straight", "curved"],
    spawn: { x: 3, y: 0 },
    marbleColors: ["raspberry", "mint"],
  };
  return { ...base, ...overrides };
}

describe("level definition schema", () => {
  it("accepts a valid level", () => {
    expect(() => validateLevel(level({}))).not.toThrow();
  });

  it("rejects a missing or empty name", () => {
    expect(() => validateLevel(level({ name: "" }))).toThrow(/name/);
  });

  it("rejects a non-integer or out-of-range id", () => {
    expect(() => validateLevel(level({ id: 0 }))).toThrow(/id/);
    expect(() => validateLevel(level({ id: 10 }))).toThrow(/id/);
  });

  it("accepts ids 7 through 9", () => {
    expect(() => validateLevel(level({ id: 7 }))).not.toThrow();
    expect(() => validateLevel(sortingLevel({ id: 9 }))).not.toThrow();
  });

  it("rejects fixed pieces outside the board", () => {
    expect(() => validateLevel(level({ fixed: [fixed("straight", 8, 0)] }))).toThrow(/outside/i);
  });

  it("rejects overlapping fixed pieces", () => {
    const dup = [fixed("straight", 3, 1), fixed("curved", 3, 1)];
    expect(() => validateLevel(level({ fixed: dup }))).toThrow(/overlap|occupied/i);
  });

  it("rejects a non-zero rotation on a non-rotatable goal piece", () => {
    expect(() => validateLevel(level({ fixed: [fixed("goal", 3, 5, 2)] }))).toThrow(/rotation/i);
  });

  it("rejects gaps outside the board", () => {
    expect(() => validateLevel(level({ gaps: [gap(-1, 3, ["straight"])] }))).toThrow(/outside/i);
  });

  it("rejects gaps overlapping fixed pieces", () => {
    const overlapping = [gap(3, 1, ["straight"])];
    expect(() => validateLevel(level({ gaps: overlapping }))).toThrow(/occupied|overlap/i);
  });

  it("rejects overlapping gaps", () => {
    const dup = [gap(3, 2, ["straight"]), gap(3, 2, ["curved"])];
    expect(() => validateLevel(level({ gaps: dup }))).toThrow(/overlap/i);
  });

  it("rejects gaps with empty accepted types", () => {
    expect(() => validateLevel(level({ gaps: [gap(3, 2, [])] }))).toThrow(/accepted/i);
  });

  it("rejects accepted types not present in the palette", () => {
    const bad = [gap(3, 2, ["funnel"])];
    expect(() => validateLevel(level({ gaps: bad, palette: ["straight"] }))).toThrow(/palette/i);
  });

  it("rejects an empty palette or duplicate palette entries", () => {
    expect(() => validateLevel(level({ palette: [] }))).toThrow(/palette/i);
    expect(() => validateLevel(level({ palette: ["straight", "straight"] }))).toThrow(/palette/i);
  });

  it("requires at least one gap", () => {
    expect(() => validateLevel(level({ gaps: [] }))).toThrow(/gap/i);
  });

  it("requires a goal cell inside the board", () => {
    expect(() => validateLevel(level({ goal: { x: 8, y: 0 } }))).toThrow(/goal/i);
  });

  it("requires the goal cell to hold a goal piece (fixed or gap)", () => {
    expect(() => validateLevel(level({ goal: { x: 2, y: 2 } }))).toThrow(/goal/i);
  });

  it("accepts a goal reached via a gap that accepts the goal piece", () => {
    const lvl = level({
      fixed: [fixed("straight", 3, 0), fixed("straight", 3, 1)],
      gaps: [gap(3, 2, ["straight"]), gap(3, 5, ["goal"])],
      palette: ["straight", "goal"],
      goal: { x: 3, y: 5 },
    });
    expect(() => validateLevel(lvl)).not.toThrow();
  });

  it("rejects more than one goal piece on the board", () => {
    const twoGoals = level({
      fixed: [
        fixed("straight", 3, 0),
        fixed("straight", 3, 1),
        fixed("goal", 3, 5),
        fixed("goal", 4, 5),
      ],
      goal: { x: 3, y: 5 },
    });
    expect(() => validateLevel(twoGoals)).toThrow(/goal/i);
  });

  it("rejects a level missing its start chute at the spawn cell", () => {
    expect(() =>
      validateLevel(level({ fixed: [fixed("straight", 3, 1), fixed("goal", 3, 5)] })),
    ).toThrow(/spawn|chute/i);
  });

  it("rejects a non-straight start chute", () => {
    expect(() =>
      validateLevel(
        level({ fixed: [fixed("curved", 3, 0), fixed("straight", 3, 1), fixed("goal", 3, 5)] }),
      ),
    ).toThrow(/chute/i);
  });

  it("rejects a rotated start chute", () => {
    expect(() =>
      validateLevel(
        level({
          fixed: [fixed("straight", 3, 0, 1), fixed("straight", 3, 1), fixed("goal", 3, 5)],
        }),
      ),
    ).toThrow(/chute/i);
  });
});

describe("sorting level schema", () => {
  it("accepts a valid sorting level", () => {
    expect(() => validateLevel(sortingLevel())).not.toThrow();
  });

  it("rejects a colored cup in a classic level", () => {
    const lvl = level({
      fixed: [fixed("straight", 3, 0), fixed("straight", 3, 1), cup("mint", 3, 5)],
    });
    expect(() => validateLevel(lvl)).toThrow(/color/i);
  });

  it("rejects a classic goal cell on a sorting level", () => {
    expect(() => validateLevel(sortingLevel({ goal: { x: 3, y: 5 } }))).toThrow(/goal/i);
  });

  it("rejects a colorless goal piece on a sorting level", () => {
    const lvl = sortingLevel({
      fixed: [
        fixed("straight", 3, 0),
        fixed("straight", 3, 1),
        fixed("straight", 3, 3),
        fixed("curved", 4, 2, 2),
        cup("raspberry", 3, 4),
        cup("mint", 4, 3),
        fixed("goal", 5, 5),
      ],
    });
    expect(() => validateLevel(lvl)).toThrow(/goal|color/i);
  });

  it("rejects a classic goal gap on a sorting level", () => {
    const lvl = sortingLevel({ gaps: [gap(3, 2, ["goal"])], palette: ["goal"] });
    expect(() => validateLevel(lvl)).toThrow(/goal/i);
  });

  it("requires at least two colored cups", () => {
    const lvl = sortingLevel({
      fixed: [fixed("straight", 3, 0), fixed("straight", 3, 1), cup("raspberry", 3, 4)],
      gaps: [gap(3, 2, ["straight"])],
      marbleColors: ["raspberry"],
    });
    expect(() => validateLevel(lvl)).toThrow(/cup/i);
  });

  it("requires unique cup colors", () => {
    const lvl = sortingLevel({
      fixed: [
        fixed("straight", 3, 0),
        fixed("straight", 3, 1),
        fixed("straight", 3, 3),
        cup("raspberry", 3, 4),
        cup("raspberry", 4, 3),
      ],
    });
    expect(() => validateLevel(lvl)).toThrow(/unique|duplicate/i);
  });

  it("requires a non-empty script whose colors all have cups", () => {
    expect(() => validateLevel(sortingLevel({ marbleColors: [] }))).toThrow(/script|marble/i);
    expect(() =>
      validateLevel(sortingLevel({ marbleColors: ["raspberry", "mint", "grape"] })),
    ).toThrow(/cup/i);
  });

  it("requires every cup color to appear in the script", () => {
    expect(() => validateLevel(sortingLevel({ marbleColors: ["raspberry"] }))).toThrow(/script/i);
  });

  it("rejects unknown colors in scripts and on cups", () => {
    expect(() =>
      validateLevel(sortingLevel({ marbleColors: ["banana" as MarbleColor, "mint"] })),
    ).toThrow(/color|unknown/i);
    expect(() =>
      validateLevel(
        sortingLevel({
          fixed: [
            fixed("straight", 3, 0),
            fixed("straight", 3, 1),
            fixed("straight", 3, 3),
            fixed("curved", 4, 2, 2),
            cup("banana" as MarbleColor, 3, 4),
            cup("mint", 4, 3),
          ],
        }),
      ),
    ).toThrow(/color|unknown/i);
  });
});

describe("level catalog", () => {
  it("exposes exactly 6 levels with unique sequential ids", () => {
    expect(LEVELS).toHaveLength(6);
    expect(LEVELS.map((l) => l.id)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("exposes readable names for every level", () => {
    for (const lvl of LEVELS) {
      expect(lvl.name.length).toBeGreaterThan(0);
    }
  });

  it("returns a level by id via getLevel", () => {
    expect(getLevel(3)?.id).toBe(3);
    expect(getLevel(99)).toBeUndefined();
  });

  it("declares every level valid", () => {
    for (const lvl of LEVELS) {
      expect(() => validateLevel(lvl)).not.toThrow();
    }
  });
});

describe("solvability", () => {
  it("declares all six shipped levels solvable with their restricted palettes", () => {
    for (const lvl of LEVELS) {
      expect(isLevelSolvable(lvl), `${lvl.name} should be solvable`).toBe(true);
    }
  });

  it("rejects a route with a missing connection (gap too far from the route)", () => {
    const broken = level({
      fixed: [fixed("straight", 3, 0), fixed("straight", 3, 1), fixed("goal", 5, 5)],
      gaps: [gap(3, 2, ["straight"])],
      goal: { x: 5, y: 5 },
    });
    expect(isLevelSolvable(broken)).toBe(false);
  });

  it("rejects a route when the palette cannot bridge a gap", () => {
    // Gap at (3,2) requires north+south; curved can never open both.
    const wrongPalette = level({ gaps: [gap(3, 2, ["curved"])], palette: ["curved"] });
    expect(isLevelSolvable(wrongPalette)).toBe(false);
  });

  it("rejects a route when a fixed piece's open sides do not face the neighbor", () => {
    // Straight at (3,1) opens north+south, so it cannot connect east to a route
    // that only approaches from the west.
    const blocked = level({
      fixed: [
        fixed("straight", 0, 0),
        fixed("straight", 3, 1),
        fixed("straight", 3, 3),
        fixed("goal", 3, 5),
      ],
      gaps: [gap(3, 2, ["straight"])],
      spawn: { x: 0, y: 0 },
      goal: { x: 3, y: 5 },
    });
    // spawn at (0,0) has no path onto the board: nothing connects to it.
    expect(isLevelSolvable(blocked)).toBe(false);
  });

  it("solves a curved gap that requires a single rotation covering both sides", () => {
    // Gap at (3,3) needs north (from (3,2)) and west (to the goal at (2,3)):
    // curved rotation 3 opens west+north.
    const lvl = level({
      fixed: [fixed("straight", 3, 0), fixed("straight", 3, 1), fixed("goal", 2, 3)],
      gaps: [gap(3, 2, ["straight"]), gap(3, 3, ["curved"])],
      palette: ["straight", "curved"],
      goal: { x: 2, y: 3 },
    });
    expect(isLevelSolvable(lvl)).toBe(true);
  });

  it("treats the goal cell as open from any side (a cup catches marbles)", () => {
    const lvl = level({
      fixed: [
        fixed("straight", 3, 0),
        fixed("straight", 3, 1),
        fixed("straight", 3, 3),
        fixed("goal", 3, 5),
      ],
      gaps: [gap(3, 2, ["straight"]), gap(3, 4, ["funnel"])],
      palette: ["straight", "funnel"],
      goal: { x: 3, y: 5 },
    });
    expect(isLevelSolvable(lvl)).toBe(true);
  });
});

describe("sortability", () => {
  it("accepts a sorting level where every scripted color reaches its cup", () => {
    expect(isLevelSolvable(sortingLevel())).toBe(true);
  });

  it("rejects a sorting level when a scripted color cannot reach its cup", () => {
    const blocked = sortingLevel({ gaps: [gap(3, 2, ["straight"])], palette: ["straight"] });
    expect(isLevelSolvable(blocked)).toBe(false);
  });

  it("returns false for a sorting level with an empty script", () => {
    expect(isLevelSolvable(sortingLevel({ marbleColors: [] }))).toBe(false);
  });
});

describe("marble color scripts", () => {
  it("counts required marbles per color", () => {
    const required = requiredMarbleCounts(["raspberry", "mint", "raspberry"]);
    expect(required.get("raspberry")).toBe(2);
    expect(required.get("mint")).toBe(1);
    expect(required.get("grape")).toBeUndefined();
  });

  it("drops the first scripted color whose count is unmet", () => {
    const script = ["mint", "raspberry", "mint"] as const;
    expect(nextScriptedColor(script, new Map())).toBe("mint");
    expect(nextScriptedColor(script, new Map([["mint", 1]]))).toBe("mint");
    expect(nextScriptedColor(script, new Map([["mint", 2]]))).toBe("raspberry");
    expect(
      nextScriptedColor(
        script,
        new Map([
          ["mint", 2],
          ["raspberry", 1],
        ]),
      ),
    ).toBeNull();
  });

  it("reports completion only when every required count is met", () => {
    const script: MarbleColor[] = ["mint", "raspberry"];
    expect(isScriptComplete(script, new Map())).toBe(false);
    expect(isScriptComplete(script, new Map([["mint", 1]]))).toBe(false);
    expect(
      isScriptComplete(
        script,
        new Map([
          ["mint", 1],
          ["raspberry", 1],
        ]),
      ),
    ).toBe(true);
  });
});
