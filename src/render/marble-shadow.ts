import * as THREE from "three";

/** Where shadow quads rest: just above the y=0 board surface. */
export const SHADOW_SURFACE_Y = 0.02;

/** Height (world units above the surface) at which the blob has fully faded. */
export const SHADOW_FADE_HEIGHT = 2.4;

/** Quad diameter at rest and at the fade height (monotonic growth). */
export const SHADOW_BASE_SCALE = 0.9;
export const SHADOW_MAX_SCALE = 1.9;

/** Blob opacity at rest; falls to zero by SHADOW_FADE_HEIGHT. */
export const SHADOW_BASE_OPACITY = 0.5;

/** Faded quads skip the draw call entirely ("no-op above max height"). */
const MIN_VISIBLE_OPACITY = 0.001;

const TEXTURE_SIZE = 64;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/** Blob scale for a marble center height above the board surface. */
export function shadowScaleForHeight(height: number): number {
  const t = clamp01(height / SHADOW_FADE_HEIGHT);
  return SHADOW_BASE_SCALE + (SHADOW_MAX_SCALE - SHADOW_BASE_SCALE) * t;
}

/** Blob opacity for a marble center height; 0 (no-op) at/above the fade height. */
export function shadowOpacityForHeight(height: number): number {
  return SHADOW_BASE_OPACITY * (1 - clamp01(height / SHADOW_FADE_HEIGHT));
}

/** Soft radial alpha blob generated in code — no assets (spec FR3). */
function createBlobTexture(): THREE.DataTexture {
  const data = new Uint8Array(TEXTURE_SIZE * TEXTURE_SIZE * 4);
  const center = (TEXTURE_SIZE - 1) / 2;
  for (let y = 0; y < TEXTURE_SIZE; y += 1) {
    for (let x = 0; x < TEXTURE_SIZE; x += 1) {
      const dx = (x - center) / center;
      const dy = (y - center) / center;
      const t = 1 - clamp01(Math.hypot(dx, dy));
      const alpha = t * t * (3 - 2 * t); // smoothstep falloff
      const i = (y * TEXTURE_SIZE + x) * 4;
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
      data[i + 3] = Math.round(255 * alpha);
    }
  }
  const texture = new THREE.DataTexture(data, TEXTURE_SIZE, TEXTURE_SIZE);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Soft contact shadows for live marbles (spec FR3): one pooled quad per
 * marble, tucked just above the board surface. Scale grows and opacity fades
 * with the marble's height, so marbles feel grounded — no shadow maps.
 */
export class MarbleShadows {
  private readonly scene: THREE.Scene;
  private readonly geometry = new THREE.PlaneGeometry(1, 1);
  private readonly texture = createBlobTexture();
  private readonly shadows = new Map<THREE.Object3D, THREE.Mesh>();
  private readonly pool: THREE.Mesh[] = [];
  /** Tier gate: off hides every quad and skips the per-frame update path. */
  private enabled = true;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  /** Quads currently drawn (one per live marble). */
  get activeCount(): number {
    return this.shadows.size;
  }

  /** Starts grounding a marble mesh; the quad follows it until detached. */
  attach(marble: THREE.Object3D): void {
    if (this.shadows.has(marble)) {
      return;
    }
    const quad = this.pool.pop() ?? this.createQuad();
    this.shadows.set(marble, quad);
    this.scene.add(quad);
    this.place(quad, marble);
  }

  /** Collect / rescue / recycle: returns the quad to the pool immediately. */
  detach(marble: THREE.Object3D): void {
    const quad = this.shadows.get(marble);
    if (!quad) {
      return;
    }
    this.shadows.delete(marble);
    this.scene.remove(quad);
    quad.visible = false;
    this.pool.push(quad);
  }

  /** Grounds every attached quad to its marble; call once per frame. */
  update(): void {
    if (!this.enabled) {
      return;
    }
    for (const [marble, quad] of this.shadows) {
      this.place(quad, marble);
    }
  }

  /** Adaptive quality tier gate (spec FR2): off = no shadow draws at all. */
  setEnabled(on: boolean): void {
    this.enabled = on;
    if (on) {
      this.update();
      return;
    }
    for (const quad of this.shadows.values()) {
      quad.visible = false;
    }
  }

  /** Removes every quad and frees the shared resources. */
  dispose(): void {
    for (const quad of this.shadows.values()) {
      this.scene.remove(quad);
      (quad.material as THREE.MeshBasicMaterial).dispose();
    }
    this.shadows.clear();
    for (const quad of this.pool) {
      (quad.material as THREE.MeshBasicMaterial).dispose();
    }
    this.pool.length = 0;
    this.geometry.dispose();
    this.texture.dispose();
  }

  private createQuad(): THREE.Mesh {
    const quad = new THREE.Mesh(
      this.geometry,
      new THREE.MeshBasicMaterial({
        map: this.texture,
        color: 0x000000,
        transparent: true,
        opacity: SHADOW_BASE_OPACITY,
        depthWrite: false,
      }),
    );
    quad.rotation.x = -Math.PI / 2;
    quad.position.y = SHADOW_SURFACE_Y;
    quad.renderOrder = 1;
    quad.visible = false;
    return quad;
  }

  private place(quad: THREE.Mesh, marble: THREE.Object3D): void {
    const height = marble.position.y;
    const scale = shadowScaleForHeight(height);
    const opacity = shadowOpacityForHeight(height);
    quad.position.set(marble.position.x, SHADOW_SURFACE_Y, marble.position.z);
    quad.scale.set(scale, scale, 1);
    (quad.material as THREE.MeshBasicMaterial).opacity = opacity;
    quad.visible = this.enabled && opacity > MIN_VISIBLE_OPACITY;
  }
}
