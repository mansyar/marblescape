import * as THREE from "three";
import { colorHex, type MarbleColor } from "../domain/colors";
import { PHYSICS } from "../domain/physics-config";

/** Name carried by the preview mesh (testid / scene diagnostics). */
export const WAITING_MARBLE_NAME = "waiting-marble";

const BOB_AMPLITUDE = 0.06;
const BOB_SPEED = 2.4;

/** The next marble, hovering at the chute while no marble is in flight. */
export interface WaitingMarble {
  readonly mesh: THREE.Mesh;
  setCell(cellX: number, cellZ: number): void;
  setColor(color: MarbleColor): void;
  setVisible(visible: boolean): void;
  setReducedMotion(reduced: boolean): void;
  isVisible(): boolean;
  currentColor(): MarbleColor;
  update(elapsedSeconds: number): void;
  dispose(): void;
}

/**
 * Cosmetic preview of the marble the next Play will drop: a physics-free
 * sphere at the spawn cell, wearing exactly the color the drop will use.
 * Bobs gently while motion is allowed; perfectly still under reduced motion.
 */
export function createWaitingMarble(scene: THREE.Scene): WaitingMarble {
  const material = new THREE.MeshStandardMaterial({
    color: colorHex("raspberry"),
    roughness: 0.15,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(PHYSICS.marbleRadius, 24, 16), material);
  mesh.name = WAITING_MARBLE_NAME;
  mesh.position.set(0.5, PHYSICS.spawnHeight, 0.5);
  mesh.castShadow = true;
  scene.add(mesh);

  let color: MarbleColor = "raspberry";
  let reduced = false;
  let visible = true;

  return {
    mesh,
    setCell(cellX, cellZ) {
      mesh.position.x = cellX + 0.5;
      mesh.position.z = cellZ + 0.5;
      mesh.position.y = PHYSICS.spawnHeight;
    },
    setColor(next) {
      color = next;
      material.color.set(colorHex(next));
    },
    setVisible(next) {
      visible = next;
      mesh.visible = next;
    },
    setReducedMotion(next) {
      reduced = next;
    },
    isVisible: () => visible,
    currentColor: () => color,
    update(elapsed) {
      mesh.position.y = reduced
        ? PHYSICS.spawnHeight
        : PHYSICS.spawnHeight + Math.sin(elapsed * BOB_SPEED) * BOB_AMPLITUDE;
    },
    dispose() {
      scene.remove(mesh);
      mesh.geometry.dispose();
      material.dispose();
    },
  };
}
