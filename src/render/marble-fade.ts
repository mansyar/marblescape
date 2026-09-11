import type * as THREE from "three";

/** Recycled marbles leave gently: ~150–200 ms shrink + fade (spec FR1). */
export const MARBLE_FADE_SECONDS = 0.18;

/** Scale floor so the shrink reads as a fade, never a pop. */
const MIN_SCALE = 0.01;

interface FadeTween {
  mesh: THREE.Mesh;
  t: number;
}

/**
 * Recycle exit for table-cap overdrops (spec FR1): the marble mesh stays in
 * the scene for a moment and eases out (shrink + fade), then is removed and
 * fully disposed (geometry + material) so recycling never leaks GPU
 * resources. Mirrors the piece pop-tween pattern, extended with opacity.
 */
export class MarbleFader {
  private tweens: FadeTween[] = [];

  /** Fades currently in flight (diagnostics + reduced-motion checks). */
  get activeCount(): number {
    return this.tweens.length;
  }

  /** Starts a gentle shrink+fade; the mesh is disposed when it completes. */
  start(mesh: THREE.Mesh): void {
    const material = mesh.material as THREE.MeshStandardMaterial;
    material.transparent = true;
    material.opacity = 1;
    material.needsUpdate = true;
    this.tweens.push({ mesh, t: 0 });
  }

  /** Advances active fades; call once per frame with the frame delta. */
  update(dt: number): void {
    if (this.tweens.length === 0) {
      return;
    }
    const remaining: FadeTween[] = [];
    for (const tween of this.tweens) {
      tween.t += dt / MARBLE_FADE_SECONDS;
      if (tween.t >= 1) {
        disposeFadeMesh(tween.mesh);
        continue;
      }
      const s = Math.max(1 - tween.t, MIN_SCALE);
      tween.mesh.scale.set(s, s, s);
      (tween.mesh.material as THREE.MeshStandardMaterial).opacity = 1 - tween.t;
      remaining.push(tween);
    }
    this.tweens = remaining;
  }

  /** Immediately finishes every active fade (dispose lifecycle). */
  dispose(): void {
    for (const tween of this.tweens) {
      disposeFadeMesh(tween.mesh);
    }
    this.tweens = [];
  }
}

/** Removes a fading mesh from the scene and disposes its geometry + material. */
export function disposeFadeMesh(mesh: THREE.Mesh): void {
  mesh.parent?.remove(mesh);
  mesh.geometry.dispose();
  const material = mesh.material;
  if (Array.isArray(material)) {
    for (const m of material) {
      m.dispose();
    }
  } else {
    material.dispose();
  }
}
