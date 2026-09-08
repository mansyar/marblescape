import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { cellToWorld, PieceRenderer, rotationYaw } from "./piece-view";

describe("cellToWorld", () => {
  it("maps cell (0,0) to the center of its cell", () => {
    const [x, , z] = cellToWorld(0, 0);
    expect(x).toBeCloseTo(0.5);
    expect(z).toBeCloseTo(0.5);
  });

  it("maps cell (col,row) to col+0.5, row+0.5", () => {
    const [x, , z] = cellToWorld(3, 2);
    expect(x).toBeCloseTo(3.5);
    expect(z).toBeCloseTo(2.5);
  });

  it("sits on the board surface plane", () => {
    const [, y] = cellToWorld(0, 0);
    expect(y).toBe(0);
  });
});

describe("rotationYaw", () => {
  it("maps quarter turns to radians", () => {
    expect(rotationYaw(0)).toBeCloseTo(0);
    expect(rotationYaw(1)).toBeCloseTo(-Math.PI / 2);
    expect(rotationYaw(2)).toBeCloseTo(-Math.PI);
    expect(rotationYaw(3)).toBeCloseTo((-3 * Math.PI) / 2);
  });

  it("rotates clockwise when viewed from above (negative yaw)", () => {
    // Domain sides shift clockwise with rotation; in three.js a clockwise
    // turn viewed from +Y is a negative rotation around Y.
    expect(rotationYaw(1)).toBeLessThan(0);
    expect(rotationYaw(3)).toBeLessThan(0);
  });
});

describe("PieceRenderer", () => {
  function makeRenderer() {
    const root = new THREE.Group();
    const renderer = new PieceRenderer(root, {
      loadAsync: async () => ({ scene: new THREE.Object3D() }),
    });
    return { root, renderer };
  }

  it("adds a named mesh per placed piece after templates load", async () => {
    const { root, renderer } = makeRenderer();
    await renderer.loadTemplates();
    renderer.sync([{ id: "p1", type: "straight", rotation: 0 as const, x: 2, y: 3 }]);
    expect(root.children).toHaveLength(1);
    expect(root.children[0].name).toBe("piece-p1");
  });

  it("positions and orients the mesh at the cell center", async () => {
    const { root, renderer } = makeRenderer();
    await renderer.loadTemplates();
    renderer.sync([{ id: "p1", type: "curved", rotation: 2 as const, x: 0, y: 0 }]);
    const mesh = root.children[0];
    expect(mesh.position.x).toBeCloseTo(0.5);
    expect(mesh.position.z).toBeCloseTo(0.5);
    // rotation 2 yaw (-π) + curved's modelYawOffset (-π/2)
    expect(mesh.rotation.y).toBeCloseTo((-3 * Math.PI) / 2);
  });

  it("removes meshes for pieces that leave the board", async () => {
    const { root, renderer } = makeRenderer();
    await renderer.loadTemplates();
    const piece = { id: "p1", type: "straight" as const, rotation: 0 as const, x: 1, y: 1 };
    renderer.sync([piece]);
    renderer.sync([]);
    expect(root.children).toHaveLength(0);
  });

  it("skips pieces when templates have not loaded yet", () => {
    const { root, renderer } = makeRenderer();
    renderer.sync([{ id: "p1", type: "straight", rotation: 0, x: 0, y: 0 }]);
    expect(root.children).toHaveLength(0);
  });

  it("falls back to a placeholder when a model fails to load", async () => {
    const root = new THREE.Group();
    const renderer = new PieceRenderer(root, {
      loadAsync: async () => {
        throw new Error("offline");
      },
    });
    await renderer.loadTemplates();
    renderer.sync([{ id: "p1", type: "straight", rotation: 0, x: 0, y: 0 }]);
    expect(root.children).toHaveLength(1);
  });
});
