import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { QualityStats } from "../render/quality";
import {
  DEBUG_OVERLAY_TESTID,
  createDebugOverlay,
  debugOverlayEnabled,
  formatQualityStats,
} from "./debug-overlay";

// Minimal element stub, matching the convention used by the other UI tests.
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
}

const STATS: QualityStats = {
  tier: 1,
  emaFrameMs: 16.66,
  p95FrameMs: 18.239,
  frameCount: 1234,
  downgrades: 2,
  upgrades: 1,
};

describe("debugOverlayEnabled", () => {
  it("detects ?debug anywhere in the query string", () => {
    expect(debugOverlayEnabled("?debug")).toBe(true);
    expect(debugOverlayEnabled("?debug=1")).toBe(true);
    expect(debugOverlayEnabled("?foo=1&debug&bar=2")).toBe(true);
  });

  it("stays off without the exact flag", () => {
    expect(debugOverlayEnabled("")).toBe(false);
    expect(debugOverlayEnabled("?mode=debug")).toBe(false);
    expect(debugOverlayEnabled("?debugger=x")).toBe(false);
  });
});

describe("formatQualityStats", () => {
  it("renders one deterministic, compact line", () => {
    expect(formatQualityStats(STATS)).toBe(
      "tier 1 · ema 16.7ms · p95 18.2ms · frames 1234 · down 2 up 1",
    );
  });
});

describe("createDebugOverlay", () => {
  let originalDocument: unknown;

  beforeEach(() => {
    originalDocument = (globalThis as { document?: unknown }).document;
    (globalThis as { document?: unknown }).document = {
      createElement: () => new FakeElement(),
    };
  });

  afterEach(() => {
    (globalThis as { document?: unknown }).document = originalDocument;
  });

  it("mounts a pointer-transparent readout and renders stats on update", () => {
    const host = new FakeElement();
    const overlay = createDebugOverlay(host as unknown as HTMLElement);
    const el = overlay.el as unknown as FakeElement;

    expect(host.children).toHaveLength(1);
    expect(el.dataset.testid).toBe(DEBUG_OVERLAY_TESTID);
    expect(String(el.style.cssText)).toContain("pointer-events:none");
    expect(el.textContent).toBe("");

    overlay.update(STATS);
    expect(el.textContent).toBe(formatQualityStats(STATS));
  });

  it("dispose removes the overlay", () => {
    const host = new FakeElement();
    const overlay = createDebugOverlay(host as unknown as HTMLElement);
    overlay.dispose();
    expect(host.children).toHaveLength(0);
  });
});
