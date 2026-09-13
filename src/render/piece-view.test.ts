import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { colorHex } from "../domain/colors";
import { CONNECTIONS, PIECE_TYPES } from "../domain/pieces";
import { cellToWorld, cupTintTarget, PieceRenderer, posePiece, rotationYaw } from "./piece-view";

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

describe("posePiece", () => {
  it("sits flush on the board: yaw alignment only, no pitch or lift", () => {
    for (const type of PIECE_TYPES) {
      for (const rotation of [0, 1, 2, 3] as const) {
        const mesh = new THREE.Object3D();
        posePiece(mesh, { type, rotation, x: 2, y: 3 });
        expect(mesh.rotation.order).toBe("YXZ");
        expect(mesh.rotation.x).toBe(0);
        expect(mesh.rotation.z).toBe(0);
        expect(mesh.position.y).toBe(0);
        expect(mesh.rotation.y).toBeCloseTo(
          rotationYaw(rotation) + CONNECTIONS[type].modelYawOffset,
        );
        expect(mesh.position.x).toBeCloseTo(2.5);
        expect(mesh.position.z).toBeCloseTo(3.5);
      }
    }
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

  it("exposes loaded model templates for offscreen snapshots", async () => {
    const { renderer } = makeRenderer();
    expect(renderer.templateFor("straight")).toBeNull();
    await renderer.loadTemplates();
    expect(renderer.templateFor("straight")).toBeInstanceOf(THREE.Object3D);
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

describe("cup tinting", () => {
  function makeTintedRenderer() {
    const root = new THREE.Group();
    const templateMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const loader = {
      loadAsync: async () => {
        const scene = new THREE.Object3D();
        scene.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), templateMaterial));
        return { scene };
      },
    };
    const renderer = new PieceRenderer(root, loader);
    return { root, renderer, templateMaterial };
  }

  function firstMaterial(object: THREE.Object3D): THREE.MeshStandardMaterial {
    let found: THREE.MeshStandardMaterial | null = null;
    object.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (!found && mesh.isMesh) {
        found = mesh.material as THREE.MeshStandardMaterial;
      }
    });
    if (!found) {
      throw new Error("template has no mesh");
    }
    return found;
  }

  it("tints a colored cup without touching the shared template", async () => {
    const { root, renderer, templateMaterial } = makeTintedRenderer();
    await renderer.loadTemplates();
    renderer.sync([{ id: "g1", type: "goal", rotation: 0 as const, x: 3, y: 5, color: "mint" }]);
    const material = firstMaterial(root.children[0]);
    expect(material.color.getHex()).toBe(Number.parseInt(colorHex("mint").slice(1), 16));
    expect(material).not.toBe(templateMaterial); // cloned before tinting
    expect(templateMaterial.color.getHex()).toBe(0xffffff);
  });

  it("re-tints the cup when its color changes", async () => {
    const { root, renderer } = makeTintedRenderer();
    await renderer.loadTemplates();
    const goal = {
      id: "g1",
      type: "goal" as const,
      rotation: 0 as const,
      x: 3,
      y: 5,
      color: "mint" as const,
    };
    renderer.sync([goal]);
    renderer.sync([{ ...goal, color: "grape" as const }]);
    const material = firstMaterial(root.children[0]);
    expect(material.color.getHex()).toBe(Number.parseInt(colorHex("grape").slice(1), 16));
  });

  it("leaves a classic cup exactly as modeled", async () => {
    const { root, renderer, templateMaterial } = makeTintedRenderer();
    await renderer.loadTemplates();
    renderer.sync([{ id: "g1", type: "goal", rotation: 0 as const, x: 3, y: 5 }]);
    const material = firstMaterial(root.children[0]);
    expect(material).toBe(templateMaterial); // never cloned, never tinted
    expect(material.color.getHex()).toBe(0xffffff);
  });

  it("flashes a cup's emissive for tap feedback", async () => {
    const { root, renderer } = makeTintedRenderer();
    await renderer.loadTemplates();
    renderer.sync([{ id: "g1", type: "goal", rotation: 0 as const, x: 3, y: 5, color: "mint" }]);
    const material = firstMaterial(root.children[0]);
    const target = cupTintTarget(root.children[0]);
    target.setFlash(0.5);
    expect(material.emissive.r).toBeCloseTo(0.3, 5);
    target.setFlash(0);
    expect(material.emissive.r).toBe(0);
  });
});
