import { describe, expect, it } from "vitest";
import {
  BOARD_COLS,
  BOARD_ROWS,
  computeCameraFraming,
  CAMERA_ELEVATION_DEG,
  FRAMING_MARGIN,
} from "./framing";

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

describe("computeCameraFraming reserved space", () => {
  const FOV = 45;
  const fovRad = (FOV * Math.PI) / 180;
  const fitHeight = BOARD_ROWS / 2 / Math.tan(fovRad / 2);
  const marginFit = (fit: number) => fit * FRAMING_MARGIN;

  it("keeps today's exact output when nothing is reserved (backward compatible)", () => {
    expect(computeCameraFraming(16 / 9, 8, 6, 45, 0, 0)).toEqual(
      computeCameraFraming(16 / 9, 8, 6, 45),
    );
  });

  it("zooms out in landscape when the right rail reserves width", () => {
    const baseline = computeCameraFraming(16 / 9);
    const reserved = computeCameraFraming(16 / 9, 8, 6, 45, 0.4);
    expect(reserved.distance).toBeGreaterThan(baseline.distance);
  });

  it("zooms out in portrait when width is reserved", () => {
    const baseline = computeCameraFraming(9 / 16);
    const reserved = computeCameraFraming(9 / 16, 8, 6, 45, 0.25);
    expect(reserved.distance).toBeGreaterThan(baseline.distance);
  });

  it("moves closer in portrait when height is reserved (aspect widens)", () => {
    const baseline = computeCameraFraming(9 / 16);
    const reserved = computeCameraFraming(9 / 16, 8, 6, 45, 0, 0.25);
    expect(reserved.distance).toBeLessThan(baseline.distance);
  });

  it("solves the exact fit distance at the aspect equilibrium", () => {
    // Reserving 25% width at 16:9 yields an effective aspect of 4:3, where
    // the vertical and horizontal constraints are exactly equal.
    const f = computeCameraFraming(16 / 9, 8, 6, 45, 0.25);
    expect(f.distance).toBeCloseTo(marginFit(fitHeight), 10);
  });

  it("combines reserved width and height multiplicatively", () => {
    // Equal fractions cancel: 0.75/0.75 = 1 -> identical to no reservation.
    const both = computeCameraFraming(16 / 9, 8, 6, 45, 0.25, 0.25);
    expect(both.distance).toBeCloseTo(computeCameraFraming(16 / 9).distance, 10);
    // Width-dominant reservation zooms out.
    const wide = computeCameraFraming(16 / 9, 8, 6, 45, 0.5, 0.25);
    expect(wide.distance).toBeGreaterThan(computeCameraFraming(16 / 9).distance);
  });
});
