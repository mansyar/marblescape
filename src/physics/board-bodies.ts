import RAPIER from "@dimforge/rapier3d-compat";
import { BOARD_COLS, BOARD_ROWS } from "../render/framing";
import { PHYSICS } from "../domain/physics-config";
import { colliderDescriptors } from "./piece-colliders";
import type { PieceType, Rotation } from "../domain/pieces";
import { cellToWorld } from "../render/piece-view";
import type { World } from "./world";

const WALL_T = 0.25;
const FLOOR_H = 0.15;

/** Creates the 4 perimeter guard walls as fixed physics bodies. */
export function buildBoardBodies(world: World): void {
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
  // Floor slab: top surface exactly at y=0.
  const floor = world.createRigidBody(
    RAPIER.RigidBodyDesc.fixed().setTranslation(BOARD_COLS / 2, -FLOOR_H, BOARD_ROWS / 2),
  );
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(BOARD_COLS / 2, FLOOR_H, BOARD_ROWS / 2).setRestitution(
      PHYSICS.boardRestitution,
    ),
    floor,
  );
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
    const yaw = (-piece.rotation * Math.PI) / 2;
    const bodies = colliderDescriptors(piece.type, piece.rotation).map((d) => {
      // Rotate the local offset by yaw (90° steps) around the cell center.
      const cos = Math.round(Math.cos(yaw));
      const sin = Math.round(Math.sin(yaw));
      const ox = d.offset[0] * cos + d.offset[2] * sin;
      const oz = -d.offset[0] * sin + d.offset[2] * cos;
      const body = world.createRigidBody(
        RAPIER.RigidBodyDesc.fixed().setTranslation(wx + ox, d.offset[1], wz + oz),
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
