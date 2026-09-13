import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { cameraReservation } from "../ui/layout";
import { BOARD_COLS, BOARD_ROWS, CAMERA_FOV_DEG, computeCameraFraming } from "./framing";
import { applyRendererFraming, effectivePixelRatio } from "./scene";

/** Records what the shared framing path applied to the renderer. */
class StubRenderer {
  ratios: number[] = [];
  sizes: Array<[number, number]> = [];

  setPixelRatio(ratio: number): void {
    this.ratios.push(ratio);
  }

  setSize(width: number, height: number): void {
    this.sizes.push([width, height]);
  }
}

function makeCamera(): THREE.PerspectiveCamera {
  return new THREE.PerspectiveCamera(CAMERA_FOV_DEG, 1, 0.1, 200);
}

describe("effectivePixelRatio", () => {
  it("composes the device ratio with the tier cap", () => {
    expect(effectivePixelRatio(3, 2)).toBe(2);
    expect(effectivePixelRatio(3, 1.5)).toBe(1.5);
    expect(effectivePixelRatio(1.5, 2)).toBe(1.5);
    expect(effectivePixelRatio(2, 1)).toBe(1);
  });

  it("falls back to 1 for junk inputs", () => {
    expect(effectivePixelRatio(Number.NaN, 2)).toBe(1);
    expect(effectivePixelRatio(0, 2)).toBe(1);
    expect(effectivePixelRatio(-2, 2)).toBe(1);
    expect(effectivePixelRatio(3, Number.NaN)).toBe(1);
    expect(effectivePixelRatio(3, 0)).toBe(1);
  });
});

describe("applyRendererFraming", () => {
  it("applies the quality-capped pixel ratio and viewport through one shared path", () => {
    const renderer = new StubRenderer();
    const camera = makeCamera();
    const container = { clientWidth: 390, clientHeight: 700 };

    applyRendererFraming(renderer, camera, container, 3, 2);

    expect(renderer.ratios).toEqual([2]);
    expect(renderer.sizes).toEqual([[390, 700]]);
    expect(camera.aspect).toBeCloseTo(390 / 700);

    const expected = computeCameraFraming(
      camera.aspect,
      BOARD_COLS,
      BOARD_ROWS,
      CAMERA_FOV_DEG,
      cameraReservation(390, 700),
    );
    expect(camera.position.x).toBeCloseTo(expected.position[0]);
    expect(camera.position.y).toBeCloseTo(expected.position[1]);
    expect(camera.position.z).toBeCloseTo(expected.position[2]);
  });

  it("re-applies ratio, size and camera on every call (resize / orientation / tier change)", () => {
    const renderer = new StubRenderer();
    const camera = makeCamera();

    applyRendererFraming(renderer, camera, { clientWidth: 390, clientHeight: 700 }, 3, 2);
    applyRendererFraming(renderer, camera, { clientWidth: 844, clientHeight: 390 }, 3, 1);

    expect(renderer.ratios).toEqual([2, 1]);
    expect(renderer.sizes).toEqual([
      [390, 700],
      [844, 390],
    ]);
    expect(camera.aspect).toBeCloseTo(844 / 390);
  });

  it("never collapses a zero-sized container", () => {
    const renderer = new StubRenderer();
    const camera = makeCamera();
    applyRendererFraming(renderer, camera, { clientWidth: 0, clientHeight: 0 }, 2, 2);
    expect(renderer.sizes).toEqual([[1, 1]]);
  });
});
