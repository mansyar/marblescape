import * as THREE from "three";
import { describe, expect, it } from "vitest";
import {
  CupGlow,
  GLOW_APPROACH_TILES,
  GLOW_BASE,
  GLOW_EMISSIVE_SCALE,
  glowIntensityFor,
} from "./cup-glow";

function cupWith(material: THREE.MeshStandardMaterial): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
  return mesh;
}

describe("glow intensity mapping", () => {
  it("stays dark for incompatible cups", () => {
    for (const distance of [null, 0, 0.5, 2, 5]) {
      expect(glowIntensityFor(false, distance, 1.2, false)).toBe(0);
      expect(glowIntensityFor(false, distance, 0, true)).toBe(0);
    }
  });

  it("pulses a soft baseline while compatible with the waiting marble", () => {
    const samples = [0, 0.4, 0.8, 1.2, 1.6, 2].map((t) => glowIntensityFor(true, null, t, false));
    for (const value of samples) {
      expect(value).toBeGreaterThanOrEqual(GLOW_BASE * 0.7 - 1e-9);
      expect(value).toBeLessThanOrEqual(GLOW_BASE + 1e-9);
    }
    expect(new Set(samples).size).toBeGreaterThan(1);
  });

  it("holds a steady glow under reduced motion", () => {
    expect(glowIntensityFor(true, null, 0, true)).toBeCloseTo(GLOW_BASE, 5);
    expect(glowIntensityFor(true, null, 1.4, true)).toBeCloseTo(GLOW_BASE, 5);
    expect(glowIntensityFor(true, 0, 9.9, true)).toBeCloseTo(1, 5);
  });

  it("ramps brightness up as a matching marble approaches", () => {
    const at = (d: number) => glowIntensityFor(true, d, 0, true);
    const distances = [GLOW_APPROACH_TILES + 1, GLOW_APPROACH_TILES, 1.5, 1, 0.5, 0];
    const values = distances.map(at);
    for (let i = 1; i < values.length; i += 1) {
      expect(values[i]).toBeGreaterThanOrEqual(values[i - 1]);
    }
    expect(values[0]).toBeCloseTo(GLOW_BASE, 5);
    expect(values[1]).toBeCloseTo(GLOW_BASE, 5);
    expect(values[values.length - 1]).toBeCloseTo(1, 5);
    expect(at(1)).toBeGreaterThan(GLOW_BASE);
    expect(at(1)).toBeLessThan(1);
  });
});

describe("CupGlow application", () => {
  it("clones materials so a shared cup cannot light up", () => {
    const shared = new THREE.MeshStandardMaterial({ color: 0xff4d8d });
    const lit = cupWith(shared);
    const other = cupWith(shared);
    const glow = new CupGlow();

    glow.apply(lit, 1);

    expect(shared.emissive.getHex()).toBe(0);
    const litMaterial = lit.material as THREE.MeshStandardMaterial;
    expect(litMaterial).not.toBe(shared);
    expect(litMaterial.emissive.r).toBeCloseTo(shared.color.r * GLOW_EMISSIVE_SCALE, 5);
    expect(litMaterial.emissive.g).toBeCloseTo(shared.color.g * GLOW_EMISSIVE_SCALE, 5);
    expect((other.material as THREE.MeshStandardMaterial).emissive.getHex()).toBe(0);
  });

  it("scales emissive with intensity and resets at zero", () => {
    const mesh = cupWith(new THREE.MeshStandardMaterial({ color: 0x4dd9ff }));
    const glow = new CupGlow();

    glow.apply(mesh, 0.5);
    const material = mesh.material as THREE.MeshStandardMaterial;
    expect(material.emissive.b).toBeCloseTo(0.5 * GLOW_EMISSIVE_SCALE, 5);

    glow.apply(mesh, 0);
    expect(material.emissive.getHex()).toBe(0);
  });

  it("resets and forgets cups that leave the scene", () => {
    const kept = cupWith(new THREE.MeshStandardMaterial({ color: 0xffffff }));
    const gone = cupWith(new THREE.MeshStandardMaterial({ color: 0xffffff }));
    const glow = new CupGlow();
    glow.apply(kept, 1);
    glow.apply(gone, 1);

    glow.retain([kept]);

    expect((gone.material as THREE.MeshStandardMaterial).emissive.getHex()).toBe(0);
    expect((kept.material as THREE.MeshStandardMaterial).emissive.getHex()).not.toBe(0);
  });

  it("dispose resets everything and further use is safe", () => {
    const mesh = cupWith(new THREE.MeshStandardMaterial({ color: 0xffffff }));
    const glow = new CupGlow();
    glow.apply(mesh, 1);

    glow.dispose();

    expect((mesh.material as THREE.MeshStandardMaterial).emissive.getHex()).toBe(0);
    expect(() => glow.retain([])).not.toThrow();
    expect(() => glow.dispose()).not.toThrow();
  });
});
