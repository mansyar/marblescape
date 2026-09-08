import * as THREE from "three";
import { PHYSICS } from "../domain/physics-config";

const WALL_THICKNESS = 0.25;

const BOARD_COLOR = 0x2c3e50;
const WALL_COLOR = 0x34495e;

/**
 * Builds the diorama board: a floor slab covering the cell area plus four
 * raised edge walls that keep marbles contained (spec: marbles never escape).
 * The group's origin is the board's top-left cell corner; cell (0,0) maps to
 * world (0.5, y, 0.5) — i.e. cell centers sit at (x + 0.5, y, z + 0.5).
 */
export function buildBoard(cols: number, rows: number): THREE.Group {
  const group = new THREE.Group();

  const floorGeom = new THREE.BoxGeometry(cols, 0.3, rows);
  const floor = new THREE.Mesh(floorGeom, new THREE.MeshStandardMaterial({ color: BOARD_COLOR }));
  floor.name = "floor";
  floor.position.set(cols / 2, -0.15, rows / 2);
  floor.receiveShadow = true;
  group.add(floor);

  const wallMaterial = new THREE.MeshStandardMaterial({ color: WALL_COLOR });
  const wallHeight = PHYSICS.wallHeight;
  const lengthX = cols + WALL_THICKNESS * 2;
  const lengthZ = rows + WALL_THICKNESS * 2;

  const north = new THREE.Mesh(
    new THREE.BoxGeometry(lengthX, wallHeight, WALL_THICKNESS),
    wallMaterial,
  );
  north.name = "wall-north";
  north.position.set(cols / 2, wallHeight / 2, -WALL_THICKNESS / 2);
  north.castShadow = true;
  north.receiveShadow = true;
  group.add(north);

  const south = north.clone();
  south.name = "wall-south";
  south.position.z = rows + WALL_THICKNESS / 2;
  group.add(south);

  const west = new THREE.Mesh(
    new THREE.BoxGeometry(WALL_THICKNESS, wallHeight, lengthZ),
    wallMaterial,
  );
  west.name = "wall-west";
  west.position.set(-WALL_THICKNESS / 2, wallHeight / 2, rows / 2);
  west.castShadow = true;
  west.receiveShadow = true;
  group.add(west);

  const east = west.clone();
  east.name = "wall-east";
  east.position.x = cols + WALL_THICKNESS / 2;
  group.add(east);

  return group;
}

/** Ambient fill + a shadow-casting key light above the board. */
export function addLighting(scene: THREE.Scene): void {
  const ambient = new THREE.AmbientLight(0xffffff, 0.7);
  scene.add(ambient);

  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(10, 18, 8);
  key.castShadow = true;
  key.shadow.camera.left = -12;
  key.shadow.camera.right = 12;
  key.shadow.camera.top = 12;
  key.shadow.camera.bottom = -12;
  scene.add(key);
}
