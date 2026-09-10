import { describe, expect, it, vi } from "vitest";
import { RunSettleDetector } from "./run-settle";

/**
 * Tiny options so tests resolve in a handful of updates instead of
 * hundreds of fixed 60 Hz steps.
 */
const small = {
  settleSteps: 3,
  settleSpeed: 0.2,
  // Large enough that no fast-marble test below reaches the cap.
  stallCapSeconds: 100,
  fixedTimeStep: 0.1,
};

describe("RunSettleDetector", () => {
  it("settles exactly once when every marble is done", () => {
    const onSettled = vi.fn();
    const d = new RunSettleDetector({ ...small, onSettled });
    d.update([{ done: true, speed: 0 }]);
    expect(onSettled).toHaveBeenCalledTimes(1);
    expect(d.isSettled).toBe(true);
    expect(d.settledReason).toBe("all-done");
    // Keep updating: the event must never fire a second time.
    d.update([{ done: true, speed: 0 }]);
    d.update([{ done: false, speed: 9 }]);
    expect(onSettled).toHaveBeenCalledTimes(1);
  });

  it("does not settle at-rest while any marble is fast", () => {
    const onSettled = vi.fn();
    const d = new RunSettleDetector({ ...small, onSettled });
    for (let i = 0; i < 50; i += 1) {
      d.update([{ done: false, speed: 5 }]);
    }
    expect(onSettled).not.toHaveBeenCalled();
    expect(d.isSettled).toBe(false);
  });

  it("settles after settleSteps consecutive calm updates", () => {
    const onSettled = vi.fn();
    const d = new RunSettleDetector({ ...small, onSettled });
    const slow = [{ done: false, speed: 0.01 }];
    d.update(slow);
    d.update(slow);
    expect(onSettled).not.toHaveBeenCalled();
    d.update(slow);
    expect(onSettled).toHaveBeenCalledTimes(1);
    expect(d.settledReason).toBe("at-rest");
  });

  it("a fast update resets the calm streak", () => {
    const onSettled = vi.fn();
    const d = new RunSettleDetector({ ...small, onSettled });
    const slow = [{ done: false, speed: 0.01 }];
    const fast = [{ done: false, speed: 4 }];
    d.update(slow);
    d.update(slow);
    d.update(fast); // streak broken
    d.update(slow);
    d.update(slow);
    expect(onSettled).not.toHaveBeenCalled();
    d.update(slow); // third consecutive calm step
    expect(onSettled).toHaveBeenCalledTimes(1);
  });

  it("a done marble no longer holds the run open", () => {
    const onSettled = vi.fn();
    const d = new RunSettleDetector({ ...small, onSettled });
    // One marble collected, the other creeping calmly: run may settle.
    const marbles = [
      { done: true, speed: 0 },
      { done: false, speed: 0.01 },
    ];
    d.update(marbles);
    d.update(marbles);
    d.update(marbles);
    expect(onSettled).toHaveBeenCalledTimes(1);
    expect(d.settledReason).toBe("at-rest");
  });

  it("declares a stall when slow-but-above-threshold motion outlives the cap", () => {
    const onSettled = vi.fn();
    // speed 0.5 > settleSpeed 0.2 → calm streak never completes;
    // stall cap 1s / 0.25s per step → settles on the 4th update.
    const d = new RunSettleDetector({
      ...small,
      stallCapSeconds: 1,
      fixedTimeStep: 0.25,
      onSettled,
    });
    const creeping = [{ done: false, speed: 0.5 }];
    for (let i = 0; i < 3; i += 1) {
      d.update(creeping);
    }
    expect(onSettled).not.toHaveBeenCalled();
    d.update(creeping);
    expect(onSettled).toHaveBeenCalledTimes(1);
    expect(d.settledReason).toBe("stall");
  });

  it("reset() starts a fresh run that can settle again", () => {
    const onSettled = vi.fn();
    const d = new RunSettleDetector({ ...small, onSettled });
    const slow = [{ done: false, speed: 0.01 }];
    d.update(slow);
    d.update(slow);
    d.update(slow);
    expect(onSettled).toHaveBeenCalledTimes(1);
    d.reset();
    expect(d.isSettled).toBe(false);
    d.update(slow);
    d.update(slow);
    expect(onSettled).toHaveBeenCalledTimes(1); // not yet for run 2
    d.update(slow);
    expect(onSettled).toHaveBeenCalledTimes(2);
  });

  it("ignores an empty marble list (nothing spawned yet)", () => {
    const onSettled = vi.fn();
    const d = new RunSettleDetector({ ...small, onSettled });
    for (let i = 0; i < 20; i += 1) {
      d.update([]);
    }
    expect(onSettled).not.toHaveBeenCalled();
    expect(d.isSettled).toBe(false);
  });

  it("default options: calm run settles well within the stall cap", () => {
    const onSettled = vi.fn();
    const d = new RunSettleDetector({ onSettled });
    const slow = [{ done: false, speed: 0.01 }];
    // 60 steps = 1s at 60Hz; default settleSteps is under one second.
    for (let i = 0; i < 60; i += 1) {
      d.update(slow);
    }
    expect(onSettled).toHaveBeenCalledTimes(1);
    expect(d.settledReason).toBe("at-rest");
  });

  it("default options: a creeping marble is declared stalled at ~15s", () => {
    const onSettled = vi.fn();
    const d = new RunSettleDetector({ onSettled });
    const creeping = [{ done: false, speed: 0.5 }];
    const capSteps = Math.round(15 * 60); // 15s cap at 60Hz, exact integer count
    for (let i = 0; i < capSteps - 1; i += 1) {
      d.update(creeping);
    }
    expect(onSettled).not.toHaveBeenCalled();
    d.update(creeping);
    expect(onSettled).toHaveBeenCalledTimes(1);
    expect(d.settledReason).toBe("stall");
  });
});
