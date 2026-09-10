import { describe, expect, it } from "vitest";
import {
  colorHex,
  isMarbleColor,
  MARBLE_COLORS,
  MARBLE_COLOR_HEX,
  MARBLE_PALETTE,
  nextMarbleColor,
  type MarbleColor,
} from "./colors";

describe("candy color model", () => {
  it("defines exactly the six candy colors in tap order", () => {
    expect(MARBLE_COLORS).toEqual([
      "raspberry",
      "tangerine",
      "lemon",
      "mint",
      "blueberry",
      "grape",
    ]);
  });

  it("maps every color to a candy hex", () => {
    for (const color of MARBLE_COLORS) {
      expect(MARBLE_COLOR_HEX[color]).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("defines one hex entry per color (no strays)", () => {
    expect(Object.keys(MARBLE_COLOR_HEX).sort()).toEqual([...MARBLE_COLORS].sort());
  });

  it("colorHex resolves a color's hex value", () => {
    expect(colorHex("raspberry")).toBe("#ef476f");
    expect(colorHex("mint")).toBe("#06d6a0");
  });

  it("keeps the hex palette index-aligned with tap order", () => {
    expect(MARBLE_PALETTE).toEqual(MARBLE_COLORS.map((color) => MARBLE_COLOR_HEX[color]));
  });

  it("nextMarbleColor advances through the cycle and wraps", () => {
    expect(nextMarbleColor("raspberry")).toBe("tangerine");
    expect(nextMarbleColor("tangerine")).toBe("lemon");
    expect(nextMarbleColor("lemon")).toBe("mint");
    expect(nextMarbleColor("mint")).toBe("blueberry");
    expect(nextMarbleColor("blueberry")).toBe("grape");
    expect(nextMarbleColor("grape")).toBe("raspberry");
  });

  it("returns to the starting color after six taps", () => {
    let color: MarbleColor = "blueberry";
    for (let i = 0; i < MARBLE_COLORS.length; i += 1) {
      color = nextMarbleColor(color);
    }
    expect(color).toBe("blueberry");
  });

  it("isMarbleColor accepts every candy color and rejects anything else", () => {
    for (const color of MARBLE_COLORS) {
      expect(isMarbleColor(color)).toBe(true);
    }
    expect(isMarbleColor("banana")).toBe(false);
    expect(isMarbleColor("#ef476f")).toBe(false);
    expect(isMarbleColor(undefined)).toBe(false);
    expect(isMarbleColor(null)).toBe(false);
    expect(isMarbleColor(3)).toBe(false);
  });
});
