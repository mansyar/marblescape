import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import { colorHex, type MarbleColor } from "../domain/colors";
import { PHYSICS } from "../domain/physics-config";
import { createWaitingMarble, WAITING_MARBLE_NAME } from "./waiting-marble";

function hexOf(color: MarbleColor): number {
  return Number.parseInt(colorHex(color).slice(1), 16);
}

describe("waiting marble", () => {
  it("is a marble-sized sphere hovering over the given cell", () => {
    const scene = new THREE.Scene();
    const waiting = createWaitingMarble(scene);
    waiting.setCell(3, 0);

    expect(waiting.mesh).toBeInstanceOf(THREE.Mesh);
    expect((waiting.mesh.geometry as THREE.SphereGeometry).parameters.radius).toBe(
      PHYSICS.marbleRadius,
    );
    expect(waiting.mesh.name).toBe(WAITING_MARBLE_NAME);
    expect(waiting.mesh.position.x).toBeCloseTo(3.5);
    expect(waiting.mesh.position.z).toBeCloseTo(0.5);
    expect(waiting.mesh.position.y).toBeCloseTo(PHYSICS.spawnHeight);
    expect(scene.children).toContain(waiting.mesh);
  });

  it("wears the next marble's candy color", () => {
    const scene = new THREE.Scene();
    const waiting = createWaitingMarble(scene);
    waiting.setColor("mint");
    expect((waiting.mesh.material as THREE.MeshStandardMaterial).color.getHex()).toBe(
      hexOf("mint"),
    );
    expect(waiting.currentColor()).toBe("mint");
    waiting.setColor("grape");
    expect((waiting.mesh.material as THREE.MeshStandardMaterial).color.getHex()).toBe(
      hexOf("grape"),
    );
  });

  it("bobs gently while motion is allowed", () => {
    const scene = new THREE.Scene();
    const waiting = createWaitingMarble(scene);
    waiting.setCell(4, 0);
    waiting.update(0);
    const y0 = waiting.mesh.position.y;
    waiting.update(0.55);
    expect(waiting.mesh.position.y).not.toBeCloseTo(y0, 3);
    expect(Math.abs(waiting.mesh.position.y - PHYSICS.spawnHeight)).toBeLessThanOrEqual(0.08);
  });

  it("stands perfectly still under reduced motion", () => {
    const scene = new THREE.Scene();
    const waiting = createWaitingMarble(scene);
    waiting.setCell(4, 0);
    waiting.setReducedMotion(true);
    waiting.update(0);
    waiting.update(0.55);
    waiting.update(1.1);
    expect(waiting.mesh.position.y).toBe(PHYSICS.spawnHeight);
  });

  it("hides while a marble is live and reports its state", () => {
    const scene = new THREE.Scene();
    const waiting = createWaitingMarble(scene);
    expect(waiting.isVisible()).toBe(true);
    waiting.setVisible(false);
    expect(waiting.mesh.visible).toBe(false);
    expect(waiting.isVisible()).toBe(false);
    waiting.setVisible(true);
    expect(waiting.mesh.visible).toBe(true);
  });

  it("removes itself from the scene and frees GPU resources on dispose", () => {
    const scene = new THREE.Scene();
    const waiting = createWaitingMarble(scene);
    const geoSpy = vi.spyOn(waiting.mesh.geometry, "dispose");
    const matSpy = vi.spyOn(waiting.mesh.material as THREE.Material, "dispose");
    waiting.dispose();
    expect(geoSpy).toHaveBeenCalled();
    expect(matSpy).toHaveBeenCalled();
    expect(scene.children).not.toContain(waiting.mesh);
  });
});
