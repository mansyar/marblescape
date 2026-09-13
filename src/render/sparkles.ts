import * as THREE from "three";

/** Hard cap on particles emitted per sparkle burst (spec: ≤64). */
export const SPARKLE_MAX_PARTICLES_PER_BURST = 64;
/** Lifetime of a burst in seconds (spec: ≤1 s). */
export const SPARKLE_BURST_DURATION = 0.9;
/** Bursts starting within this window of a still-fresh burst coalesce into it. */
export const SPARKLE_COALESCE_WINDOW = 0.15;
/** Number of reusable burst slots per mode (flying / pulse). */
export const SPARKLE_POOL_SIZE = 4;

/** Candy palette + warm white, matching the marble colors. */
const SPARKLE_COLORS = [0xef476f, 0xffd166, 0x06d6a0, 0x118ab2, 0xf8f3e9].map(
  (hex) => new THREE.Color(hex),
);
const GRAVITY = 4.5;

export interface SparkleOptions {
  /** Replace flying particles with a gentle pulse (prefers-reduced-motion). */
  reducedMotion?: boolean;
  /** Particles per burst; clamped to the spec cap. */
  particleCount?: number;
  /** Burst lifetime in seconds. */
  burstDuration?: number;
  /** Rapid-burst coalesce window in seconds. */
  coalesceWindow?: number;
  /** Number of reusable burst slots per mode. */
  poolSize?: number;
}

interface FlyingSlot {
  points: THREE.Points;
  material: THREE.PointsMaterial;
  positions: THREE.BufferAttribute;
  colors: THREE.BufferAttribute;
  velocities: Float32Array;
  /** Particles emitted by the current burst (≤ pool capacity). */
  emitCount: number;
  active: boolean;
  age: number;
}

interface PulseSlot {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  active: boolean;
  age: number;
}

/** Options are caller-supplied: keep particle allocation finite and inside the spec cap. */
function clampParticleCount(requested: number | undefined): number {
  if (requested === undefined || !Number.isFinite(requested)) {
    return SPARKLE_MAX_PARTICLES_PER_BURST;
  }
  return Math.max(0, Math.min(SPARKLE_MAX_PARTICLES_PER_BURST, Math.floor(requested)));
}

/** A burst needs at least one reusable slot; junk pool sizes fall back to the default. */
function clampSlotCount(requested: number | undefined): number {
  if (requested === undefined || !Number.isFinite(requested)) {
    return SPARKLE_POOL_SIZE;
  }
  return Math.max(1, Math.floor(requested));
}

/**
 * Pooled celebration sparkles: short bursts anchored at a world position.
 *
 * All slots are preallocated at construction — emitting and updating never
 * allocates and never grows the scene graph. Rapid collect events coalesce
 * into the freshest slot (inside the coalesce window); beyond that they are
 * bounded by the pool, recycling the oldest slot. Under reduced motion,
 * flying particles are replaced by a single gentle glow pulse.
 */
export class SparkleSystem {
  /** Total bursts requested (including coalesced/recycled ones). */
  private bursts = 0;
  private readonly parent: THREE.Object3D;
  private readonly particleCount: number;
  private readonly burstDuration: number;
  private readonly coalesceWindow: number;
  private readonly flying: FlyingSlot[] = [];
  private readonly pulse: PulseSlot[] = [];
  private readonly owned: THREE.Object3D[] = [];
  private reducedMotion: boolean;
  /** Cap on particles emitted by later bursts (tier budget); pools stay full. */
  private particleBudget: number;
  private lastFlying: FlyingSlot | undefined;
  private lastPulse: PulseSlot | undefined;

  constructor(parent: THREE.Object3D, options: SparkleOptions = {}) {
    this.parent = parent;
    this.particleCount = clampParticleCount(options.particleCount);
    this.burstDuration = options.burstDuration ?? SPARKLE_BURST_DURATION;
    this.coalesceWindow = options.coalesceWindow ?? SPARKLE_COALESCE_WINDOW;
    this.reducedMotion = options.reducedMotion ?? false;
    this.particleBudget = this.particleCount;
    const poolSize = clampSlotCount(options.poolSize);

    for (let i = 0; i < poolSize; i += 1) {
      this.flying.push(this.createFlyingSlot());
    }
    const pulseGeometry = new THREE.SphereGeometry(0.16, 12, 8);
    for (let i = 0; i < poolSize; i += 1) {
      this.pulse.push(this.createPulseSlot(pulseGeometry));
    }
  }

