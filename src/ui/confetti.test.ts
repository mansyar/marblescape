import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MARBLE_PALETTE } from "../domain/physics-config";
import {
  CONFETTI_DURATION_MS,
  CONFETTI_MAX_PIECES,
  confettiPieces,
  createConfettiLayer,
} from "./confetti";

// Minimal element stub: just enough of the DOM surface the layer uses
// (createElement / appendChild / remove / style / dataset / textContent).
class FakeStyle {
  [key: string]: unknown;
  setProperty(name: string, value: string): void {
    this[name] = value;
  }
}

class FakeElement {
  style = new FakeStyle();
  dataset: Record<string, string> = {};
  textContent = "";
  children: FakeElement[] = [];
  parent: FakeElement | null = null;

  appendChild(child: FakeElement): FakeElement {
    child.parent = this;
    this.children.push(child);
    return child;
  }

  remove(): void {
    if (this.parent) {
      this.parent.children = this.parent.children.filter((c) => c !== this);
      this.parent = null;
    }
  }

  /** Confetti piece nodes (flying particles). */
  pieceNodes(): FakeElement[] {
    return this.children.filter((c) => c.dataset.confetti === "piece");
  }

  glowNodes(): FakeElement[] {
    return this.children.filter((c) => c.dataset.confetti === "glow");
  }
}

function seededRng(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}

describe("confettiPieces", () => {
  it("caps the shower at CONFETTI_MAX_PIECES even when asked for more", () => {
    expect(CONFETTI_MAX_PIECES).toBeLessThanOrEqual(120);
    expect(confettiPieces(500, seededRng(1))).toHaveLength(CONFETTI_MAX_PIECES);
  });

  it("honors smaller requests and clamps junk input to zero", () => {
    expect(confettiPieces(40, seededRng(2))).toHaveLength(40);
    expect(confettiPieces(Number.NaN, seededRng(3))).toHaveLength(0);
    expect(confettiPieces(-5, seededRng(4))).toHaveLength(0);
  });

  it("produces deterministic, bounded specs with candy colors", () => {
    const pieces = confettiPieces(10, seededRng(42));
    expect(confettiPieces(10, seededRng(42))).toEqual(pieces);
    for (const piece of pieces) {
      expect(MARBLE_PALETTE).toContain(piece.color);
      expect(Number.isFinite(piece.dx)).toBe(true);
      expect(piece.dy).toBeGreaterThan(0);
      expect(piece.delayMs).toBeGreaterThanOrEqual(0);
      expect(piece.durationMs).toBeGreaterThan(0);
      expect(piece.durationMs).toBeLessThanOrEqual(CONFETTI_DURATION_MS);
    }
  });
});

describe("createConfettiLayer", () => {
  let originalDocument: unknown;

  beforeEach(() => {
    originalDocument = (globalThis as { document?: unknown }).document;
    (globalThis as { document?: unknown }).document = {
      createElement: () => new FakeElement(),
    };
  });

  afterEach(() => {
    (globalThis as { document?: unknown }).document = originalDocument;
    vi.useRealTimers();
  });

  function mount(options?: { reducedMotion?: boolean; pieceCount?: number }) {
    const host = new FakeElement();
    const layer = createConfettiLayer(host as unknown as HTMLElement, options);
    const root = layer.el as unknown as FakeElement;
    return { host, layer, root };
  }

  it("mounts a testid'd, pointer-transparent layer", () => {
    const { host, root } = mount();
    expect(host.children).toHaveLength(1);
    expect(root.dataset.testid).toBe("confetti-layer");
    expect(String(root.style.cssText)).toContain("pointer-events:none");
  });

  it("bursts at most 120 animated pieces that clean themselves up", () => {
    vi.useFakeTimers();
    const { layer, root } = mount();
    layer.burst();
    const pieces = root.pieceNodes();
    expect(pieces.length).toBeGreaterThan(0);
    expect(pieces.length).toBeLessThanOrEqual(CONFETTI_MAX_PIECES);
    for (const piece of pieces.slice(0, 5)) {
      expect(String(piece.style.cssText)).toContain("ms-confetti-fall");
      expect(String(piece.style.cssText)).toMatch(/background-color:#/);
      expect(piece.style["--dy"]).toBeDefined();
    }
    vi.advanceTimersByTime(CONFETTI_DURATION_MS - 50);
    expect(root.pieceNodes().length).toBeGreaterThan(0);
    vi.advanceTimersByTime(50);
    expect(root.pieceNodes()).toHaveLength(0);
  });

  it("replaces the shower instead of stacking when bursted again", () => {
    vi.useFakeTimers();
    const { layer, root } = mount();
    layer.burst();
    const first = root.pieceNodes().length;
    layer.burst();
    expect(root.pieceNodes().length).toBe(first);
  });

  it("records a cumulative burst counter on the layer dataset", () => {
    const { layer, root } = mount();
    expect(root.dataset.bursts).toBeUndefined();
    layer.burst();
    expect(root.dataset.bursts).toBe("1");
    layer.burst();
    expect(root.dataset.bursts).toBe("2");
  });

  it("reduced motion yields a glow flash and no flying pieces", () => {
    vi.useFakeTimers();
    const { layer, root } = mount({ reducedMotion: true });
    layer.burst();
    expect(root.pieceNodes()).toHaveLength(0);
    expect(root.glowNodes()).toHaveLength(1);
    expect(String(root.glowNodes()[0]?.style.cssText ?? "")).not.toContain("ms-confetti-fall");
    vi.advanceTimersByTime(CONFETTI_DURATION_MS);
    expect(root.children.filter((c) => c.dataset.confetti)).toHaveLength(0);
  });

  it("honors setReducedMotion for later bursts", () => {
    vi.useFakeTimers();
    const { layer, root } = mount();
    layer.setReducedMotion(true);
    layer.burst();
    expect(root.pieceNodes()).toHaveLength(0);
    expect(root.glowNodes()).toHaveLength(1);
  });

  it("dispose removes the layer and cancels pending cleanup", () => {
    vi.useFakeTimers();
    const { host, layer } = mount();
    layer.burst();
    layer.dispose();
    expect(host.children).toHaveLength(0);
    vi.advanceTimersByTime(CONFETTI_DURATION_MS * 2);
    expect(host.children).toHaveLength(0);
  });
});
