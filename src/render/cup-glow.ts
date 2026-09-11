import type * as THREE from "three";

/** Baseline glow of a compatible cup waiting for its marble. */
export const GLOW_BASE = 0.35;
/** Soft pulse rate (radians per second) of that waiting glow. */
export const GLOW_PULSE_RATE = 2.4;
/** Distance in tiles at which a matching marble starts brightening a cup. */
export const GLOW_APPROACH_TILES = 2;
/** Emissive multiplier at full glow, gentle enough to keep the candy tint. */
export const GLOW_EMISSIVE_SCALE = 0.4;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function pulseFactor(elapsed: number, reducedMotion: boolean): number {
  if (reducedMotion) {
    return 1;
  }
  return 0.7 + 0.15 * (1 + Math.sin(elapsed * GLOW_PULSE_RATE));
}

/**
 * Glow intensity in [0, 1] for one cup. Compatible cups pulse a soft baseline
 * (anticipating the waiting marble) and brighten as a matching marble nears,
 * peaking as it drops in. Incompatible cups stay dark; reduced motion keeps
 * every state steady.
 */
export function glowIntensityFor(
  compatible: boolean,
  distanceTiles: number | null,
  elapsed: number,
  reducedMotion: boolean,
): number {
  if (!compatible) {
    return 0;
  }
  const pulse = pulseFactor(elapsed, reducedMotion);
  if (distanceTiles === null || distanceTiles >= GLOW_APPROACH_TILES) {
    return GLOW_BASE * pulse;
  }
  const k = clamp01(1 - distanceTiles / GLOW_APPROACH_TILES);
  const ramp = k * k * (3 - 2 * k);
  return pulse * (GLOW_BASE + (1 - GLOW_BASE) * ramp);
}

interface GlowEntry {
  materials: THREE.MeshStandardMaterial[];
}

/**
 * Applies per-cup glow by writing the emissive channel on each cup's own
 * materials. Materials are cloned once per mesh (like cup tints) so a shared
 * template can never light up; intensities are written straight per frame.
 */
export class CupGlow {
  private readonly entries = new Map<THREE.Object3D, GlowEntry>();

  /** Lights a cup to `amount` in [0, 1]; caches its local materials first. */
  apply(mesh: THREE.Object3D, amount: number): void {
    const entry = this.ensure(mesh);
    for (const material of entry.materials) {
      if (amount <= 0) {
        material.emissive.setScalar(0);
      } else {
        material.emissive.copy(material.color).multiplyScalar(amount * GLOW_EMISSIVE_SCALE);
      }
    }
  }

  /** Resets and forgets every cup mesh not present in `cups` this frame. */
  retain(cups: Iterable<THREE.Object3D>): void {
    const keep = new Set(cups);
    for (const mesh of [...this.entries.keys()]) {
      if (!keep.has(mesh)) {
        this.detach(mesh);
      }
    }
  }

  /** Resets one cup and drops its cached materials. */
  detach(mesh: THREE.Object3D): void {
    const entry = this.entries.get(mesh);
    if (!entry) {
      return;
    }
    for (const material of entry.materials) {
      material.emissive.setScalar(0);
    }
    this.entries.delete(mesh);
  }

  /** Resets every cup (teardown / tests). */
  dispose(): void {
    for (const mesh of [...this.entries.keys()]) {
      this.detach(mesh);
    }
  }

  private ensure(mesh: THREE.Object3D): GlowEntry {
    const existing = this.entries.get(mesh);
    if (existing) {
      return existing;
    }
    const materials: THREE.MeshStandardMaterial[] = [];
    mesh.traverse((node) => {
      const part = node as THREE.Mesh;
      if (!part.isMesh) {
        return;
      }
      let material = part.material as THREE.MeshStandardMaterial;
      if (material.userData.msCupGlow !== true) {
        if (material.userData.msCupTint !== true) {
          material = material.clone();
          part.material = material;
        }
        material.userData.msCupGlow = true;
      }
      materials.push(material);
    });
    const entry: GlowEntry = { materials };
    this.entries.set(mesh, entry);
    return entry;
  }
}
