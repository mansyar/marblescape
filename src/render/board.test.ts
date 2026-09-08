import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { BOARD_COLS, BOARD_ROWS } from "./framing";
import { PHYSICS } from "../domain/physics-config";
import { buildBoard, addLighting } from "./board";

describe("buildBoard", () => {
  const board = buildBoard(BOARD_COLS, BOARD_ROWS);

  function sizeOf(geom: THREE.BufferGeometry): THREE.Vector3 {
    geom.computeBoundingBox();
    const box = geom.boundingBox;
    if (!box) {
      throw new Error("boundingBox missing after computeBoundingBox()");
    }
    return box.getSize(new THREE.Vector3());
  }

  it("returns a group containing a floor and four edge walls", () => {
    expect(board).toBeInstanceOf(THREE.Group);
    const floor = board.children.find((c) => c.name === "floor");
    expect(floor).toBeDefined();
    const walls = board.children.filter((c) => c.name.startsWith("wall-"));
    expect(walls).toHaveLength(4);
    expect(new Set(walls.map((w) => w.name))).toEqual(
      new Set(["wall-north", "wall-south", "wall-east", "wall-west"]),
    );
  });

  it("scales the floor to the full board area", () => {
    const floor = board.children.find((c) => c.name === "floor") as THREE.Mesh;
    const size = sizeOf(floor.geometry);
    expect(size.x).toBeCloseTo(BOARD_COLS);
    expect(size.z).toBeCloseTo(BOARD_ROWS);
  });

  it("centers the floor on the board area", () => {
    const floor = board.children.find((c) => c.name === "floor") as THREE.Mesh;
    expect(floor.position.x).toBeCloseTo(BOARD_COLS / 2);
    expect(floor.position.z).toBeCloseTo(BOARD_ROWS / 2);
  });

  it("raises walls to the configured guard-rail height", () => {
    const wall = board.children.find((c) => c.name === "wall-north") as THREE.Mesh;
    const size = sizeOf(wall.geometry);
    expect(size.y).toBeCloseTo(PHYSICS.wallHeight);
    expect(wall.position.y).toBeCloseTo(PHYSICS.wallHeight / 2);
  });

  it("encloses the board: walls sit just outside the floor edge", () => {
    const wall = board.children.find((c) => c.name === "wall-west") as THREE.Mesh;
    // West wall lies at x slightly below 0 (outside the play area).
    expect(wall.position.x).toBeLessThan(0);
    const north = board.children.find((c) => c.name === "wall-north") as THREE.Mesh;
    expect(north.position.z).toBeLessThan(0);
  });

  it("spans each wall along the full board edge (with corner overlap)", () => {
    const north = board.children.find((c) => c.name === "wall-north") as THREE.Mesh;
    expect(sizeOf(north.geometry).x).toBeGreaterThanOrEqual(BOARD_COLS);
    const west = board.children.find((c) => c.name === "wall-west") as THREE.Mesh;
    expect(sizeOf(west.geometry).z).toBeGreaterThanOrEqual(BOARD_ROWS);
  });
});

describe("addLighting", () => {
  it("adds ambient and directional lights to the scene", () => {
    const scene = new THREE.Scene();
    addLighting(scene);
    const lights = scene.children.filter((c) => c instanceof THREE.Light);
    const ambient = lights.find((l) => l instanceof THREE.AmbientLight);
    const directional = lights.find((l) => l instanceof THREE.DirectionalLight);
    expect(ambient).toBeDefined();
    expect(directional).toBeDefined();
  });

  it("positions the directional light above the board", () => {
    const scene = new THREE.Scene();
    addLighting(scene);
    const dir = scene.children.find(
      (c) => c instanceof THREE.DirectionalLight,
    ) as THREE.DirectionalLight;
    expect(dir.position.y).toBeGreaterThan(BOARD_COLS);
  });
});
