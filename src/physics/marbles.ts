import RAPIER from "@dimforge/rapier3d-compat";
import {
  RunSettleDetector,
  type MarbleStepState,
  type RunSettleOptions,
  type SettleReason,
} from "../domain/run-settle";
import { MARBLE_COLORS, type MarbleColor } from "../domain/colors";
import { PHYSICS } from "../domain/physics-config";
import type { World } from "./world";

const RESCUE_Y = -5; // below this, a marble has left the play area for good
const COLLECT_Y = -0.5; // below board surface inside the goal hole = collected

export interface MarbleEvents {
  /** Called when a marble falls through an open cup; includes its color. */
  onCollected?: (body: RAPIER.RigidBody, color: MarbleColor) => void;
  /** Called when a marble fell off the board and was rescued. */
  onRescued?: (body: RAPIER.RigidBody) => void;
  /** Called when a settled leftover is quietly replaced by a fresh run. */
  onLost?: (body: RAPIER.RigidBody) => void;
  /** Called when the table cap recycles the oldest live marble (spec FR1). */
  onRecycled?: (body: RAPIER.RigidBody) => void;
  /** Called exactly once per run when it settles (all-done / at-rest / stall). */
  onRunSettled?: (reason: SettleReason) => void;
}

/**
 * Owns all marble bodies: spawning drops, detecting goal collection and
 * rescuing escaped marbles so the sandbox can never leak physics bodies.
 * Also tracks the run-settle lifecycle (spec FR3): a stalled run is capped
 * and lingering marbles are quietly reaped via the rescued path.
 * The table holds at most `PHYSICS.maxMarblesOnTable` live marbles — a drop
 * beyond the cap quietly recycles the oldest (spec FR1).
 */
export class MarbleManager {
  private readonly bodies: RAPIER.RigidBody[] = [];
  private readonly collected: RAPIER.RigidBody[] = [];
  private readonly rescued: RAPIER.RigidBody[] = [];
  private readonly colors = new Map<RAPIER.RigidBody, MarbleColor>();
  private nextColor = 0;
  private goalCells: Array<{ x: number; z: number; color: MarbleColor | null }> = [];
  private readonly world: World;
  private readonly events: MarbleEvents;
  private readonly detector: RunSettleDetector;
  /** Marbles spawned in the current run (for settle bookkeeping). */
  private runSpawned = 0;
  /** Cap-driven recycles this session (distinct from quiet leftover clears). */
  private recycledTotal = 0;

  constructor(world: World, events: MarbleEvents = {}, settleOptions: RunSettleOptions = {}) {
    this.world = world;
    this.events = events;
    this.detector = new RunSettleDetector({
      ...settleOptions,
      onSettled: (reason) => this.events.onRunSettled?.(reason),
    });
  }

  get count(): number {
    return this.bodies.length;
  }

  /** Active (not yet reaped) marble bodies. */
  all(): RAPIER.RigidBody[] {
    return this.bodies;
  }

  has(body: RAPIER.RigidBody): boolean {
    return this.bodies.includes(body);
  }

  getCollected(): RAPIER.RigidBody[] {
    return this.collected;
  }

  getRescued(): RAPIER.RigidBody[] {
    return this.rescued;
  }

  /** Number of marbles recycled by the table cap (spec FR1). */
  get recycledCount(): number {
    return this.recycledTotal;
  }

  /** Sets the cups that collect marbles; a null color collects any marble. */
  setGoalCells(cells: ReadonlyArray<{ x: number; z: number; color: MarbleColor | null }>): void {
    this.goalCells = cells.map((cell) => ({ ...cell }));
  }

  /** Spawns one Play-button drop at the given cell, optionally forcing a color. */
  spawnDrop(cellX: number, cellZ: number, color?: MarbleColor): void {
    // A drop after the previous run settled starts a fresh run; a drop while
    // marbles are still live extends the current run (no reset mid-flight).
    if (this.bodies.length === 0 || this.detector.isSettled) {
      // A fresh run replaces wandered leftovers quietly: they leave the
      // board without counting as rescues (no escapes, no body leak).
      for (const body of this.bodies) {
        this.world.removeRigidBody(body);
        this.colors.delete(body);
        this.events.onLost?.(body);
      }
      this.bodies.length = 0;
      this.detector.reset();
      this.runSpawned = 0;
    }
    for (let i = 0; i < PHYSICS.maxMarblesPerDrop; i += 1) {
      // Tiny scatter so marbles don't stack perfectly and explode apart.
      const jitter = (Math.random() - 0.5) * 0.2;
      // Drop onto the trough CENTER: the north-end position sat 0.12 from
      // the chute's elevated rim, so a jittered spawn could wedge against
      // the end wall and stall (flaky on level runs). Center is clear of
      // both rims; the marble still has the full tile to build speed.
      this.spawnAt(
        cellX + 0.5 + jitter,
        PHYSICS.spawnHeight + i * 0.8,
        cellZ + 0.5 + jitter * 0.8,
        color,
      );
    }
    // The table holds at most maxMarblesOnTable live marbles: beyond the
    // cap the oldest quietly leaves so the newest always drops (spec FR1 —
    // not collected, not rescued, no body leak).
    while (this.bodies.length > PHYSICS.maxMarblesOnTable) {
      this.recycleOldest();
    }
  }

