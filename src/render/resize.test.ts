import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { registerViewportResize } from "./resize";

/** Minimal EventTarget stub so tests stay in the plain node environment. */
class StubTarget {
  private readonly listeners = new Map<string, Set<() => void>>();

  addEventListener(type: string, listener: () => void): void {
    const set = this.listeners.get(type) ?? new Set();
    set.add(listener);
    this.listeners.set(type, set);
  }

  removeEventListener(type: string, listener: () => void): void {
    this.listeners.get(type)?.delete(listener);
  }

  emit(type: string): void {
    for (const listener of this.listeners.get(type) ?? []) listener();
  }

  listenerCount(type: string): number {
    return this.listeners.get(type)?.size ?? 0;
  }
}

describe("registerViewportResize", () => {
  let target: StubTarget;

  beforeEach(() => {
    vi.useFakeTimers();
    target = new StubTarget();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("fires the callback once after the ~100 ms quiet window", () => {
    const callback = vi.fn();
    registerViewportResize(target, callback);
    target.emit("resize");
    vi.advanceTimersByTime(99);
    expect(callback).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("coalesces a burst of resize events into a single callback", () => {
    const callback = vi.fn();
    registerViewportResize(target, callback);
    for (let i = 0; i < 5; i += 1) target.emit("resize");
    vi.advanceTimersByTime(100);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("resets the quiet window on each new event (trailing edge)", () => {
    const callback = vi.fn();
    registerViewportResize(target, callback);
    target.emit("resize");
    vi.advanceTimersByTime(50);
    target.emit("resize");
    vi.advanceTimersByTime(50);
    target.emit("resize");
    vi.advanceTimersByTime(99);
    expect(callback).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("handles orientationchange-style events through the same debounced path", () => {
    const callback = vi.fn();
    registerViewportResize(target, callback);
    target.emit("orientationchange");
    target.emit("orientationchange");
    vi.advanceTimersByTime(100);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("honors a custom debounce interval", () => {
    const callback = vi.fn();
    registerViewportResize(target, callback, 250);
    target.emit("resize");
    vi.advanceTimersByTime(100);
    expect(callback).not.toHaveBeenCalled();
    vi.advanceTimersByTime(150);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("returns a teardown that removes the listeners and cancels pending work", () => {
    const callback = vi.fn();
    const teardown = registerViewportResize(target, callback);
    target.emit("resize");
    teardown();
    expect(target.listenerCount("resize")).toBe(0);
    expect(target.listenerCount("orientationchange")).toBe(0);
    vi.advanceTimersByTime(200);
    expect(callback).not.toHaveBeenCalled();
    target.emit("resize");
    vi.advanceTimersByTime(200);
    expect(callback).not.toHaveBeenCalled();
  });
});
