import { beforeAll, describe, expect, it } from "vitest";
import RAPIER from "@dimforge/rapier3d-compat";
import { PHYSICS } from "../domain/physics-config";
import { colliderDescriptors } from "./piece-colliders";
import { MarbleManager } from "./marbles";
import { createPhysicsWorld, initPhysics, stepWorld } from "./world";

const HZ = 60;

function placePiece(
  world: RAPIER.World,
  type: "straight" | "curved" | "funnel" | "goal",
  rotation: 0 | 1 | 2 | 3,
  x: number,
  y: number,
): void {
  for (const d of colliderDescriptors(type, rotation)) {
    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(
        x + 0.5 + d.offset[0],
        d.offset[1],
        y + 0.5 + d.offset[2],
      ),
    );
    world.createCollider(RAPIER.ColliderDesc.cuboid(d.hx, d.hy, d.hz), body);
  }
}

/** Runs one fixed step plus the reap pass, as the Game ticker does. */
function tick(world: RAPIER.World, marbles: MarbleManager): void {
  stepWorld(world);
  marbles.reap();
}

describe("headless simulation invariants (deterministic scripted runs)", () => {
  beforeAll(async () => {
    await initPhysics();
  });

  it("accounts for every marble: collected + rescued + live stays exact, and no live marble escapes below the rescue line", () => {
    const world = createPhysicsWorld();
    const collected: unknown[] = [];
    const marbles = new MarbleManager(world, {
      onCollected: (body) => collected.push(body),
    });
    const spawned = 3;
    marbles.spawnAt(2, PHYSICS.spawnHeight + 1, 2);
    marbles.spawnAt(4, PHYSICS.spawnHeight + 1, 4);
    marbles.spawnAt(6, PHYSICS.spawnHeight + 1, 2);

    for (let step = 0; step < 600; step += 1) {
      tick(world, marbles);
      // Nothing may linger below the rescue line after a reap pass.
      for (const body of marbles.all()) {
        expect(body.translation().y).toBeGreaterThan(-5);
      }
      // Conservation: spawned = collected + rescued + live, always.
      expect(collected.length + marbles.getRescued().length + marbles.count).toBe(spawned);
    }

    marbles.dispose();
    world.free();
  });

  it("a run can never outlive the stall cap: settle fires on time and lingering marbles are reaped", () => {
    const world = createPhysicsWorld();
    const reasons: string[] = [];
    // settleSteps is effectively unreachable, so only the cap can end the run.
    const marbles = new MarbleManager(
      world,
      { onRunSettled: (reason) => reasons.push(reason) },
      { settleSteps: 10_000, stallCapSeconds: 0.5 },
    );
    marbles.spawnAt(4, PHYSICS.spawnHeight, 4);

    const capSteps = Math.round(0.5 * HZ);
    let settledAt = -1;
    for (let step = 0; step < capSteps * 3; step += 1) {
      tick(world, marbles);
      if (reasons.length > 0 && settledAt < 0) {
        settledAt = step;
      }
    }
    expect(reasons).toEqual(["stall"]);
    expect(settledAt).toBeGreaterThanOrEqual(0);
    expect(settledAt).toBeLessThanOrEqual(capSteps + 1);
    // The lingering marble was quietly reaped via the rescued path.
    expect(marbles.count).toBe(0);
    expect(marbles.getRescued()).toHaveLength(1);

    marbles.dispose();
    world.free();
  });

  it("an all-done run settles within a bounded number of steps after the collection", () => {
    const world = createPhysicsWorld();
    const reasons: string[] = [];
    const marbles = new MarbleManager(world, {
      onRunSettled: (reason) => reasons.push(reason),
    });
    // Goal cup at (4,4); the marble starts right above it.
    placePiece(world, "goal", 0, 4, 4);
    marbles.setGoalCells([{ x: 4, z: 4, color: null }]);
    marbles.spawnAt(4.5, PHYSICS.spawnHeight + 0.4, 4.5);

    let collectedAt = -1;
    for (let step = 0; step < 600; step += 1) {
      tick(world, marbles);
      if (marbles.getCollected().length > 0 && collectedAt < 0) {
        collectedAt = step;
      }
      if (reasons.length > 0) {
        break;
      }
    }
    expect(reasons).toEqual(["all-done"]);
    expect(collectedAt).toBeGreaterThanOrEqual(0);
    expect(collectedAt).toBeLessThan(120);

    marbles.dispose();
    world.free();
  });
});
