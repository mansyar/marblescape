import RAPIER from "@dimforge/rapier3d-compat";
import { BOARD_COLS, BOARD_ROWS } from "../render/framing";
import { PHYSICS } from "../domain/physics-config";
import { colliderDescriptors } from "./piece-colliders";
import type { PieceType, Rotation } from "../domain/pieces";
import { cellToWorld } from "../render/piece-view";
import type { World } from "./world";

const WALL_T = 0.25;
const FLOOR_H = 0.15;

/**
 * Creates the 4 perimeter guard walls plus per-cell floor tiles.
 * Returns the floor bodies — callers MUST keep the list and pass it back
 * to syncFloorBodies, otherwise old tiles are orphaned in the world.
 */
export function buildBoardBodies(
  world: World,
  goalCell?: { x: number; z: number } | null,
): RAPIER.RigidBody[] {
  const h = PHYSICS.wallHeight / 2;
  const walls: Array<[number, number, number, number, number, number]> = [
    // [x, y, z, hx, hy, hz]
    [BOARD_COLS / 2, h, -WALL_T / 2, BOARD_COLS / 2 + WALL_T, h, WALL_T / 2],
    [BOARD_COLS / 2, h, BOARD_ROWS + WALL_T / 2, BOARD_COLS / 2 + WALL_T, h, WALL_T / 2],
    [-WALL_T / 2, h, BOARD_ROWS / 2, WALL_T / 2, h, BOARD_ROWS / 2 + WALL_T],
    [BOARD_COLS + WALL_T / 2, h, BOARD_ROWS / 2, WALL_T / 2, h, BOARD_ROWS / 2 + WALL_T],
  ];
  for (const [x, y, z, hx, hy, hz] of walls) {
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(x, y, z));
    world.createCollider(RAPIER.ColliderDesc.cuboid(hx, hy, hz), body);
  }
  return syncFloorBodies(world, [], goalCell ?? null);
}

/**
 * Rebuilds the floor as one tile per cell (top surface exactly at y=0),
 * removing every body in `existing` first, skipping the goal cell so marbles
 * fall through the hole piece above it. Returns the fresh list of floor
 * bodies for later syncing — callers MUST keep it and pass it back.
 */
export function syncFloorBodies(
  world: World,
  existing: RAPIER.RigidBody[],
  goalCell: { x: number; z: number } | null,
): RAPIER.RigidBody[] {
  for (const body of existing) {
    world.removeRigidBody(body);
  }
  const floors: RAPIER.RigidBody[] = [];
  for (let cy = 0; cy < BOARD_ROWS; cy += 1) {
    for (let cx = 0; cx < BOARD_COLS; cx += 1) {
      if (goalCell && goalCell.x === cx && goalCell.z === cy) {
        continue;
      }
      const body = world.createRigidBody(
        RAPIER.RigidBodyDesc.fixed().setTranslation(cx + 0.5, -FLOOR_H, cy + 0.5),
      );
      world.createCollider(
        RAPIER.ColliderDesc.cuboid(0.5, FLOOR_H, 0.5).setRestitution(PHYSICS.boardRestitution),
        body,
      );
      floors.push(body);
    }
  }
  return floors;
}

export interface PieceBodyEntry {
  bodies: RAPIER.RigidBody[];
  sig: string;
}

/**
 * Keeps static piece collision bodies in sync with board state: bodies are
 * keyed by piece id and rebuilt whenever a piece's type/rotation/cell changes.
 */
export function syncPieceBodies(
  world: World,
  existing: Map<string, PieceBodyEntry>,
  pieces: ReadonlyArray<{ id: string; type: PieceType; rotation: Rotation; x: number; y: number }>,
): Map<string, PieceBodyEntry> {
  const keep = new Set(pieces.map((p) => p.id));
  for (const [id, entry] of existing) {
    if (!keep.has(id)) {
      for (const body of entry.bodies) {
        world.removeRigidBody(body);
      }
      existing.delete(id);
    }
  }

  for (const piece of pieces) {
    const current = existing.get(piece.id);
    const signature = `${piece.type}:${piece.rotation}:${piece.x}:${piece.y}`;
    if (current && current.sig === signature) {
      continue;
    }
    if (current) {
      for (const body of current.bodies) {
        world.removeRigidBody(body);
      }
    }
    const [wx, , wz] = cellToWorld(piece.x, piece.y);
    const bodies = colliderDescriptors(piece.type, piece.rotation).map((d) => {
      // Offsets arrive fully rotated from colliderDescriptors; a yawed
      // descriptor (diagonal deflector) needs its own body quaternion.
      const yaw = d.yaw ?? 0;
      const body = world.createRigidBody(
        RAPIER.RigidBodyDesc.fixed()
          .setTranslation(wx + d.offset[0], d.offset[1], wz + d.offset[2])
          .setRotation({ w: Math.cos(yaw / 2), x: 0, y: Math.sin(yaw / 2), z: 0 }),
      );
      world.createCollider(
        RAPIER.ColliderDesc.cuboid(d.hx, d.hy, d.hz).setRestitution(PHYSICS.boardRestitution),
        body,
      );
      return body;
    });
    existing.set(piece.id, { bodies, sig: signature });
  }
  return existing;
}
