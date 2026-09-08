import { describe, expect, it } from "vitest";
import { createFixedStepLoop } from "./fixed-step-loop";

describe("createFixedStepLoop", () => {
  it("invokes the step callback once per fixed interval", () => {
    let steps = 0;
    const loop = createFixedStepLoop(1 / 60, () => {
      steps += 1;
    });
    loop.update(1 / 60);
    expect(steps).toBe(1);
  });

  it("accumulates fractional elapsed time across updates", () => {
    let steps = 0;
    const loop = createFixedStepLoop(1 / 60, () => {
      steps += 1;
    });
    // 3 updates of half a step = 1.5 steps total -> 1 whole step, remainder kept
    loop.update(1 / 120);
    expect(steps).toBe(0);
    loop.update(1 / 120);
    expect(steps).toBe(1);
    loop.update(1 / 120);
    expect(steps).toBe(1);
    loop.update(1 / 120);
    expect(steps).toBe(2);
  });

  it("caps catch-up work at maxSubSteps to avoid the spiral of death", () => {
    let steps = 0;
    const loop = createFixedStepLoop(1 / 60, () => {
      steps += 1;
    });
    loop.update(1); // 60 steps worth of time
    expect(steps).toBeLessThanOrEqual(5);
  });

  it("reports the leftover accumulator after an update", () => {
    const loop = createFixedStepLoop(1 / 60, () => {});
    loop.update(1 / 120);
    expect(loop.remaining()).toBeCloseTo(1 / 120);
  });
});
