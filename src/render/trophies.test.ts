import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import { colorHex } from "../domain/colors";
import { PHYSICS } from "../domain/physics-config";
import { createTrophyTray, TROPHY_NAME } from "./trophies";

function hexOf(color: "mint" | "grape"): number {
  return Number.parseInt(colorHex(color).slice(1), 16);
}

describe("trophy tray", () => {
  it("rests a collected marble visibly inside the cup", () => {
    const scene = new THREE.Scene();
    const tray = createTrophyTray(scene);
    tray.add({ x: 3, z: 5 }, "mint");

    expect(tray.count()).toBe(1);
    const mesh = scene.children[0] as THREE.Mesh;
    expect(mesh.name).toBe(TROPHY_NAME);
    expect((mesh.geometry as THREE.SphereGeometry).parameters.radius).toBe(PHYSICS.marbleRadius);
    expect(mesh.position.x).toBeCloseTo(3.5);
    expect(mesh.position.z).toBeCloseTo(5.5);
    expect(mesh.position.y).toBeCloseTo(0.2);
    expect((mesh.material as THREE.MeshStandardMaterial).color.getHex()).toBe(hexOf("mint"));
  });

  it("stacks repeats in the same cup upward without moving earlier trophies", () => {
    const scene = new THREE.Scene();
    const tray = createTrophyTray(scene);
    tray.add({ x: 3, z: 5 }, "mint");
    const firstY = (scene.children[0] as THREE.Mesh).position.y;
    tray.add({ x: 3, z: 5 }, "grape");

    expect(tray.count()).toBe(2);
    expect((scene.children[0] as THREE.Mesh).position.y).toBe(firstY);
    expect((scene.children[1] as THREE.Mesh).position.y).toBeGreaterThan(firstY);
  });

  it("never rests a wrapped trophy on top of an earlier one", () => {
    const scene = new THREE.Scene();
    const tray = createTrophyTray(scene);
    for (let i = 0; i < 4; i += 1) {
      tray.add({ x: 3, z: 5 }, "mint");
    }

    const first = (scene.children[0] as THREE.Mesh).position.y;
    const fourth = (scene.children[3] as THREE.Mesh).position.y;
    expect(fourth).toBeGreaterThan(first);
  });

  it("keeps different cups at their own resting heights", () => {
    const scene = new THREE.Scene();
    const tray = createTrophyTray(scene);
    tray.add({ x: 3, z: 5 }, "mint");
    tray.add({ x: 4, z: 5 }, "grape");

    expect((scene.children[0] as THREE.Mesh).position.y).toBeCloseTo(0.2);
    expect((scene.children[1] as THREE.Mesh).position.y).toBeCloseTo(0.2);
  });

  it("clears every trophy and restarts the stacking", () => {
    const scene = new THREE.Scene();
    const tray = createTrophyTray(scene);
    tray.add({ x: 3, z: 5 }, "mint");
    tray.add({ x: 3, z: 5 }, "mint");
    tray.clear();
    expect(tray.count()).toBe(0);
    expect(scene.children).toHaveLength(0);

    tray.add({ x: 3, z: 5 }, "lemon");
    expect((scene.children[0] as THREE.Mesh).position.y).toBeCloseTo(0.2);
  });

  it("frees GPU resources on dispose", () => {
    const scene = new THREE.Scene();
    const tray = createTrophyTray(scene);
    tray.add({ x: 3, z: 5 }, "mint");
    const mesh = scene.children[0] as THREE.Mesh;
    const geoSpy = vi.spyOn(mesh.geometry, "dispose");
    const matSpy = vi.spyOn(mesh.material as THREE.Material, "dispose");
    tray.dispose();
    expect(geoSpy).toHaveBeenCalled();
    expect(matSpy).toHaveBeenCalled();
    expect(scene.children).toHaveLength(0);
  });
});
