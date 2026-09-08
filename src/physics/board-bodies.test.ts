import { beforeAll, describe, expect, it } from "vitest";
import { BOARD_COLS, BOARD_ROWS } from "../render/framing";
import { PHYSICS } from "../domain/physics-config";
import { MarbleManager } from "./marbles";
import { buildBoardBodies, syncPieceBodies, type PieceBodyEntry } from "./board-bodies";
import { createPhysicsWorld, initPhysics, stepWorld, type World } from "./world";

function countFixedBodies(world: World): number {
  let n = 0;
  for (let i = 0; i < world.bodies.len(); i += 1) {
    if (world.bodies.get(i)?.isFixed()) {
      n += 1;
    }
  }
  return n;
}

describe("buildBoardBodies", () => {
  beforeAll(async () => {
    await initPhysics();
  });

  it("contains a marble rolling across an empty board", () => {
    const world = createPhysicsWorld();
    buildBoardBodies(world);
    const marbles = new MarbleManager(world);
    // Fast diagonal launch toward the north-west corner
    const body = marbles.spawnAt(1, 1, 1);
    body.setLinvel({ x: -6, y: 0, z: -6 }, true);

    for (let i = 0; i < 300; i += 1) {
      stepWorld(world);
      marbles.reap();
    }
    expect(marbles.getRescued()).toHaveLength(0);
    const t = body.translation();
    expect(t.x).toBeGreaterThanOrEqual(-0.1);
    expect(t.x).toBeLessThanOrEqual(BOARD_COLS + 0.1);
    expect(t.z).toBeGreaterThanOrEqual(-0.1);
    expect(t.z).toBeLessThanOrEqual(BOARD_ROWS + 0.1);
    marbles.dispose();
    world.free();
  });
});

describe("syncPieceBodies", () => {
  beforeAll(async () => {
    await initPhysics();
  });

  it("creates and removes fixed bodies as pieces come and go", () => {
    const world = createPhysicsWorld();
    const bodies = new Map<string, PieceBodyEntry>();
    const before = countFixedBodies(world);

    const next = syncPieceBodies(world, bodies, [
      { id: "p1", type: "straight", rotation: 0 as const, x: 2, y: 3 },
      { id: "p2", type: "goal", rotation: 0 as const, x: 4, y: 4 },
    ]);
    expect(next.size).toBe(2);
    expect(countFixedBodies(world)).toBeGreaterThan(before);

    syncPieceBodies(world, next, []);
    expect(countFixedBodies(world)).toBe(before);
    world.free();
  });

  it("is idempotent for an unchanged board", () => {
    const world = createPhysicsWorld();
    const pieces = [{ id: "p1", type: "curved" as const, rotation: 1 as const, x: 1, y: 1 }];
    const first = syncPieceBodies(world, new Map(), pieces);
    const count = countFixedBodies(world);
    const second = syncPieceBodies(world, first, pieces);
    expect(countFixedBodies(world)).toBe(count);
    expect(second).toBe(first);
    world.free();
  });

  it("rebuilds bodies when a piece changes rotation", () => {
    const world = createPhysicsWorld();
    const bodies = syncPieceBodies(world, new Map(), [
      { id: "p1", type: "straight", rotation: 0 as const, x: 0, y: 0 },
    ]);
    const before = countFixedBodies(world);
    syncPieceBodies(world, bodies, [
      { id: "p1", type: "straight", rotation: 1 as const, x: 0, y: 0 },
    ]);
    expect(countFixedBodies(world)).toBe(before); // removed then recreated
    world.free();
  });

  it("respects the guard wall height from physics config", () => {
    const world = createPhysicsWorld();
    // Place a marble at the east edge; it should be stopped by the wall,
    // whose top (wallHeight) exceeds the marble's bounce apex.
    buildBoardBodies(world);
    const marbles = new MarbleManager(world);
    const body = marbles.spawnAt(BOARD_COLS - 0.6, PHYSICS.wallHeight, BOARD_ROWS / 2);
    body.setLinvel({ x: 8, y: 0, z: 0 }, true);
    for (let i = 0; i < 120; i += 1) {
      stepWorld(world);
      marbles.reap();
    }
    expect(body.translation().x).toBeLessThan(BOARD_COLS + PHYSICS.marbleRadius);
    marbles.dispose();
    world.free();
  });
});
