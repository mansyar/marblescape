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

  it("gives a curved piece a floor, rails and a 45° deflector", () => {
    const desc = colliderDescriptors("curved", 0);
    // Floor + 2 rails + 1 diagonal deflector
    expect(desc).toHaveLength(4);
    const deflector = desc.find((d) => d.yaw !== undefined);
    expect(deflector?.yaw).toBeCloseTo(-Math.PI / 4);
  });

  it("gives the funnel a railed channel with a center drop hole", () => {
    // 2 side rails + 2 floor strips split around the center hole
    const descs = colliderDescriptors("funnel", 0);
    expect(descs).toHaveLength(4);
    // A gap exists along the channel center: no collider covers z=0 at y level
    for (const d of descs) {
      const zMin = d.offset[2] - d.hz;
      const zMax = d.offset[2] + d.hz;
      const coversCenter = zMin <= 0 && zMax >= 0 && d.hx > 0.3;
      expect(coversCenter).toBe(false);
    }
  });

  it("gives the goal a hole ring", () => {
    // 4 border strips forming the ring around the hole
    expect(colliderDescriptors("goal", 0)).toHaveLength(4);
  });

  it("gives the open goal cup a hole ring with a free center", () => {
    const desc = colliderDescriptors("goal", 0, "open");
    expect(desc).toHaveLength(4);
    for (const d of desc) {
      const coversCenter =
        d.offset[0] - d.hx <= 0 &&
        d.offset[0] + d.hx >= 0 &&
        d.offset[2] - d.hz <= 0 &&
        d.offset[2] + d.hz >= 0;
      expect(coversCenter).toBe(false);
    }
  });

  it("gives the closed goal cup a full lid so marbles roll over", () => {
    const desc = colliderDescriptors("goal", 0, "closed");
    const coversCenter = desc.some(
      (d) =>
        d.offset[0] - d.hx <= 0 &&
        d.offset[0] + d.hx >= 0 &&
        d.offset[2] - d.hz <= 0 &&
        d.offset[2] + d.hz >= 0,
    );
    expect(coversCenter).toBe(true);
    for (const d of desc) {
      expect(d.hx).toBeLessThanOrEqual(0.5);
      expect(d.hz).toBeLessThanOrEqual(0.5);
    }
  });

  it("keeps the closed lid flush with the open cup lip (no step for rolling marbles)", () => {
    const open = colliderDescriptors("goal", 0, "open");
    const closed = colliderDescriptors("goal", 0, "closed");
    const openTop = Math.max(...open.map((d) => d.offset[1] + d.hy));
    const closedTop = Math.max(...closed.map((d) => d.offset[1] + d.hy));
    expect(closedTop).toBeCloseTo(openTop);
  });

  it("rotating the funnel turns the channel east-west", () => {
    const descs = colliderDescriptors("funnel", 1);
    // Rails now run along x (long axis hx > hz)
    const rails = descs.filter((d) => d.hx > d.hz);
    expect(rails.length).toBe(2);
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

    // With tilted gravity the marble rolls south through the channel —
    // step only while it is still over this cell.
    let p = body.translation();
    for (let i = 0; i < 240 && p.z < 1.0; i += 1) {
      stepWorld(world);
      p = body.translation();
    }
    expect(p.y).toBeGreaterThan(0); // supported by the channel floor, not through it
    expect(Math.abs(p.x - 0.5)).toBeLessThan(0.45); // stayed between the rails
    world.free();
  });

  it("routes a marble entering the bend from the north out through the east mouth", async () => {
    const world = createPhysicsWorld();
    // Curved piece at cell (2,2): world center (2.5, 2.5), mouths north + east.
    const cx = 2.5;
    const cz = 2.5;
    for (const d of colliderDescriptors("curved", 0)) {
      const yaw = d.yaw ?? 0;
      const fixed = world.createRigidBody(
        RAPIER.RigidBodyDesc.fixed()
          .setTranslation(cx + d.offset[0], d.offset[1], cz + d.offset[2])
          .setRotation({ w: Math.cos(yaw / 2), x: 0, y: Math.sin(yaw / 2), z: 0 }),
      );
      world.createCollider(
        RAPIER.ColliderDesc.cuboid(d.hx, d.hy, d.hz).setRestitution(PHYSICS.boardRestitution),
        fixed,
      );
    }
    // Marble enters at floor level from the north mouth, rolling south.
    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(cx, PHYSICS.marbleRadius, cz - 0.35)
        .setLinvel(0, 0, 3),
    );
    world.createCollider(RAPIER.ColliderDesc.ball(PHYSICS.marbleRadius), body);

    // Exited through the east mouth: past the cell's east edge shortly
    // after deflection (assert then, before it rolls off this test's
    // floorless world).
    let exited = false;
    for (let i = 0; i < 300 && !exited; i += 1) {
      stepWorld(world);
      if (body.translation().x > cx + 0.5) {
        exited = true;
      }
    }
    expect(exited).toBe(true);
    expect(body.translation().y).toBeGreaterThan(-1);
    world.free();
  });

  it("drops a marble through the open cup and holds it on the closed lid", async () => {
    const place = (world: ReturnType<typeof createPhysicsWorld>, lid: "open" | "closed") => {
      for (const d of colliderDescriptors("goal", 0, lid)) {
        const body = world.createRigidBody(
          RAPIER.RigidBodyDesc.fixed().setTranslation(
            2.5 + d.offset[0],
            d.offset[1],
            2.5 + d.offset[2],
          ),
        );
        world.createCollider(RAPIER.ColliderDesc.cuboid(d.hx, d.hy, d.hz), body);
      }
    };
    const drop = (world: ReturnType<typeof createPhysicsWorld>) => {
      const body = world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic().setTranslation(2.5, 2, 2.5),
      );
      world.createCollider(RAPIER.ColliderDesc.ball(PHYSICS.marbleRadius), body);
      return body;
    };

    const openWorld = createPhysicsWorld();
    place(openWorld, "open");
    const through = drop(openWorld);
    for (let i = 0; i < 45; i += 1) {
      stepWorld(openWorld);
    }
    expect(through.translation().y).toBeLessThan(-1); // fell through the hole
    openWorld.free();

    const closedWorld = createPhysicsWorld();
    place(closedWorld, "closed");
    const resting = drop(closedWorld);
    for (let i = 0; i < 45; i += 1) {
      stepWorld(closedWorld);
    }
    const y = resting.translation().y;
    expect(y).toBeGreaterThan(0.2); // supported by the lid, not through it
    expect(y).toBeLessThan(1); // resting on the lid surface
    closedWorld.free();
  });
});
