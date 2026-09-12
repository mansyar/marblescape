import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { CONNECTIONS, type PieceType } from "../domain/pieces";
import {
  createThumbnailClone,
  createWebGLCapture,
  generatePieceThumbnails,
  THUMBNAIL_SIZE,
  type OffscreenGL,
  type PieceCapture,
} from "./piece-thumbnails";

/** One named empty template per piece type. */
function loadAllTemplates(): Map<PieceType, THREE.Object3D> {
  const templates = new Map<PieceType, THREE.Object3D>();
  for (const type of Object.keys(CONNECTIONS) as PieceType[]) {
    const template = new THREE.Object3D();
    template.name = type;
    templates.set(type, template);
  }
  return templates;
}

/** Capture stub that records the objects handed to it; no rendering involved. */
function stubCapture(
  render: (object: THREE.Object3D) => string | null = () => "data:image/png;base64,img",
) {
  const state = { objects: [] as THREE.Object3D[], disposed: 0 };
  const factory = (): PieceCapture => ({
    capture: (object) => {
      state.objects.push(object);
      return render(object);
    },
    dispose: () => {
      state.disposed += 1;
    },
  });
  return { state, factory };
}

/** Fake GL boundary; records calls instead of touching a real WebGL context. */
function fakeGL() {
  const state = {
    sizes: [] as Array<[number, number]>,
    clears: [] as Array<[number, number]>,
    renderCount: 0,
    sceneChildCounts: [] as number[],
    lastChildren: [] as THREE.Object3D[],
    cameras: [] as THREE.PerspectiveCamera[],
    disposed: 0,
  };
  const gl: OffscreenGL = {
    domElement: { toDataURL: () => "data:image/png;base64,stub" },
    setSize: (width, height) => {
      state.sizes.push([width, height]);
    },
    setClearColor: (color, alpha) => {
      state.clears.push([color, alpha]);
    },
    render: (scene, camera) => {
      state.renderCount += 1;
      state.sceneChildCounts.push(scene.children.length);
      state.lastChildren.push(scene.children[scene.children.length - 1]);
      state.cameras.push(camera as THREE.PerspectiveCamera);
    },
    dispose: () => {
      state.disposed += 1;
    },
  };
  return { gl, state };
}

describe("generatePieceThumbnails", () => {
  it("renders one snapshot per loaded piece type in a single pass", () => {
    const templates = loadAllTemplates();
    const stub = stubCapture((object) => `data:image/png;base64,${object.name}`);
    const thumbnails = generatePieceThumbnails((type) => templates.get(type) ?? null, stub.factory);
    expect(thumbnails).toEqual({
      straight: "data:image/png;base64,straight",
      curved: "data:image/png;base64,curved",
      funnel: "data:image/png;base64,funnel",
      goal: "data:image/png;base64,goal",
    });
    expect(stub.state.objects).toHaveLength(4);
    expect(stub.state.disposed).toBe(1);
  });

  it("snapshots posed clones rather than the shared board templates", () => {
    const templates = loadAllTemplates();
    const stub = stubCapture();
    generatePieceThumbnails((type) => templates.get(type) ?? null, stub.factory);
    const first = stub.state.objects[0];
    expect(first).not.toBe(templates.get("straight"));
    expect(first.rotation.y).toBeCloseTo(CONNECTIONS.straight.modelYawOffset);
    expect(first.rotation.x).toBeCloseTo(CONNECTIONS.straight.slope ?? 0);
  });

  it("omits failed types and keeps the rest", () => {
    const templates = loadAllTemplates();
    const stub = stubCapture((object) => {
      if (object.name === "funnel") {
        throw new Error("render failed");
      }
      return object.name === "goal" ? null : `data:image/png;base64,${object.name}`;
    });
    const thumbnails = generatePieceThumbnails((type) => templates.get(type) ?? null, stub.factory);
    expect(Object.keys(thumbnails).sort()).toEqual(["curved", "straight"]);
    expect(stub.state.disposed).toBe(1);
  });

  it("skips piece types with no loaded template", () => {
    const stub = stubCapture();
    const thumbnails = generatePieceThumbnails(() => null, stub.factory);
    expect(thumbnails).toEqual({});
    expect(stub.state.objects).toHaveLength(0);
  });

  it("returns an empty record when no offscreen WebGL is available", () => {
    const thumbnails = generatePieceThumbnails(() => new THREE.Object3D());
    expect(thumbnails).toEqual({});
  });
});

describe("createThumbnailClone", () => {
  it("deep-clones the template with its children", () => {
    const template = new THREE.Group();
    template.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial()));
    const clone = createThumbnailClone("straight", template);
    expect(clone).not.toBe(template);
    expect(clone.children).toHaveLength(1);
    expect(clone.children[0]).not.toBe(template.children[0]);
  });

  it("applies the rotation-0 board pose, ramp lift included", () => {
    const clone = createThumbnailClone("straight", new THREE.Object3D());
    expect(clone.rotation.order).toBe("YXZ");
    expect(clone.rotation.y).toBeCloseTo(CONNECTIONS.straight.modelYawOffset);
    expect(clone.rotation.x).toBeCloseTo(CONNECTIONS.straight.slope ?? 0);
    expect(clone.position.y).toBeCloseTo(0.48 * Math.sin(CONNECTIONS.straight.slope ?? 0));
  });

  it("uses each model's authored yaw alignment", () => {
    const clone = createThumbnailClone("curved", new THREE.Object3D());
    expect(clone.rotation.y).toBeCloseTo(-Math.PI / 2);
  });
});

describe("createWebGLCapture", () => {
  it("configures a small transparent square canvas", () => {
    const { gl, state } = fakeGL();
    createWebGLCapture(() => gl);
    expect(state.sizes).toEqual([[THUMBNAIL_SIZE, THUMBNAIL_SIZE]]);
    expect(state.clears).toEqual([[0x000000, 0]]);
  });

  it("renders each captured object and returns the canvas PNG data URL", () => {
    const { gl, state } = fakeGL();
    const capture = createWebGLCapture(() => gl);
    const url = capture.capture(new THREE.Group());
    expect(url).toBe("data:image/png;base64,stub");
    expect(state.renderCount).toBe(1);
  });

  it("renders each piece alone, removing the previous one", () => {
    const { gl, state } = fakeGL();
    const capture = createWebGLCapture(() => gl);
    const first = new THREE.Group();
    const second = new THREE.Group();
    capture.capture(first);
    capture.capture(second);
    expect(state.lastChildren[0]).toBe(first);
    expect(state.lastChildren[1]).toBe(second);
    expect(state.sceneChildCounts[1]).toBe(state.sceneChildCounts[0]);
  });

  it("views the piece from an elevated three-quarter angle", () => {
    const { gl, state } = fakeGL();
    const capture = createWebGLCapture(() => gl);
    capture.capture(new THREE.Group());
    const camera = state.cameras[0];
    expect(camera.isPerspectiveCamera).toBe(true);
    expect(camera.aspect).toBe(1);
    expect(camera.position.x).toBeGreaterThan(0);
    expect(camera.position.y).toBeGreaterThan(0);
    expect(camera.position.z).toBeGreaterThan(0);
  });

  it("reuses one offscreen renderer across snapshots and disposes on demand", () => {
    const { gl, state } = fakeGL();
    let created = 0;
    const capture = createWebGLCapture(() => {
      created += 1;
      return gl;
    });
    capture.capture(new THREE.Group());
    capture.capture(new THREE.Group());
    expect(created).toBe(1);
    capture.dispose();
    expect(state.disposed).toBe(1);
  });
});