  /** Number of bursts emitted so far (for test/e2e hooks). */
  get totalBurstCount(): number {
    return this.bursts;
  }

  /** Number of bursts currently animating. */
  get activeBurstCount(): number {
    let count = 0;
    for (const slot of this.flying) {
      if (slot.active) {
        count += 1;
      }
    }
    for (const slot of this.pulse) {
      if (slot.active) {
        count += 1;
      }
    }
    return count;
  }

  /** Emit a celebration at a world position (coalesces or recycles as needed). */
  burstAt(position: { x: number; y: number; z: number }): void {
    this.bursts += 1;
    if (this.reducedMotion) {
      this.triggerPulse(position);
    } else {
      this.triggerFlying(position);
    }
  }

  /** Switch between flying particles and the gentle pulse fallback. */
  setReducedMotion(reduced: boolean): void {
    this.reducedMotion = reduced;
  }

  /**
   * Caps how many particles future bursts emit (adaptive quality). Emitting
   * more than the budget is impossible; pools and buffers keep their full
   * capacity, so switching tiers never reallocates.
   */
  setParticleBudget(requested: number): void {
    this.particleBudget =
      requested === undefined || !Number.isFinite(requested)
        ? this.particleCount
        : Math.max(0, Math.min(this.particleCount, Math.floor(requested)));
  }

  /** Advance all active bursts by `dt` seconds. */
  update(dt: number): void {
    if (dt <= 0) {
      return;
    }
    this.updateFlying(dt);
    this.updatePulse(dt);
  }

  /** Remove every pooled object from the parent and release its GPU resources. */
  dispose(): void {
    for (const object of this.owned) {
      this.parent.remove(object);
    }
    for (const slot of this.flying) {
      slot.points.geometry.dispose();
      slot.material.dispose();
    }
    for (const slot of this.pulse) {
      slot.material.dispose();
    }
    if (this.pulse.length > 0) {
      this.pulse[0].mesh.geometry.dispose();
    }
    this.owned.length = 0;
    this.flying.length = 0;
    this.pulse.length = 0;
    this.lastFlying = undefined;
    this.lastPulse = undefined;
  }

