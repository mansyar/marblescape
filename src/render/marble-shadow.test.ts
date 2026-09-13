import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import {
  MarbleShadows,
  SHADOW_BASE_OPACITY,
  SHADOW_BASE_SCALE,
  SHADOW_FADE_HEIGHT,
  SHADOW_MAX_SCALE,
  SHADOW_SURFACE_Y,
  shadowOpacityForHeight,
  shadowScaleForHeight,
} from "./marble-shadow";

function makeMarble(x = 2.5, y = 0.3, z = 4.5): THREE.Object3D {
  const marble = new THREE.Object3D();
  marble.position.set(x, y, z);
  return marble;
}

describe("shadow height mapping", () => {
  it("grows the blob scale monotonically and clamps at both ends", () => {
    expect(shadowScaleForHeight(0)).toBeCloseTo(SHADOW_BASE_SCALE);
    let previous = Number.NEGATIVE_INFINITY;
    for (let h = 0; h <= SHADOW_FADE_HEIGHT; h += 0.2) {
      const scale = shadowScaleForHeight(h);
      expect(scale).toBeGreaterThanOrEqual(previous);
      previous = scale;
    }
    expect(shadowScaleForHeight(SHADOW_FADE_HEIGHT)).toBeCloseTo(SHADOW_MAX_SCALE);
    expect(shadowScaleForHeight(SHADOW_FADE_HEIGHT + 5)).toBeCloseTo(SHADOW_MAX_SCALE);
    expect(shadowScaleForHeight(-1)).toBeCloseTo(SHADOW_BASE_SCALE);
  });

  it("fades opacity monotonically to zero: a no-op above the max height", () => {
    expect(shadowOpacityForHeight(0)).toBeCloseTo(SHADOW_BASE_OPACITY);
    let previous = Number.POSITIVE_INFINITY;
    for (let h = 0; h <= SHADOW_FADE_HEIGHT; h += 0.2) {
      const opacity = shadowOpacityForHeight(h);
      expect(opacity).toBeLessThanOrEqual(previous);
      previous = opacity;
    }
    expect(shadowOpacityForHeight(SHADOW_FADE_HEIGHT)).toBeCloseTo(0);
    expect(shadowOpacityForHeight(SHADOW_FADE_HEIGHT + 0.001)).toBe(0);
    expect(shadowOpacityForHeight(10)).toBe(0);
    expect(shadowOpacityForHeight(-0.5)).toBeCloseTo(SHADOW_BASE_OPACITY);
  });
});

