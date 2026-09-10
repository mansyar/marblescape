/**
 * Pure run-settle detection: decides when a marble run is "finished" so the
 * game can play a soft final cue. The detector never gates gameplay — see
 * spec FR3 — and fires its event exactly once per run.
 *
 * A run settles for one of three reasons:
 *  - "all-done": every spawned marble has been collected or rescued
 *  - "at-rest":  every live marble stayed under the settle speed for
 *                `settleSteps` consecutive fixed steps
 *  - "stall":    the run outlived `stallCapSeconds` (a jam can never
 *                outlive the play session)
 */

/** Per-step state of one marble, as observed by the game loop. */
export interface MarbleStepState {
  /** True once the marble has been collected or rescued (no longer live). */
  done: boolean;
  /** Linear speed (velocity magnitude) in world units per second. */
  speed: number;
}

export interface RunSettleOptions {
  /** Consecutive calm fixed steps required before "at-rest". Default 45 (0.75 s at 60 Hz). */
  settleSteps?: number;
  /** Speed below which a marble counts as calm, in world units/sec. Default 0.25. */
  settleSpeed?: number;
  /** Maximum run duration in seconds before "stall". Default 15. */
  stallCapSeconds?: number;
  /** Fixed simulation step length in seconds. Default 1/60. */
  fixedTimeStep?: number;
}

/** Why a run settled; null while the run is still open. */
export type SettleReason = "all-done" | "at-rest" | "stall";

const DEFAULTS = {
  settleSteps: 45,
  settleSpeed: 0.25,
  stallCapSeconds: 15,
  fixedTimeStep: 1 / 60,
} as const;

/**
 * Owns the settle bookkeeping for one run at a time. Feed it once per
 * fixed physics step with the current marble states; it calls `onSettled`
 * exactly once, then stays quiet until `reset()`.
 */
export class RunSettleDetector {
  private readonly settleSteps: number;
  private readonly settleSpeed: number;
  private readonly stallCapSeconds: number;
  private readonly fixedTimeStep: number;
  private readonly onSettled: (reason: SettleReason) => void;

  private settled = false;
  private reason: SettleReason | null = null;
  /** Consecutive all-calm updates since the last non-calm one. */
  private calmSteps = 0;
  /** Fixed steps since the first update of this run. */
  private steps = 0;
  /** Stall cap as a whole number of fixed steps (avoids float drift). */
  private readonly maxSteps: number;

  constructor(options: RunSettleOptions & { onSettled: (reason: SettleReason) => void }) {
    this.settleSteps = options.settleSteps ?? DEFAULTS.settleSteps;
    this.settleSpeed = options.settleSpeed ?? DEFAULTS.settleSpeed;
    this.stallCapSeconds = options.stallCapSeconds ?? DEFAULTS.stallCapSeconds;
    this.fixedTimeStep = options.fixedTimeStep ?? DEFAULTS.fixedTimeStep;
    this.onSettled = options.onSettled;
    this.maxSteps = Math.round(this.stallCapSeconds / this.fixedTimeStep);
  }

  /** True once this run has settled (stays true until reset()). */
  get isSettled(): boolean {
    return this.settled;
  }

  /** Why the run settled, or null while it is still open. */
  get settledReason(): SettleReason | null {
    return this.reason;
  }

  /**
   * Advances the detector by one fixed step. An empty marble list is a
   * no-op: nothing has been spawned, so there is no run to settle.
   */
  update(marbles: readonly MarbleStepState[]): void {
    if (this.settled || marbles.length === 0) {
      return;
    }

    this.steps += 1;

    const live = marbles.filter((m) => !m.done);
    if (live.length === 0) {
      this.finish("all-done");
      return;
    }

    const calm = live.every((m) => m.speed < this.settleSpeed);
    this.calmSteps = calm ? this.calmSteps + 1 : 0;
    if (this.calmSteps >= this.settleSteps) {
      this.finish("at-rest");
      return;
    }

    if (this.steps >= this.maxSteps) {
      this.finish("stall");
    }
  }

  /** Starts a fresh run: clears state so the detector can settle again. */
  reset(): void {
    this.settled = false;
    this.reason = null;
    this.calmSteps = 0;
    this.steps = 0;
  }

  private finish(reason: SettleReason): void {
    this.settled = true;
    this.reason = reason;
    this.onSettled(reason);
  }
}
