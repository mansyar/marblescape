import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  SPARKLE_BURST_DURATION,
  SPARKLE_COALESCE_WINDOW,
  SPARKLE_MAX_PARTICLES_PER_BURST,
  SPARKLE_POOL_SIZE,
  SparkleSystem,
  type SparkleOptions,
} from "./sparkles";

function makeSystem(options: SparkleOptions = {}) {
  const parent = new THREE.Group();
  const sparkles = new SparkleSystem(parent, options);
  return { parent, sparkles };
}

function visibleByMode(parent: THREE.Object3D, mode: string): THREE.Object3D[] {
  return parent.children.filter((c) => c.visible && c.userData.mode === mode);
}

describe("sparkle budget", () => {
  it("stays within the spec caps (≤64 particles, ≤1 s)", () => {
    expect(SPARKLE_MAX_PARTICLES_PER_BURST).toBeLessThanOrEqual(64);
    expect(SPARKLE_BURST_DURATION).toBeLessThanOrEqual(1);
  });
});

describe("SparkleSystem", () => {
  it("activates one pooled burst with flying particles, anchored at the given position", () => {
    const { parent, sparkles } = makeSystem();
    sparkles.burstAt({ x: 1, y: 0.2, z: 3 });

    expect(sparkles.activeBurstCount).toBe(1);
    const active = visibleByMode(parent, "flying") as THREE.Points[];
    expect(active).toHaveLength(1);
    expect(active[0].position.x).toBeCloseTo(1);
    expect(active[0].position.y).toBeCloseTo(0.2);
    expect(active[0].position.z).toBeCloseTo(3);

    const positions = active[0].geometry.getAttribute("position");
    expect(positions.count).toBeGreaterThan(0);
    expect(positions.count).toBeLessThanOrEqual(SPARKLE_MAX_PARTICLES_PER_BURST);
  });

  it("auto-expires a burst after its duration", () => {
    const { parent, sparkles } = makeSystem();
    sparkles.burstAt({ x: 0, y: 0, z: 0 });

    sparkles.update(SPARKLE_BURST_DURATION * 0.5);
    expect(sparkles.activeBurstCount).toBe(1);

    sparkles.update(SPARKLE_BURST_DURATION * 0.5 + 0.001);
    expect(sparkles.activeBurstCount).toBe(0);
    expect(parent.children.filter((c) => c.visible)).toHaveLength(0);
  });

  it("coalesces a rapid second collect into the active burst", () => {
    const { sparkles } = makeSystem();
    sparkles.burstAt({ x: 0, y: 0, z: 0 });
    sparkles.update(SPARKLE_COALESCE_WINDOW * 0.5);
    sparkles.burstAt({ x: 4, y: 0, z: 4 });

    expect(sparkles.activeBurstCount).toBe(1);
    expect(sparkles.totalBurstCount).toBe(2);
  });

  it("bounds rapid collects to the pool size without growing the scene graph", () => {
    const { parent, sparkles } = makeSystem();
    const childrenBefore = parent.children.length;

    for (let i = 0; i < 10; i += 1) {
      sparkles.burstAt({ x: i, y: 0, z: 0 });
      sparkles.update(SPARKLE_BURST_DURATION * 0.25); // past the coalesce window, still animating
      expect(sparkles.activeBurstCount).toBeLessThanOrEqual(SPARKLE_POOL_SIZE);
    }

    expect(sparkles.totalBurstCount).toBe(10);
    expect(parent.children.length).toBe(childrenBefore);
  });

  it("replaces flying particles with a gentle pulse under reduced motion", () => {
    const { parent, sparkles } = makeSystem({ reducedMotion: true });
    sparkles.burstAt({ x: 0, y: 0, z: 0 });

    expect(sparkles.activeBurstCount).toBe(1);
    expect(visibleByMode(parent, "flying")).toHaveLength(0);
    expect(visibleByMode(parent, "pulse")).toHaveLength(1);

    sparkles.update(SPARKLE_BURST_DURATION + 0.001);
    expect(sparkles.activeBurstCount).toBe(0);
    expect(parent.children.filter((c) => c.visible)).toHaveLength(0);
  });

  it("honors a runtime reduced-motion toggle", () => {
    const { parent, sparkles } = makeSystem();
    sparkles.setReducedMotion(true);
    sparkles.burstAt({ x: 0, y: 0, z: 0 });
    expect(visibleByMode(parent, "flying")).toHaveLength(0);
    expect(visibleByMode(parent, "pulse")).toHaveLength(1);

    sparkles.setReducedMotion(false);
    sparkles.update(SPARKLE_BURST_DURATION + 0.001);
    sparkles.burstAt({ x: 0, y: 0, z: 0 });
    expect(visibleByMode(parent, "flying").length).toBeGreaterThan(0);
  });

  it("clamps a nonsensical particle count instead of throwing", () => {
    const negative = makeSystem({ particleCount: -5 });
    expect(() => negative.sparkles.burstAt({ x: 0, y: 0, z: 0 })).not.toThrow();
    const negativePoints = visibleByMode(negative.parent, "flying")[0] as THREE.Points;
    expect(negativePoints.geometry.getAttribute("position").count).toBe(0);

    const nan = makeSystem({ particleCount: Number.NaN });
    expect(() => nan.sparkles.burstAt({ x: 0, y: 0, z: 0 })).not.toThrow();
    const nanPoints = visibleByMode(nan.parent, "flying")[0] as THREE.Points;
    expect(nanPoints.geometry.getAttribute("position").count).toBe(SPARKLE_MAX_PARTICLES_PER_BURST);
  });

  it("update is safe with no active bursts", () => {
    const { sparkles } = makeSystem();
    expect(() => sparkles.update(0.016)).not.toThrow();
    expect(sparkles.activeBurstCount).toBe(0);
  });

  it("dispose clears the scene graph and deactivates bursts", () => {
    const { parent, sparkles } = makeSystem();
    sparkles.burstAt({ x: 0, y: 0, z: 0 });
    sparkles.dispose();
    expect(parent.children).toHaveLength(0);
    expect(sparkles.activeBurstCount).toBe(0);
  });
});
