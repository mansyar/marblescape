import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { worldToScreen } from "./projection";

/** Camera framing the board from the south, tilted down like the game's. */
function camera(): THREE.PerspectiveCamera {
  const cam = new THREE.PerspectiveCamera(45, 1, 0.1, 200);
  cam.position.set(4, 4, 8);
  cam.lookAt(4, 0, 3);
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld(true);
  return cam;
}

describe("worldToScreen", () => {
  it("maps the lookAt point to the viewport center", () => {
    const point = worldToScreen({ x: 4, y: 0, z: 3 }, camera(), 800, 600);
    expect(point.x).toBeCloseTo(400, 4);
    expect(point.y).toBeCloseTo(300, 4);
  });

  it("maps a +x world offset to the right of center", () => {
    const point = worldToScreen({ x: 5, y: 0, z: 3 }, camera(), 800, 600);
    expect(point.x).toBeGreaterThan(400);
  });

  it("maps a point closer to the camera lower on screen", () => {
    const base = worldToScreen({ x: 4, y: 0, z: 3 }, camera(), 800, 600);
    const nearer = worldToScreen({ x: 4, y: 0, z: 4 }, camera(), 800, 600);
    expect(nearer.y).toBeGreaterThan(base.y);
  });

  it("scales with the viewport size", () => {
    const point = worldToScreen({ x: 4, y: 0, z: 3 }, camera(), 320, 240);
    expect(point.x).toBeCloseTo(160, 4);
    expect(point.y).toBeCloseTo(120, 4);
  });
});
