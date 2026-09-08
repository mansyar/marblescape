import { describe, expect, it } from "vitest";
import { DRAG_THRESHOLD_PX, createGestureTracker, type Gesture } from "./gestures";

describe("createGestureTracker", () => {
  it("reports a tap for a quick press-release without movement", () => {
    const t = createGestureTracker();
    expect(t.down(10, 10, 100)).toBeNull(); // nothing yet
    const g = t.up(12, 11, 180);
    expect(g).toEqual({ type: "tap", x: 10, y: 10 });
  });

  it("reports a tap even for a long press with no movement (kid holding a piece)", () => {
    const t = createGestureTracker();
    t.down(5, 5, 0);
    expect(t.up(5, 5, 2000)).toEqual({ type: "tap", x: 5, y: 5 });
  });

  it("reports a drag once movement exceeds the threshold", () => {
    const t = createGestureTracker();
    t.down(10, 10, 0);
    expect(t.move(30, 10, 50)).toEqual({ type: "drag-start", x: 10, y: 10 });
    expect(t.move(60, 12, 90)).toEqual({ type: "drag-move", x: 60, y: 12 });
  });

  it("stays a tap while movement is under the threshold", () => {
    const t = createGestureTracker();
    t.down(10, 10, 0);
    expect(t.move(10 + DRAG_THRESHOLD_PX - 1, 10, 50)).toBeNull();
    expect(t.up(11, 10, 80)).toEqual({ type: "tap", x: 10, y: 10 });
  });

  it("ends a drag on release", () => {
    const t = createGestureTracker();
    t.down(10, 10, 0);
    t.move(40, 40, 50);
    expect(t.up(45, 42, 90)).toEqual({ type: "drag-end", x: 45, y: 42 });
  });

  it("ignores up/move without a prior down", () => {
    const t = createGestureTracker();
    expect(t.up(5, 5, 10)).toBeNull();
    expect(t.move(6, 6, 20)).toBeNull();
  });

  it("resets between gestures", () => {
    const t = createGestureTracker();
    t.down(0, 0, 0);
    t.up(1, 1, 50);
    t.down(50, 50, 1000);
    expect(t.up(52, 51, 1100)).toEqual({ type: "tap", x: 50, y: 50 });
  });

  it("cancel() aborts the current gesture so the next one starts clean", () => {
    const t = createGestureTracker();
    // Mid-drag: browser fires pointercancel (e.g. scroll takeover).
    t.down(10, 10, 0);
    t.move(40, 10, 50); // drag-start
    expect(t.cancel()).toBeNull();
    // No stray drag-end afterwards.
    expect(t.up(60, 20, 100)).toBeNull();
    // A fresh press produces a clean gesture.
    t.down(100, 100, 500);
    expect(t.up(101, 101, 560)).toEqual({ type: "tap", x: 100, y: 100 });
  });

  it("cancel() with no active press is a harmless no-op", () => {
    const t = createGestureTracker();
    expect(t.cancel()).toBeNull();
  });
});

// Type-level guard: the union covers the interaction vocabulary.
const _check: Gesture = { type: "tap", x: 0, y: 0 };
void _check;