  private createFlyingSlot(): FlyingSlot {
    const geometry = new THREE.BufferGeometry();
    const positions = new THREE.BufferAttribute(new Float32Array(this.particleCount * 3), 3);
    const colors = new THREE.BufferAttribute(new Float32Array(this.particleCount * 3), 3);
    geometry.setAttribute("position", positions);
    geometry.setAttribute("color", colors);
    const material = new THREE.PointsMaterial({
      size: 0.09,
      vertexColors: true,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const points = new THREE.Points(geometry, material);
    points.visible = false;
    points.frustumCulled = false;
    points.userData.mode = "flying";
    this.parent.add(points);
    this.owned.push(points);

    const slot: FlyingSlot = {
      points,
      material,
      positions,
      colors,
      velocities: new Float32Array(this.particleCount * 3),
      emitCount: 0,
      active: false,
      age: 0,
    };
    return slot;
  }

  private createPulseSlot(geometry: THREE.SphereGeometry): PulseSlot {
    const material = new THREE.MeshBasicMaterial({
      color: 0xffe066,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.visible = false;
    mesh.userData.mode = "pulse";
    this.parent.add(mesh);
    this.owned.push(mesh);
    return { mesh, material, active: false, age: 0 };
  }

  private triggerFlying(position: { x: number; y: number; z: number }): void {
    const slot =
      this.lastFlying?.active && this.lastFlying.age < this.coalesceWindow
        ? this.lastFlying
        : this.pickFlyingSlot();
    this.lastFlying = slot;

    // BufferAttribute.array is a union type; these two attributes are always Float32Array.
    const positions = slot.positions.array as Float32Array;
    const colors = slot.colors.array as Float32Array;
    const velocities = slot.velocities;
    const emitCount = this.particleBudget;
    slot.emitCount = emitCount;
    slot.points.geometry.setDrawRange(0, emitCount);
    for (let i = 0; i < emitCount; i += 1) {
      const offset = i * 3;
      positions[offset] = 0;
      positions[offset + 1] = 0;
      positions[offset + 2] = 0;
      const angle = Math.random() * Math.PI * 2;
      const horizontal = 0.6 + Math.random() * 0.9;
      velocities[offset] = Math.cos(angle) * horizontal;
      velocities[offset + 1] = 0.5 + Math.random() * 1.0;
      velocities[offset + 2] = Math.sin(angle) * horizontal;
      const color = SPARKLE_COLORS[Math.floor(Math.random() * SPARKLE_COLORS.length)];
      colors[offset] = color.r;
      colors[offset + 1] = color.g;
      colors[offset + 2] = color.b;
    }
    slot.positions.needsUpdate = true;
    slot.colors.needsUpdate = true;
    slot.points.position.set(position.x, position.y, position.z);
    slot.material.opacity = 1;
    slot.age = 0;
    slot.active = true;
    slot.points.visible = true;
  }

  private triggerPulse(position: { x: number; y: number; z: number }): void {
    const slot =
      this.lastPulse?.active && this.lastPulse.age < this.coalesceWindow
        ? this.lastPulse
        : this.pickPulseSlot();
    this.lastPulse = slot;
    slot.mesh.position.set(position.x, position.y, position.z);
    slot.mesh.scale.setScalar(0.6);
    slot.material.opacity = 0.8;
    slot.age = 0;
    slot.active = true;
    slot.mesh.visible = true;
  }

  private pickFlyingSlot(): FlyingSlot {
    let oldest: FlyingSlot | undefined;
    for (const slot of this.flying) {
      if (!slot.active) {
        return slot;
      }
      if (!oldest || slot.age > oldest.age) {
        oldest = slot;
      }
    }
    if (oldest) {
      return oldest;
    }
    throw new Error("SparkleSystem has no flying slots");
  }

  private pickPulseSlot(): PulseSlot {
    let oldest: PulseSlot | undefined;
    for (const slot of this.pulse) {
      if (!slot.active) {
        return slot;
      }
      if (!oldest || slot.age > oldest.age) {
        oldest = slot;
      }
    }
    if (oldest) {
      return oldest;
    }
    throw new Error("SparkleSystem has no pulse slots");
  }

  private updateFlying(dt: number): void {
    for (const slot of this.flying) {
      if (!slot.active) {
        continue;
      }
      slot.age += dt;
      const t = slot.age / this.burstDuration;
      if (t >= 1) {
        slot.active = false;
        slot.points.visible = false;
        slot.material.opacity = 0;
        continue;
      }
      // Same Float32Array attributes as the emit path.
      const positions = slot.positions.array as Float32Array;
      const velocities = slot.velocities;
      for (let i = 0; i < slot.emitCount; i += 1) {
        const offset = i * 3;
        velocities[offset + 1] -= GRAVITY * dt;
        positions[offset] += velocities[offset] * dt;
        positions[offset + 1] += velocities[offset + 1] * dt;
        positions[offset + 2] += velocities[offset + 2] * dt;
      }
      slot.positions.needsUpdate = true;
      slot.material.opacity = 1 - t;
    }
  }

  private updatePulse(dt: number): void {
    for (const slot of this.pulse) {
      if (!slot.active) {
        continue;
      }
      slot.age += dt;
      const t = slot.age / this.burstDuration;
      if (t >= 1) {
        slot.active = false;
        slot.mesh.visible = false;
        slot.material.opacity = 0;
        continue;
      }
      slot.mesh.scale.setScalar(0.6 + 0.9 * t);
      slot.material.opacity = 0.8 * (1 - t);
    }
  }
}
