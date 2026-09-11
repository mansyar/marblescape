import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { MARBLE_FADE_SECONDS, MarbleFader } from "./marble-fade";

function makeMarble(): {
  parent: THREE.Group;
  mesh: THREE.Mesh;
  material: THREE.MeshStandardMaterial;
} {
  const parent = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ color: 0xd94f6b });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), material);
  parent.add(mesh);
  return { parent, mesh, material };
}

describe("marble fade constants", () => {
  it("is a quick gentle exit (150–200 ms, spec FR1)", () => {
    expect(MARBLE_FADE_SECONDS).toBeGreaterThanOrEqual(0.15);
    expect(MARBLE_FADE_SECONDS).toBeLessThanOrEqual(0.2);
  });
});

describe("MarbleFader", () => {
  it("shrinks and fades while active, then removes and disposes the mesh", () => {
    const { parent, mesh, material } = makeMarble();
    const geometryDispose = vi.spyOn(mesh.geometry, "dispose");
    const materialDispose = vi.spyOn(material, "dispose");

    const fader = new MarbleFader();
    fader.start(mesh);
    expect(fader.activeCount).toBe(1);

    fader.update(MARBLE_FADE_SECONDS * 0.5);
    expect(fader.activeCount).toBe(1);
    expect(mesh.scale.x).toBeLessThan(1);
    expect(mesh.scale.x).toBeGreaterThan(0.01);
    expect(material.transparent).toBe(true);
    expect(material.opacity).toBeLessThan(1);
    expect(material.opacity).toBeGreaterThan(0);
    expect(parent.children).toContain(mesh);

    fader.update(MARBLE_FADE_SECONDS * 0.5 + 0.001);
    expect(fader.activeCount).toBe(0);
    expect(parent.children).not.toContain(mesh);
    expect(geometryDispose).toHaveBeenCalledTimes(1);
    expect(materialDispose).toHaveBeenCalledTimes(1);
  });

  it("keeps mid-flight fades independent when a burst of recycles overlaps", () => {
    const fader = new MarbleFader();
    const first = [makeMarble(), makeMarble(), makeMarble()];
    for (const { mesh } of first) {
      fader.start(mesh);
    }
    expect(fader.activeCount).toBe(3);

    fader.update(MARBLE_FADE_SECONDS * 0.25);
    expect(fader.activeCount).toBe(3);

    // A new recycle joins while the earlier three are still mid-flight.
    const late = makeMarble();
    fader.start(late.mesh);
    fader.update(MARBLE_FADE_SECONDS * 0.76);
    expect(fader.activeCount).toBe(1);
    expect(first.every(({ parent }) => parent.children.length === 0)).toBe(true);

    fader.update(MARBLE_FADE_SECONDS * 0.25);
    expect(fader.activeCount).toBe(0);
    expect(late.parent.children).toHaveLength(0);
  });

  it("update is safe with no active fades", () => {
    const fader = new MarbleFader();
    expect(() => fader.update(0.016)).not.toThrow();
    expect(fader.activeCount).toBe(0);
  });

  it("dispose clears every active fade and its resources", () => {
    const fader = new MarbleFader();
    const { parent, mesh } = makeMarble();
    const geometryDispose = vi.spyOn(mesh.geometry, "dispose");
    fader.start(mesh);
    fader.dispose();
    expect(fader.activeCount).toBe(0);
    expect(parent.children).toHaveLength(0);
    expect(geometryDispose).toHaveBeenCalledTimes(1);
  });
});
