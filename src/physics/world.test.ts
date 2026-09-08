import { beforeAll, describe, expect, it } from "vitest";
import RAPIER from "@dimforge/rapier3d-compat";
import { PHYSICS } from "../domain/physics-config";
import { createPhysicsWorld, stepWorld } from "./world";

beforeAll(async () => {
  await RAPIER.init();
});

describe("createPhysicsWorld", () => {
  it("creates a world with spec gravity pointing down", async () => {
    const world = createPhysicsWorld();
    expect(world.gravity.y).toBe(PHYSICS.gravity[1]);
    expect(world.gravity.y).toBeLessThan(0);
    world.free();
  });

  it("drops a free body under gravity when stepped", async () => {
    const world = createPhysicsWorld();
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 10, 0));
    world.createCollider(
      RAPIER.ColliderDesc.ball(PHYSICS.marbleRadius).setRestitution(PHYSICS.marbleRestitution),
      body,
    );

    const y0 = body.translation().y;
    for (let i = 0; i < 60; i += 1) {
      stepWorld(world);
    }
    expect(body.translation().y).toBeLessThan(y0);
    world.free();
  });
});

describe("stepWorld", () => {
  it("advances the world by the fixed timestep", async () => {
    const world = createPhysicsWorld();
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 5, 0));
    const y0 = body.translation().y;
    stepWorld(world);
    // v = g*t after one fixed step
    const expectedDrop = 0.5 * Math.abs(PHYSICS.gravity[1]) * PHYSICS.fixedTimeStep ** 2;
    expect(y0 - body.translation().y).toBeCloseTo(expectedDrop, 2);
    world.free();
  });
});