  /** Candy color assigned to a marble (for rendering and cup matching). */
  colorOf(body: RAPIER.RigidBody): MarbleColor {
    return this.colors.get(body) ?? MARBLE_COLORS[0];
  }

  /** Next random candy color WITHOUT consuming the sequence (preview). */
  peekColor(): MarbleColor {
    return MARBLE_COLORS[this.nextColor % MARBLE_COLORS.length];
  }

  spawnAt(x: number, y: number, z: number, color?: MarbleColor): RAPIER.RigidBody {
    this.runSpawned += 1;
    let assigned = color;
    if (assigned === undefined) {
      // Explicit colors (scripted / previewed) don't consume the random
      // sequence, so sandbox drops keep their cycling candy order.
      assigned = this.peekColor();
      this.nextColor += 1;
    }
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(x, y, z)
        .setLinearDamping(PHYSICS.linearDamping)
        .setAngularDamping(PHYSICS.angularDamping)
        .setCcdEnabled(true)
        // Marbles must NEVER sleep: the world is tilted, so a body that
        // settles mid-track and goes to sleep ignores gravity and jams
        // forever (observed: ~25% jam rate in the chute on level runs).
        .setCanSleep(false),
    );
    this.world.createCollider(
      RAPIER.ColliderDesc.ball(PHYSICS.marbleRadius).setRestitution(PHYSICS.marbleRestitution),
      body,
    );
    this.colors.set(body, assigned);
    this.bodies.push(body);
    return body;
  }

  /**
   * Checks every marble against the collection / rescue thresholds, feeds
   * the run-settle detector, and enforces the stall cap. Call once per
   * physics step.
   */
  reap(): void {
    if (this.runSpawned > 0) {
      const states: MarbleStepState[] = [];
      for (const body of this.bodies) {
        const v = body.linvel();
        states.push({ done: false, speed: Math.hypot(v.x, v.y, v.z) });
      }
      // Marbles reaped earlier in this run count as done for the detector.
      const doneCount = this.runSpawned - this.bodies.length;
      for (let i = 0; i < doneCount; i += 1) {
        states.push({ done: true, speed: 0 });
      }
      this.detector.update(states);
    }

    for (let i = this.bodies.length - 1; i >= 0; i -= 1) {
      const body = this.bodies[i];
      const t = body.translation();
      const color = this.colorOf(body);
      const inOpenCup = this.goalCells.some(
        (cup) =>
          Math.abs(t.x - (cup.x + 0.5)) < 0.5 &&
          Math.abs(t.z - (cup.z + 0.5)) < 0.5 &&
          (cup.color === null || cup.color === color),
      );
      if (inOpenCup && t.y < COLLECT_Y) {
        this.bodies.splice(i, 1);
        this.collected.push(body);
        this.events.onCollected?.(body, color);
      } else if (t.y < RESCUE_Y) {
        this.bodies.splice(i, 1);
        this.rescued.push(body);
        this.events.onRescued?.(body);
      }
    }

    // Stall cap reached: quietly reap lingering marbles via the rescued
    // path so a jam can never outlive the play session (spec FR3).
    if (this.detector.settledReason === "stall") {
      for (let i = this.bodies.length - 1; i >= 0; i -= 1) {
        const body = this.bodies[i];
        this.bodies.splice(i, 1);
        this.rescued.push(body);
        this.events.onRescued?.(body);
      }
    }
  }

  /** Quietly removes the oldest live marble (table-cap recycling, spec FR1). */
  private recycleOldest(): void {
    const body = this.bodies.shift();
    if (body === undefined) {
      return;
    }
    this.world.removeRigidBody(body);
    this.colors.delete(body);
    this.recycledTotal += 1;
    this.events.onRecycled?.(body);
  }

  /** Removes all marble bodies (reset button). */
  clear(): void {
    for (const body of this.bodies) {
      this.world.removeRigidBody(body);
    }
    this.bodies.length = 0;
    this.runSpawned = 0;
    this.detector.reset();
  }

  dispose(): void {
    this.clear();
  }
}