describe("MarbleShadows lifecycle", () => {
  it("attaches one grounded quad per marble, tracks it, and hides it above the fade height", () => {
    const scene = new THREE.Scene();
    const shadows = new MarbleShadows(scene);
    const marble = makeMarble();

    shadows.attach(marble);
    shadows.attach(marble); // duplicate attach is a no-op
    expect(shadows.activeCount).toBe(1);
    expect(scene.children).toHaveLength(1);

    const quad = scene.children[0] as THREE.Mesh;
    expect(quad.position.x).toBeCloseTo(2.5);
    expect(quad.position.z).toBeCloseTo(4.5);
    expect(quad.position.y).toBeCloseTo(SHADOW_SURFACE_Y);
    expect(quad.scale.x).toBeCloseTo(shadowScaleForHeight(0.3));
    expect((quad.material as THREE.MeshBasicMaterial).opacity).toBeCloseTo(
      shadowOpacityForHeight(0.3),
    );

    marble.position.set(1.5, SHADOW_FADE_HEIGHT, 2.5);
    shadows.update();
    expect(scene.children[0]).toBe(quad); // same quad, just re-positioned
    expect(quad.position.x).toBeCloseTo(1.5);
    expect(quad.position.z).toBeCloseTo(2.5);
    expect(quad.scale.x).toBeCloseTo(shadowScaleForHeight(SHADOW_FADE_HEIGHT));
    expect(quad.visible).toBe(false); // fully faded: no draw above max height
  });

  it("detach returns the quad to the pool and re-attach reuses it (no leak)", () => {
    const scene = new THREE.Scene();
    const shadows = new MarbleShadows(scene);
    const first = makeMarble();
    shadows.attach(first);
    const quad = scene.children[0];

    shadows.detach(first);
    expect(shadows.activeCount).toBe(0);
    expect(scene.children).toHaveLength(0);

    const second = makeMarble(1, 0.3, 1);
    shadows.attach(second);
    expect(scene.children).toHaveLength(1);
    expect(scene.children[0]).toBe(quad); // pooled, not re-created

    shadows.detach(second);
    expect(scene.children).toHaveLength(0);
  });

  it("keeps the scene bounded across repeated attach/detach cycles", () => {
    const scene = new THREE.Scene();
    const shadows = new MarbleShadows(scene);
    const marbles = [makeMarble(), makeMarble(1, 0.3, 1), makeMarble(2, 0.9, 2)];

    for (const marble of marbles) {
      shadows.attach(marble);
    }
    expect(scene.children).toHaveLength(3);
    for (let i = 0; i < 30; i += 1) {
      const marble = marbles[i % marbles.length] as THREE.Object3D;
      shadows.detach(marble);
      expect(scene.children.length).toBeLessThanOrEqual(3);
      shadows.attach(marble);
    }
    expect(shadows.activeCount).toBe(3);
    expect(scene.children).toHaveLength(3);
  });

  it("dispose removes every quad and frees shared resources; empty updates are safe", () => {
    const scene = new THREE.Scene();
    const shadows = new MarbleShadows(scene);
    expect(() => shadows.update()).not.toThrow();
    expect(() => shadows.detach(makeMarble())).not.toThrow();

    const attached = makeMarble();
    const pooled = makeMarble(1, 0.3, 1);
    shadows.attach(attached);
    shadows.attach(pooled);
    const attachedQuad = scene.children[0] as THREE.Mesh;
    const pooledQuad = scene.children[1] as THREE.Mesh;
    shadows.detach(pooled); // returns to the pool, still disposed on dispose()

    const pooledMaterialSpy = vi.spyOn(pooledQuad.material as THREE.MeshBasicMaterial, "dispose");
    const material = attachedQuad.material as THREE.MeshBasicMaterial;
    const map = material.map as THREE.DataTexture;
    const mapSpy = vi.spyOn(map, "dispose");
    const materialSpy = vi.spyOn(material, "dispose");

    shadows.dispose();
    expect(pooledMaterialSpy).toHaveBeenCalledTimes(1);
    expect(mapSpy).toHaveBeenCalledTimes(1);
    expect(materialSpy).toHaveBeenCalledTimes(1);
    expect(shadows.activeCount).toBe(0);
    expect(scene.children).toHaveLength(0);
    expect(() => shadows.update()).not.toThrow();
  });

  it("setEnabled(false) hides attached quads and suspends the update path", () => {
    const scene = new THREE.Scene();
    const shadows = new MarbleShadows(scene);
    const marble = makeMarble();
    shadows.attach(marble);
    const quad = scene.children[0] as THREE.Mesh;
    expect(quad.visible).toBe(true);

    shadows.setEnabled(false);
    expect(quad.visible).toBe(false);

    marble.position.set(0, 0.3, 0);
    shadows.update();
    expect(quad.visible).toBe(false);
    expect(quad.position.x).toBeCloseTo(2.5); // not repositioned while disabled

    shadows.setEnabled(true);
    expect(quad.visible).toBe(true);
    expect(quad.position.x).toBeCloseTo(0); // grounded again on re-enable
  });

  it("attach while disabled stays hidden until re-enabled", () => {
    const scene = new THREE.Scene();
    const shadows = new MarbleShadows(scene);
    shadows.setEnabled(false);
    shadows.attach(makeMarble());
    const quad = scene.children[0] as THREE.Mesh;
    expect(quad.visible).toBe(false);
  });
});
