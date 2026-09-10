import * as THREE from "three";
import { colorHex, type MarbleColor } from "../domain/colors";
import { PHYSICS } from "../domain/physics-config";

/** Name carried by trophy meshes (diagnostics / tests). */
export const TROPHY_NAME = "trophy-marble";

const CUP_MOUTH_HEIGHT = 0.2;
const STACK_RISE = 0.45;
const STACK_WRAP = 3;

/** Collected marbles, resting visibly in the cups they reached. */
export interface TrophyTray {
  /** Rests a marble in the cup at the given cell (repeats stack upward). */
  add(cup: { x: number; z: number }, color: MarbleColor): void;
  /** Removes every trophy (level reset / exit). */
  clear(): void;
  count(): number;
  dispose(): void;
}

/**
 * Non-physics trophy marbles for sorting levels: the collection moment stays
 * visible after the live marble is reaped, so partial progress reads at a
 * glance. Physics-free meshes only — cleared on reset/exit.
 */
export function createTrophyTray(scene: THREE.Scene): TrophyTray {
  const meshes: THREE.Mesh[] = [];
  const stacks = new Map<string, number>();

  const clear = (): void => {
    for (const mesh of meshes) {
      scene.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
    meshes.length = 0;
    stacks.clear();
  };

  return {
    add(cup, color) {
      const key = `${cup.x},${cup.z}`;
      const level = stacks.get(key) ?? 0;
      stacks.set(key, level + 1);
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(PHYSICS.marbleRadius, 16, 12),
        new THREE.MeshStandardMaterial({ color: colorHex(color), roughness: 0.15 }),
      );
      mesh.name = TROPHY_NAME;
      mesh.position.set(
        cup.x + 0.5,
        CUP_MOUTH_HEIGHT + (level % STACK_WRAP) * STACK_RISE,
        cup.z + 0.5,
      );
      mesh.castShadow = true;
      scene.add(mesh);
      meshes.push(mesh);
    },
    clear,
    count: () => meshes.length,
    dispose: clear,
  };
}
