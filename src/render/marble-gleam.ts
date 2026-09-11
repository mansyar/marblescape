import * as THREE from "three";
import { PHYSICS } from "../domain/physics-config";

/** Highlight sprite diameter, as a multiple of the marble radius. */
export const GLEAM_SCALE_FACTOR = 1.6;

/** How far the highlight floats toward the camera, as a fraction of the radius. */
export const GLEAM_OFFSET_FACTOR = 0.55;

/** Additive highlight strength — adds light, never color (spec FR2). */
export const GLEAM_OPACITY = 0.5;

const TEXTURE_SIZE = 32;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/** Soft radial white sparkle generated in code — no assets (spec FR2). */
function createGleamTexture(): THREE.DataTexture {
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
 * Glass catch-light for live marbles (spec FR2): a tiny additive sprite that
 * floats between each marble and the fixed camera, so the marble reads glossy
 * as it tumbles. One shared material + texture; pooled sprites; the per-frame
 * update reuses a scratch vector (no allocations) and never touches the
 * marble's candy color. Static — no reduced-motion branch needed.
 */
export class MarbleGleam {
  private readonly scene: THREE.Scene;
  private readonly texture = createGleamTexture();
  private readonly material = new THREE.SpriteMaterial({
    map: this.texture,
    color: 0xffffff,
    transparent: true,
    opacity: GLEAM_OPACITY,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  private readonly sprites = new Map<THREE.Object3D, THREE.Sprite>();
  private readonly pool: THREE.Sprite[] = [];
  /** Scratch vector, reused every frame (no per-frame allocations). */
  private readonly towardCamera = new THREE.Vector3();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  /** Highlights currently drawn (one per live marble). */
  get activeCount(): number {
    return this.sprites.size;
  }

  /** Starts highlighting a marble mesh; the sprite follows it until detached. */
  attach(marble: THREE.Object3D): void {
    if (this.sprites.has(marble)) {
      return;
    }
    const sprite = this.pool.pop() ?? this.createSprite();
    this.sprites.set(marble, sprite);
    this.scene.add(sprite);
    sprite.position.copy(marble.position);
  }

  /** Collect / rescue / recycle: returns the sprite to the pool immediately. */
  detach(marble: THREE.Object3D): void {
    const sprite = this.sprites.get(marble);
    if (!sprite) {
      return;
    }
    this.sprites.delete(marble);
    this.scene.remove(sprite);
    this.pool.push(sprite);
  }

  /** Floats every highlight just in front of its marble; call once per frame. */
  update(camera: THREE.Camera): void {
    const offset = PHYSICS.marbleRadius * GLEAM_OFFSET_FACTOR;
    for (const [marble, sprite] of this.sprites) {
      this.towardCamera.subVectors(camera.position, marble.position).normalize();
      sprite.position.copy(marble.position).addScaledVector(this.towardCamera, offset);
    }
  }

  /** Removes every sprite and frees the shared resources. */
  dispose(): void {
    for (const sprite of this.sprites.values()) {
      this.scene.remove(sprite);
    }
    this.sprites.clear();
    this.pool.length = 0;
    this.material.dispose();
    this.texture.dispose();
  }

  private createSprite(): THREE.Sprite {
    const sprite = new THREE.Sprite(this.material);
    const size = PHYSICS.marbleRadius * GLEAM_SCALE_FACTOR;
    sprite.scale.set(size, size, 1);
    return sprite;
  }
}
