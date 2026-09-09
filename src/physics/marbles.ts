import RAPIER from "@dimforge/rapier3d-compat";
import { MARBLE_PALETTE, PHYSICS } from "../domain/physics-config";
import type { World } from "./world";

const RESCUE_Y = -5; // below this, a marble has left the play area for good
const COLLECT_Y = -0.5; // below board surface inside the goal hole = collected

export interface MarbleEvents {
  /** Called when a marble falls through the goal hole. */
  onCollected?: (body: RAPIER.RigidBody) => void;
  /** Called when a marble fell off the board and was rescued. */
  onRescued?: (body: RAPIER.RigidBody) => void;
}

/**
 * Owns all marble bodies: spawning drops, detecting goal collection and
 * rescuing escaped marbles so the sandbox can never leak physics bodies.
 */
export class MarbleManager {
  private readonly bodies: RAPIER.RigidBody[] = [];
  private readonly collected: RAPIER.RigidBody[] = [];
  private readonly rescued: RAPIER.RigidBody[] = [];
  private readonly colors = new Map<RAPIER.RigidBody, string>();
  private nextColor = 0;
  private goalCell: { x: number; z: number } | null = null;
  private readonly world: World;
  private readonly events: MarbleEvents;

  constructor(world: World, events: MarbleEvents = {}) {
    this.world = world;
    this.events = events;
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

  /** Sets the cell whose hole collects marbles (null disables collection). */
  setGoalCell(x: number | null, z?: number): void {
    this.goalCell = x === null || z === undefined ? null : { x, z };
  }

  /** Spawns one Play-button drop at the given cell. */
  spawnDrop(cellX: number, cellZ: number): void {
    for (let i = 0; i < PHYSICS.maxMarblesPerDrop; i += 1) {
      // Tiny scatter so marbles don't stack perfectly and explode apart.
      const jitter = (Math.random() - 0.5) * 0.2;
      // Drop onto the trough CENTER: the north-end position sat 0.12 from
      // the chute's elevated rim, so a jittered spawn could wedge against
      // the end wall and stall (flaky on level runs). Center is clear of
      // both rims; the marble still has the full tile to build speed.
      this.spawnAt(cellX + 0.5 + jitter, PHYSICS.spawnHeight + i * 0.8, cellZ + 0.5 + jitter * 0.8);
    }
  }

  /** Candy color assigned to a marble (for rendering). */
  colorOf(body: RAPIER.RigidBody): string {
    return this.colors.get(body) ?? MARBLE_PALETTE[0];
  }

  spawnAt(x: number, y: number, z: number): RAPIER.RigidBody {
    const color = MARBLE_PALETTE[this.nextColor % MARBLE_PALETTE.length];
    this.nextColor += 1;
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
    this.colors.set(body, color);
    this.bodies.push(body);
    return body;
  }

  /**
   * Checks every marble against the collection / rescue thresholds and
   * removes those that crossed them. Call once per physics step.
   */
  reap(): void {
    for (let i = this.bodies.length - 1; i >= 0; i -= 1) {
      const body = this.bodies[i];
      const t = body.translation();
      const inGoal =
        this.goalCell !== null &&
        Math.abs(t.x - (this.goalCell.x + 0.5)) < 0.5 &&
        Math.abs(t.z - (this.goalCell.z + 0.5)) < 0.5;
      if (inGoal && t.y < COLLECT_Y) {
        this.bodies.splice(i, 1);
        this.collected.push(body);
        this.events.onCollected?.(body);
      } else if (t.y < RESCUE_Y) {
        this.bodies.splice(i, 1);
        this.rescued.push(body);
        this.events.onRescued?.(body);
      }
    }
  }

  /** Removes all marble bodies (reset button). */
  clear(): void {
    for (const body of this.bodies) {
      this.world.removeRigidBody(body);
    }
    this.bodies.length = 0;
  }

  dispose(): void {
    this.clear();
  }
}
