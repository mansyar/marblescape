import { describe, expect, it } from "vitest";
import { colorHex, type MarbleColor } from "../domain/colors";
import type { PieceType } from "../domain/pieces";
import {
  colorSwatchCss,
  LABELS,
  normalizePaletteItems,
  PALETTE_REJECT_ANIMATION,
  type PaletteItem,
  paletteLayout,
  palettePickupTransform,
  paletteRejectKeyframes,
  pulseReject,
} from "./palette";

const ALL_TYPES: readonly PieceType[] = ["straight", "curved", "funnel", "goal"];

describe("palette labels", () => {
  it("labels every piece with its kid-facing name", () => {
    expect(LABELS).toEqual({
      straight: "Ramp",
      curved: "Curve",
      funnel: "Funnel",
      goal: "Hole",
    });
  });

  it("keeps the canonical order: Ramp, Curve, Funnel, Hole", () => {
    expect(ALL_TYPES.map((t) => LABELS[t])).toEqual(["Ramp", "Curve", "Funnel", "Hole"]);
  });
});

describe("paletteLayout portrait (bottom bar)", () => {
  it("keeps today's bottom-bar container styling", () => {
    const { containerCss } = paletteLayout("portrait");
    expect(containerCss).toContain("position:fixed;left:0;right:0;bottom:0");
    expect(containerCss).toContain("display:flex;justify-content:center;align-items:center");
    expect(containerCss).toContain("gap:10px;padding:10px");
  });

  it("keeps the bottom safe-area inset", () => {
    const { containerCss } = paletteLayout("portrait");
    expect(containerCss).toContain("padding-bottom:max(10px, env(safe-area-inset-bottom))");
  });

  it("keeps today's ≥72px button styling", () => {
    const { buttonCss } = paletteLayout("portrait");
    expect(buttonCss).toContain("flex:1 1 72px;max-width:110px;min-height:72px");
    expect(buttonCss).toContain("touch-action:none");
  });
});

describe("palette reject feedback", () => {
  it("shakes the tile with a bounded, restartable animation", () => {
    expect(PALETTE_REJECT_ANIMATION).toContain("0.32s");
    const keyframes = paletteRejectKeyframes();
    expect(keyframes).toContain("@keyframes ms-palette-reject");
    expect(keyframes).toContain("translateX(-6px)");
    expect(keyframes).toContain("translateX(6px)");
    expect(keyframes.endsWith("}")).toBe(true);
  });

  it("restarts the shake from rest on every reject", () => {
    const tile = { style: { animation: "" }, offsetWidth: 0 } as unknown as HTMLElement;
    pulseReject(tile);
    expect(tile.style.animation).toBe(PALETTE_REJECT_ANIMATION);
  });
});

describe("palette pickup feedback", () => {
  it("lifts the tile while dragging and settles it back on release", () => {
    expect(palettePickupTransform(true)).toContain("-4px");
    expect(palettePickupTransform(false)).toBe("");
  });
});

describe("paletteLayout landscape (right rail)", () => {
  it("renders a fixed right-side vertical rail", () => {
    const { containerCss } = paletteLayout("landscape");
    expect(containerCss).toContain("position:fixed");
    expect(containerCss).toContain("right:0");
    expect(containerCss).toContain("flex-direction:column");
    expect(containerCss).not.toContain("left:0");
    expect(containerCss).not.toContain("bottom:0;display:flex;justify-content:center");
  });

  it("centers the rail vertically on the right edge", () => {
    const { containerCss } = paletteLayout("landscape");
    expect(containerCss).toContain("top:0");
    expect(containerCss).toContain("bottom:0");
    expect(containerCss).toContain("justify-content:center");
  });

  it("respects the right safe-area inset", () => {
    const { containerCss } = paletteLayout("landscape");
    expect(containerCss).toContain("padding-right:max(10px, env(safe-area-inset-right))");
  });

  it("keeps buttons at least 72px in the rail", () => {
    const { buttonCss } = paletteLayout("landscape");
    expect(buttonCss).toContain("min-height:72px");
    expect(buttonCss).toContain("touch-action:none");
    // Fixed-size rail buttons instead of growing flex items.
    expect(buttonCss).toContain("flex:0 0 72px");
  });
});

describe("palette items", () => {
  it("normalizes legacy string palettes into typed items", () => {
    expect(normalizePaletteItems(["straight", "goal"])).toEqual([
      { type: "straight" },
      { type: "goal" },
    ]);
  });

  it("keeps item objects (with colors) untouched, in order", () => {
    const items: PaletteItem[] = [{ type: "straight" }, { type: "goal", color: "mint" }];
    expect(normalizePaletteItems(items)).toEqual(items);
  });

  it("accepts mixed legacy and item entries", () => {
    const mixed: Array<PieceType | PaletteItem> = ["curved", { type: "goal", color: "grape" }];
    expect(normalizePaletteItems(mixed)).toEqual([
      { type: "curved" },
      { type: "goal", color: "grape" },
    ]);
  });
});

describe("color swatch", () => {
  it("paints the candy color on a kid-sized dot", () => {
    const css = colorSwatchCss("tangerine");
    expect(css).toContain(colorHex("tangerine"));
    expect(css).toContain("18px");
    expect(css).toContain("border-radius:50%");
  });

  it("swatches every candy color distinctly", () => {
    const colors: MarbleColor[] = ["raspberry", "tangerine", "lemon", "mint", "blueberry", "grape"];
    const seen = new Set<string>();
    for (const color of colors) {
      seen.add(colorSwatchCss(color));
    }
    expect(seen.size).toBe(6);
  });
});
