import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { colorHex, type MarbleColor } from "../domain/colors";
import type { PieceType } from "../domain/pieces";
import type { PieceThumbnails } from "../render/piece-thumbnails";
import {
  colorSwatchCss,
  createPalette,
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
    const listeners: Record<string, () => void> = {};
    const tile = {
      style: { animation: "" },
      offsetWidth: 0,
      addEventListener: (type: string, listener: () => void) => {
        listeners[type] = listener;
      },
    } as unknown as HTMLElement;
    pulseReject(tile);
    expect(tile.style.animation).toBe(PALETTE_REJECT_ANIMATION);
    // Once the shake ends, the inline animation clears so a class-based
    // pulse (first-run invitation) can play again.
    listeners.animationend();
    expect(tile.style.animation).toBe("");
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

// Minimal element stub: just the DOM surface createPalette uses, so picture
// tiles are testable in the node suite (no jsdom).
class FakeStyle {
  cssText = "";
  [key: string]: unknown;
  setProperty(name: string, value: string): void {
    this[name] = value;
  }
}

interface FakePointerEvent {
  pointerId: number;
  clientX: number;
  clientY: number;
}

class FakeElement {
  tagName: string;
  style = new FakeStyle();
  dataset: Record<string, string> = {};
  attrs = new Map<string, string>();
  textContent = "";
  src = "";
  alt = "";
  draggable = false;
  children: FakeElement[] = [];
  parent: FakeElement | null = null;
  listeners: Record<string, Array<(event: FakePointerEvent) => void>> = {};
  capturedPointer: number | null = null;

  constructor(tagName: string) {
    this.tagName = tagName;
  }

  appendChild(child: FakeElement): FakeElement {
    child.parent = this;
    this.children.push(child);
    return child;
  }

  setAttribute(name: string, value: string): void {
    this.attrs.set(name, value);
  }

  addEventListener(type: string, handler: (event: FakePointerEvent) => void): void {
    const handlers = this.listeners[type] ?? [];
    handlers.push(handler);
    this.listeners[type] = handlers;
  }

  setPointerCapture(pointerId: number): void {
    this.capturedPointer = pointerId;
  }

  hasPointerCapture(pointerId: number): boolean {
    return this.capturedPointer === pointerId;
  }

  querySelector(): FakeElement | null {
    return null;
  }

  fire(type: string, event: Partial<FakePointerEvent> = {}): void {
    const full: FakePointerEvent = { pointerId: 1, clientX: 0, clientY: 0, ...event };
    for (const handler of this.listeners[type] ?? []) {
      handler(full);
    }
  }

  find(predicate: (el: FakeElement) => boolean): FakeElement | null {
    for (const child of this.children) {
      if (predicate(child)) {
        return child;
      }
      const nested = child.find(predicate);
      if (nested) {
        return nested;
      }
    }
    return null;
  }
}

describe("createPalette picture tiles", () => {
  let originalDocument: unknown;

  beforeEach(() => {
    originalDocument = (globalThis as { document?: unknown }).document;
    (globalThis as { document?: unknown }).document = {
      createElement: (tagName: string) => new FakeElement(tagName),
    };
  });

  afterEach(() => {
    (globalThis as { document?: unknown }).document = originalDocument;
  });

  function mount(options: {
    items?: Array<PieceType | PaletteItem>;
    thumbnails?: PieceThumbnails;
    onCycle?: (item: PaletteItem) => MarbleColor | null;
  }) {
    const drags: PaletteItem[] = [];
    const drops: PaletteItem[] = [];
    const root = new FakeElement("div");
    const bar = createPalette(
      root as unknown as HTMLElement,
      options.items ?? ["straight", { type: "goal", color: "mint" }],
      (item) => {
        drags.push(item);
      },
      (item) => {
        drops.push(item);
      },
      "portrait",
      options.onCycle,
      options.thumbnails,
    );
    const barEl = bar as unknown as FakeElement;
    const tile = (type: PieceType) =>
      barEl.children.find((el) => el.dataset.pieceType === type) ?? null;
    const findIn = (el: FakeElement | null, tagName: string) =>
      el?.find((child) => child.tagName === tagName) ?? null;
    return { barEl, tile, findIn, drags, drops };
  }

  it("renders a picture tile: img data URL, no visible text, aria-label, hooks intact", () => {
    const { tile, findIn } = mount({
      thumbnails: {
        straight: "data:image/png;base64,AAA",
        goal: "data:image/png;base64,BBB",
      },
    });

    const ramp = tile("straight");
    expect(ramp?.textContent).toBe("");
    expect(ramp?.dataset.pieceType).toBe("straight");
    expect(ramp?.attrs.get("aria-label")).toBe("Ramp");
    expect(findIn(ramp, "img")?.src).toBe("data:image/png;base64,AAA");

    const cup = tile("goal");
    expect(cup?.textContent).toBe("");
    expect(cup?.dataset.color).toBe("mint");
    expect(findIn(cup, "img")?.src).toBe("data:image/png;base64,BBB");
    expect(findIn(cup, "span")?.style.cssText).toContain(colorHex("mint"));
  });

  it("falls back to the word label when a snapshot is missing", () => {
    const { tile, findIn } = mount({
      items: ["straight", "curved"],
      thumbnails: { straight: "data:image/png;base64,AAA" },
    });

    expect(findIn(tile("straight"), "img")).not.toBeNull();
    expect(tile("straight")?.textContent).toBe("");

    expect(findIn(tile("curved"), "img")).toBeNull();
    expect(tile("curved")?.textContent).toBe("Curve");
    expect(tile("curved")?.attrs.get("aria-label")).toBe("Curve");
  });

  it("keeps the candy dot on the picture cup tile: tap cycles, drag drops", () => {
    const cycles: PaletteItem[] = [];
    const { tile, findIn, drags, drops } = mount({
      items: [{ type: "goal", color: "mint" }],
      thumbnails: { goal: "data:image/png;base64,BBB" },
      onCycle: (item) => {
        cycles.push(item);
        return "lemon";
      },
    });
    const cup = tile("goal");
    if (!cup) {
      throw new Error("cup tile missing");
    }
    const dot = findIn(cup, "span");

    // Tap (no movement): cycles the candy color and redraws the dot.
    cup.fire("pointerdown", { clientX: 5, clientY: 5 });
    cup.fire("pointerup", { clientX: 5, clientY: 5 });
    expect(cycles).toHaveLength(1);
    expect(cycles[0].color).toBe("mint");
    expect(cup.dataset.color).toBe("lemon");
    expect(dot?.style.cssText).toContain(colorHex("lemon"));
    expect(drops).toHaveLength(0);

    // Drag (moved past the threshold): normal palette drag → drop callbacks.
    cup.fire("pointerdown", { clientX: 5, clientY: 5 });
    cup.fire("pointermove", { clientX: 45, clientY: 5 });
    expect(drags).toHaveLength(1);
    expect(drags[0].color).toBe("lemon");
    cup.fire("pointerup", { clientX: 45, clientY: 5 });
    expect(drops).toHaveLength(1);
    expect(drops[0].type).toBe("goal");
  });
});
