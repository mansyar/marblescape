/**
 * Classic accumulator loop: consumes variable frame elapsed time and emits
 * fixed-size physics steps, capping catch-up work so a slow frame can never
 * trigger an unbounded number of simulation steps (spiral of death).
 */
export interface FixedStepLoop {
  update(elapsed: number): void;
  /** Unconsumed time carried over to the next frame. */
  remaining(): number;
}

export function createFixedStepLoop(
  fixedTimeStep: number,
  step: (dt: number) => void,
  maxSubSteps = 5,
): FixedStepLoop {
  let accumulator = 0;

  return {
    update(elapsed: number) {
      accumulator += elapsed;
      let subSteps = 0;
      while (accumulator >= fixedTimeStep && subSteps < maxSubSteps) {
        step(fixedTimeStep);
        accumulator -= fixedTimeStep;
        subSteps += 1;
      }
      // If we hit the cap, discard the excess backlog instead of accumulating
      // an ever-growing debt.
      if (subSteps === maxSubSteps && accumulator > fixedTimeStep) {
        accumulator = 0;
      }
    },
    remaining() {
      return accumulator;
    },
  };
}
