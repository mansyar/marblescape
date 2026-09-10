import { describe, expect, it } from "vitest";
import { LANDSCAPE_RAIL_FRACTION, layoutMode } from "./layout";

describe("layoutMode", () => {
  it("classifies portrait phones as portrait with no rail reservation", () => {
    expect(layoutMode(390, 844)).toEqual({ mode: "portrait", reservedWidth: 0 });
  });

  it("classifies landscape phones as landscape with the rail fraction", () => {
    expect(layoutMode(844, 390)).toEqual({
      mode: "landscape",
      reservedWidth: LANDSCAPE_RAIL_FRACTION,
    });
  });

  it("classifies iPad portrait as portrait", () => {
    expect(layoutMode(768, 1024).mode).toBe("portrait");
    expect(layoutMode(768, 1024).reservedWidth).toBe(0);
  });

  it("classifies iPad landscape as landscape with the rail fraction", () => {
    expect(layoutMode(1024, 768)).toEqual({
      mode: "landscape",
      reservedWidth: LANDSCAPE_RAIL_FRACTION,
    });
  });

  it("treats square viewports as landscape (rail available)", () => {
    expect(layoutMode(800, 800).mode).toBe("landscape");
  });

  it("keeps the rail fraction a strict minority of the viewport width", () => {
    expect(LANDSCAPE_RAIL_FRACTION).toBeGreaterThan(0);
    expect(LANDSCAPE_RAIL_FRACTION).toBeLessThan(0.5);
  });
});
