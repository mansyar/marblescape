import { describe, expect, it } from "vitest";
import { BOARD_COLS, BOARD_ROWS, computeCameraFraming, CAMERA_ELEVATION_DEG } from "./framing";

describe("board dimensions", () => {
  it("pins an 8x6 cell board", () => {
    expect(BOARD_COLS).toBe(8);
    expect(BOARD_ROWS).toBe(6);
  });
});

describe("computeCameraFraming", () => {
  it("looks at the center of the board", () => {
    const f = computeCameraFraming(16 / 9);
    expect(f.lookAt).toEqual([BOARD_COLS / 2, 0, BOARD_ROWS / 2]);
  });

  it("positions the camera on the tilted diorama axis", () => {
    const f = computeCameraFraming(16 / 9);
    // Camera sits centered horizontally, raised up and pulled back.
    expect(f.position[0]).toBeCloseTo(BOARD_COLS / 2);
    expect(f.position[1]).toBeGreaterThan(0);
    expect(f.position[2]).toBeGreaterThan(BOARD_ROWS / 2);
  });

  it("keeps elevation angle within the 30-60 degree diorama band", () => {
    expect(CAMERA_ELEVATION_DEG).toBeGreaterThanOrEqual(30);
    expect(CAMERA_ELEVATION_DEG).toBeLessThanOrEqual(60);
    const f = computeCameraFraming(16 / 9);
    const dx = f.position[0] - f.lookAt[0];
    const dy = f.position[1] - f.lookAt[1];
    const dz = f.position[2] - f.lookAt[2];
    const horizontal = Math.hypot(dx, dz);
    const angle = (Math.atan2(dy, horizontal) * 180) / Math.PI;
    expect(angle).toBeCloseTo(CAMERA_ELEVATION_DEG, 5);
  });

  it("zooms out in portrait so the full board width still fits", () => {
    const landscape = computeCameraFraming(16 / 9);
    const portrait = computeCameraFraming(9 / 16);
    expect(portrait.distance).toBeGreaterThan(landscape.distance);
  });

  it("zooms out for wider boards at the same aspect", () => {
    const small = computeCameraFraming(16 / 9, 4, 3);
    const large = computeCameraFraming(16 / 9, 12, 3);
    expect(large.distance).toBeGreaterThan(small.distance);
  });

  it("zooms in with a wider field of view", () => {
    const narrow = computeCameraFraming(16 / 9, BOARD_COLS, BOARD_ROWS, 40);
    const wide = computeCameraFraming(16 / 9, BOARD_COLS, BOARD_ROWS, 60);
    expect(wide.distance).toBeLessThan(narrow.distance);
  });

  it("keeps a safety margin so the board never touches the screen edge", () => {
    const f = computeCameraFraming(16 / 9);
    // distance must exceed the geometric minimum (no margin) for the tighter axis
    const halfH = BOARD_ROWS / 2;
    const noMargin = halfH / Math.tan(((60 / 2) * Math.PI) / 180);
    expect(f.distance).toBeGreaterThan(noMargin);
  });
});
