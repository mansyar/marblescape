import { beforeAll, describe, expect, it, vi } from "vitest";
import RAPIER from "@dimforge/rapier3d-compat";
import { MARBLE_COLORS, type MarbleColor } from "../domain/colors";
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
    marbles.setGoalCells([{ x: 4, z: 4, color: null }]);
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
    expect(marbles.getRescued()).toHaveLength(1);
    marbles.dispose();
    world.free();
  });

  it("fires onRunSettled with 'all-done' once the marble is collected", () => {
    const world = createPhysicsWorld();
    placePiece(world, "goal", 0, 4, 4);
    const onRunSettled = vi.fn();
    const marbles = new MarbleManager(world, { onRunSettled });
    marbles.setGoalCells([{ x: 4, z: 4, color: null }]);
    marbles.spawnDrop(4, 4);
    for (let i = 0; i < 240 && onRunSettled.mock.calls.length === 0; i += 1) {
      stepWorld(world);
      marbles.reap();
    }
    expect(onRunSettled).toHaveBeenCalledTimes(1);
    expect(onRunSettled).toHaveBeenCalledWith("all-done");
    // Extra reaps after the run settled must never fire again.
    marbles.reap();
    marbles.reap();
    expect(onRunSettled).toHaveBeenCalledTimes(1);
    marbles.dispose();
    world.free();
  });

  it("reaps stalled marbles via the rescued path after the stall cap", () => {
    const world = createPhysicsWorld();
    // Cap reached after 3 steps; at-rest unreachable within the test window.
    const marbles = new MarbleManager(world, {}, { settleSteps: 10_000, stallCapSeconds: 0.05 });
    marbles.spawnAt(4, PHYSICS.spawnHeight, 4); // plain board: no goal, no edges
    for (let i = 0; i < 20; i += 1) {
      stepWorld(world);
      marbles.reap();
    }
    expect(marbles.getRescued()).toHaveLength(1);
    expect(marbles.count).toBe(0);
    marbles.dispose();
    world.free();
  });

  it("fires exactly once per run; a fresh drop starts a new run", () => {
    const world = createPhysicsWorld();
    const onRunSettled = vi.fn();
    // settleSpeed 1000 → any live marble counts as calm immediately.
    const marbles = new MarbleManager(
      world,
      { onRunSettled },
      { settleSteps: 2, settleSpeed: 1000, stallCapSeconds: 1000 },
    );
    marbles.spawnDrop(4, 4);
    marbles.reap();
    marbles.reap();
    expect(onRunSettled).toHaveBeenCalledTimes(1);
    expect(onRunSettled).toHaveBeenCalledWith("at-rest");
    marbles.reap();
    marbles.reap();
    expect(onRunSettled).toHaveBeenCalledTimes(1);
    marbles.spawnDrop(4, 4); // settled → fresh run
    marbles.reap();
    marbles.reap();
    expect(onRunSettled).toHaveBeenCalledTimes(2);
    marbles.dispose();
    world.free();
  });

  it("quietly clears settled leftovers when a fresh run starts", () => {
    const world = createPhysicsWorld();
    const lost: RAPIER.RigidBody[] = [];
    // settleSpeed 1000 → the wandered marble counts as calm right away.
    const marbles = new MarbleManager(
      world,
      { onLost: (body) => lost.push(body) },
      { settleSteps: 2, settleSpeed: 1000, stallCapSeconds: 1000 },
    );
    marbles.spawnDrop(4, 4);
    for (let i = 0; i < 10; i += 1) {
      stepWorld(world);
      marbles.reap();
    }
    expect(marbles.count).toBe(1); // wandered marble still rests on the board

    // The next Play replaces it: gone quietly, no rescue counted.
    marbles.spawnDrop(4, 4);
    expect(lost).toHaveLength(1);
    expect(marbles.getRescued()).toHaveLength(0);
    expect(marbles.count).toBe(1); // only the fresh marble stays live
    marbles.dispose();
    world.free();
  });

  it("spawns with an explicit marble color without consuming the random sequence", () => {
    const world = createPhysicsWorld();
    const marbles = new MarbleManager(world);
    marbles.spawnDrop(3, 3, "mint");
    expect(marbles.colorOf(marbles.all()[0])).toBe("mint");
    marbles.spawnDrop(4, 3);
    expect(marbles.colorOf(marbles.all()[1])).toBe(MARBLE_COLORS[0]);
    marbles.dispose();
    world.free();
  });

  it("collects only matching marbles in colored cups and reports the color", () => {
    const world = createPhysicsWorld();
    placePiece(world, "goal", 0, 4, 4);
    const colors: MarbleColor[] = [];
    const marbles = new MarbleManager(world, {
      onCollected: (_body, color) => colors.push(color),
    });
    marbles.setGoalCells([{ x: 4, z: 4, color: "mint" }]);
    marbles.spawnAt(4.5, 2, 4.5, "mint");
    for (let i = 0; i < 240 && marbles.getCollected().length === 0; i += 1) {
      stepWorld(world);
      marbles.reap();
    }
    expect(marbles.getCollected()).toHaveLength(1);
    expect(colors).toEqual(["mint"]);
    marbles.dispose();
    world.free();
  });

  it("ignores mismatched marbles in colored cups while classic cups catch any color", () => {
    const world = createPhysicsWorld();
    placePiece(world, "goal", 0, 4, 4);
    placePiece(world, "goal", 0, 2, 4);
    const marbles = new MarbleManager(world);
    marbles.setGoalCells([
      { x: 4, z: 4, color: "mint" },
      { x: 2, z: 4, color: null },
    ]);
    // Grape marble aimed at the mint cup: no collection; it falls through
    // the open hole (the lid is a physics-layer concern) and is rescued.
    marbles.spawnAt(4.5, 2, 4.5, "grape");
    for (let i = 0; i < 240; i += 1) {
      stepWorld(world);
      marbles.reap();
    }
    expect(marbles.getCollected()).toHaveLength(0);
    expect(marbles.getRescued()).toHaveLength(1);
    // Grape marble aimed at the classic cup: caught regardless of color.
    marbles.spawnAt(2.5, 2, 4.5, "grape");
    for (let i = 0; i < 240 && marbles.getCollected().length === 0; i += 1) {
      stepWorld(world);
      marbles.reap();
    }
    expect(marbles.getCollected()).toHaveLength(1);
    marbles.dispose();
    world.free();
  });

  it("peeks the next random color without consuming it", () => {
    const world = createPhysicsWorld();
    const marbles = new MarbleManager(world);
    expect(marbles.peekColor()).toBe(MARBLE_COLORS[0]);
    marbles.spawnDrop(4, 4);
    expect(marbles.peekColor()).toBe(MARBLE_COLORS[1]);
    expect(marbles.colorOf(marbles.all()[0])).toBe(MARBLE_COLORS[0]);
    marbles.dispose();
    world.free();
  });
});
