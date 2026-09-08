import { beforeAll, describe, expect, it } from "vitest";
import RAPIER from "@dimforge/rapier3d-compat";
import { PHYSICS } from "../domain/physics-config";
import { colliderDescriptors } from "./piece-colliders";
import { createPhysicsWorld, initPhysics, stepWorld } from "./world";

describe("colliderDescriptors", () => {
  it("gives a straight piece a floor and two side rails", () => {
    const desc = colliderDescriptors("straight", 0);
    expect(desc).toHaveLength(3);
  });

  it("aligns straight rails along the channel direction for rotation 0", () => {
    const desc = colliderDescriptors("straight", 0);
    // Rails (not the floor) run along z: channel goes north-south
    for (const rail of desc.slice(1)) {
      expect(rail.hz).toBeGreaterThan(rail.hx);
    }
  });

  it("swaps rail orientation for rotation 1 (quarter turn)", () => {
    const desc = colliderDescriptors("straight", 1);
    for (const rail of desc.slice(1)) {
      expect(rail.hx).toBeGreaterThan(rail.hz);
    }
  });

  it("gives a curved piece two rail segments and a floor", () => {
    const desc = colliderDescriptors("curved", 0);
    expect(desc).toHaveLength(3);
  });

  it("gives funnel and goal a simple slab each", () => {
    expect(colliderDescriptors("funnel", 0)).toHaveLength(1);
    expect(colliderDescriptors("goal", 0)).toHaveLength(1);
  });

  it("keeps every collider inside the cell footprint", () => {
    for (const type of ["straight", "curved", "funnel", "goal"] as const) {
      for (const d of colliderDescriptors(type, 0)) {
        expect(d.hx).toBeLessThanOrEqual(0.5);
        expect(d.hz).toBeLessThanOrEqual(0.5);
      }
    }
  });
});

describe("piece collider integration", () => {
  beforeAll(async () => {
    await initPhysics();
  });

  it("contains a marble dropped into a straight channel", async () => {
    const world = createPhysicsWorld();
    // Marble starts above the cell center, inside the channel mouth
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0.5, 2, 0.5));
    world.createCollider(RAPIER.ColliderDesc.ball(PHYSICS.marbleRadius), body);
    // A straight channel at cell (0,0), rotation 0 (runs north-south)
    for (const d of colliderDescriptors("straight", 0)) {
      const body2 = world.createRigidBody(
        RAPIER.RigidBodyDesc.fixed().setTranslation(
          0.5 + d.offset[0],
          d.offset[1],
          0.5 + d.offset[2],
        ),
      );
      world.createCollider(
        RAPIER.ColliderDesc.cuboid(d.hx, d.hy, d.hz).setRestitution(PHYSICS.boardRestitution),
        body2,
      );
    }

    for (let i = 0; i < 240; i += 1) {
      stepWorld(world);
    }
    const p = body.translation();
    expect(p.y).toBeGreaterThan(0); // resting on the channel floor, not through it
    expect(Math.abs(p.x - 0.5)).toBeLessThan(0.45); // stayed between the rails
    world.free();
  });
});
