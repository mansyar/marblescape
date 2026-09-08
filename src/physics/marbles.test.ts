import { beforeAll, describe, expect, it } from "vitest";
import RAPIER from "@dimforge/rapier3d-compat";
import { PHYSICS } from "../domain/physics-config";
import { colliderDescriptors } from "./piece-colliders";
import { MarbleManager } from "./marbles";
import { createPhysicsWorld, initPhysics, stepWorld } from "./world";

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

describe("MarbleManager", () => {
  beforeAll(async () => {
    await initPhysics();
  });

  it("spawns at most maxMarblesPerDrop marbles per drop", () => {
    const world = createPhysicsWorld();
    const marbles = new MarbleManager(world);
    marbles.spawnDrop(4, 4);
    expect(marbles.count).toBe(PHYSICS.maxMarblesPerDrop);
    marbles.dispose();
    world.free();
  });

  it("marbles fall under gravity when stepped", () => {
    const world = createPhysicsWorld();
    const marbles = new MarbleManager(world);
    marbles.spawnDrop(4, 4);
    const y0 = marbles.all()[0].translation().y;
    for (let i = 0; i < 30; i += 1) {
      stepWorld(world);
    }
    expect(marbles.all()[0].translation().y).toBeLessThan(y0);
    marbles.dispose();
    world.free();
  });

  it("reports a marble as collected when it falls through the goal hole", () => {
    const world = createPhysicsWorld();
    const marbles = new MarbleManager(world);
    // Goal piece at cell (4,4): falling below the board there = collected
    placePiece(world, "goal", 0, 4, 4);
    marbles.setGoalCell(4, 4);
    marbles.spawnDrop(4, 4);
    expect(marbles.getCollected()).toHaveLength(0);

    for (let i = 0; i < 240 && marbles.getCollected().length === 0; i += 1) {
      stepWorld(world);
      marbles.reap();
    }
    expect(marbles.getCollected().length).toBeGreaterThan(0);
    marbles.dispose();
    world.free();
  });

  it("rescues marbles that fall off the board entirely", () => {
    const world = createPhysicsWorld();
    const marbles = new MarbleManager(world);
    // Spawn far outside the board so it misses the goal and falls past y<-5
    marbles.spawnAt(-20, 3, -20);
    for (let i = 0; i < 240 && marbles.getRescued().length === 0; i += 1) {
      stepWorld(world);
      marbles.reap();
    }
    expect(marbles.getRescued().length).toBe(1);
    marbles.dispose();
    world.free();
  });
});
