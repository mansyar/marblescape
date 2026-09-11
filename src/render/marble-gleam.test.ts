import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import { PHYSICS } from "../domain/physics-config";
import {
  GLEAM_OFFSET_FACTOR,
  GLEAM_OPACITY,
  GLEAM_SCALE_FACTOR,
  MarbleGleam,
} from "./marble-gleam";

function makeMarble(x = 0, y = 0.3, z = 0): THREE.Object3D {
  const marble = new THREE.Object3D();
  marble.position.set(x, y, z);
  return marble;
}

describe("MarbleGleam lifecycle", () => {
  it("attaches one sprite per marble with a shared material, offset toward the camera", () => {
    const scene = new THREE.Scene();
    const gleam = new MarbleGleam(scene);
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 5, 10);
    const a = makeMarble();
    const b = makeMarble(2, 0.3, 1);

    gleam.attach(a);
    gleam.attach(b);
    gleam.attach(a); // duplicate attach is a no-op
    expect(gleam.activeCount).toBe(2);
    expect(scene.children).toHaveLength(2);

    const spriteA = scene.children[0] as THREE.Sprite;
    const spriteB = scene.children[1] as THREE.Sprite;
    expect(spriteA).toBeInstanceOf(THREE.Sprite);
    expect(spriteA.material).toBe(spriteB.material); // shared, created once
    expect(spriteA.material.opacity).toBeCloseTo(GLEAM_OPACITY);
    expect(spriteA.scale.x).toBeCloseTo(PHYSICS.marbleRadius * GLEAM_SCALE_FACTOR);

    gleam.update(camera);
    const towardCamera = camera.position.clone().sub(a.position).normalize();
    const fromMarble = spriteA.position.clone().sub(a.position);
    expect(fromMarble.length()).toBeCloseTo(PHYSICS.marbleRadius * GLEAM_OFFSET_FACTOR);
    expect(fromMarble.normalize().dot(towardCamera)).toBeCloseTo(1);
  });

  it("is additive, never modifies the marble's candy color, and reuses state per frame", () => {
    const scene = new THREE.Scene();
    const gleam = new MarbleGleam(scene);
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(4, 5, 10);

    const marble = new THREE.Mesh(
      new THREE.SphereGeometry(PHYSICS.marbleRadius, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0xff00ff }),
    );
    gleam.attach(marble);
    const sprite = scene.children[0] as THREE.Sprite;
    const material = sprite.material as THREE.SpriteMaterial;
    expect(material.blending).toBe(THREE.AdditiveBlending);
    expect(material.depthWrite).toBe(false);

    const positionRef = sprite.position;
    gleam.update(camera);
    gleam.update(camera);
    expect(sprite.position).toBe(positionRef); // mutated in place, no re-allocations
    const marbleMaterial = marble.material as THREE.MeshStandardMaterial;
    expect(marbleMaterial.color.getHex()).toBe(0xff00ff); // sheen adds light only

    // Sampling a new marble reuses the same highlight instance from the pool.
    gleam.detach(marble);
    const other = makeMarble(1, 0.3, 1);
    gleam.attach(other);
    expect(scene.children).toHaveLength(1);
    expect(scene.children[0]).toBe(sprite);
  });

  it("detach and dispose release everything; empty calls are safe", () => {
    const scene = new THREE.Scene();
    const gleam = new MarbleGleam(scene);
    const camera = new THREE.PerspectiveCamera();
    expect(() => gleam.update(camera)).not.toThrow();
    expect(() => gleam.detach(makeMarble())).not.toThrow();

    const marble = makeMarble();
    gleam.attach(marble);
    const sprite = scene.children[0] as THREE.Sprite;
    const material = sprite.material as THREE.SpriteMaterial;
    const materialSpy = vi.spyOn(material, "dispose");
    const mapSpy = vi.spyOn(material.map as THREE.DataTexture, "dispose");

    gleam.detach(marble);
    expect(gleam.activeCount).toBe(0);
    expect(scene.children).toHaveLength(0);

    gleam.dispose();
    expect(materialSpy).toHaveBeenCalledTimes(1);
    expect(mapSpy).toHaveBeenCalledTimes(1);
    expect(() => gleam.update(camera)).not.toThrow();
  });
});
