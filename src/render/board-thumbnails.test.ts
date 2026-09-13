import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { createBoard, placeTypedPiece } from "../domain/board";
import { colorHex } from "../domain/colors";
import { LEVELS } from "../domain/levels";
import { CONNECTIONS, type PieceType } from "../domain/pieces";
import {
  boardSnapshotInput,
  buildBoardSnapshot,
  createBoardCapture,
  createBoardPreview,
  createBoardPreviewCache,
  generateLevelPreviews,
  levelSnapshotInput,
  type BoardSnapshotSpec,
} from "./board-thumbnails";
import { CAMERA_FOV_DEG } from "./framing";
import { cellToWorld, rotationYaw } from "./piece-view";
import { THUMBNAIL_SIZE, type OffscreenGL, type PieceCapture } from "./piece-thumbnails";

/** One named template per piece type, each holding a tintable mesh. */
function loadAllTemplates(): Map<PieceType, THREE.Object3D> {
  const templates = new Map<PieceType, THREE.Object3D>();
  for (const type of Object.keys(CONNECTIONS) as PieceType[]) {
    const root = new THREE.Group();
    root.name = type;
    root.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial()));
    templates.set(type, root);
  }
  return templates;
}

/** Capture stub recording the factory calls and captured objects; no rendering. */
function stubCapture(
  render: (object: THREE.Object3D) => string | null = () => "data:image/png;base64,img",
) {
  const state = {
    factories: [] as Array<[number, number]>,
    objects: [] as THREE.Object3D[],
    disposed: 0,
  };
  const factory = (cols: number, rows: number): PieceCapture => {
    state.factories.push([cols, rows]);
    return {
      capture: (object) => {
        state.objects.push(object);
        return render(object);
      },
      dispose: () => {
        state.disposed += 1;
      },
    };
  };
  return { state, factory };
}

/** Fake GL boundary; records calls instead of touching a real WebGL context. */
function fakeGL() {
  const state = {
    sizes: [] as Array<[number, number]>,
    clears: [] as Array<[number, number]>,
    renderCount: 0,
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
      state.lastChildren.push(scene.children[scene.children.length - 1]);
      state.cameras.push(camera as THREE.PerspectiveCamera);
    },
    dispose: () => {
      state.disposed += 1;
    },
  };
  return { gl, state };
}

/** First material found on an object; null when there is none. */
function firstMaterial(object: THREE.Object3D | undefined): THREE.MeshStandardMaterial | null {
  let found: THREE.MeshStandardMaterial | null = null;
  object?.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!found && mesh.isMesh) {
      found = mesh.material as THREE.MeshStandardMaterial;
    }
  });
  if (!found) {
    return null;
  }
  return found;
}

const SPEC: BoardSnapshotSpec = {
  cols: 8,
  rows: 6,
  pieces: [
    { type: "curved", rotation: 1, x: 2, y: 3 },
    { type: "goal", rotation: 0, x: 4, y: 5, color: "mint" },
  ],
  gaps: [{ x: 6, y: 1 }],
};

describe("levelSnapshotInput", () => {
  it("maps the board size, fixed furniture, and gap cells", () => {
    const spec = levelSnapshotInput(LEVELS[0]);
    expect(spec.cols).toBe(8);
    expect(spec.rows).toBe(6);
    expect(spec.pieces).toEqual([
      { type: "straight", rotation: 0, x: 3, y: 0 },
      { type: "straight", rotation: 0, x: 3, y: 1 },
      { type: "straight", rotation: 0, x: 3, y: 3 },
      { type: "straight", rotation: 0, x: 3, y: 4 },
      { type: "goal", rotation: 0, x: 3, y: 5 },
    ]);
    expect(spec.gaps).toEqual([{ x: 3, y: 2 }]);
  });

  it("carries candy cup colors through", () => {
    const cups = levelSnapshotInput(LEVELS[8]).pieces.filter((p) => p.type === "goal");
    expect(cups.map((cup) => cup.color)).toEqual(["raspberry", "mint", "grape"]);
  });
});

describe("boardSnapshotInput", () => {
  it("maps a sandbox board with no gap hints", () => {
    let board = createBoard(8, 6);
    board = placeTypedPiece(board, { id: "s1", type: "straight", rotation: 1, x: 2, y: 4 });
    board = placeTypedPiece(board, {
      id: "g1",
      type: "goal",
      rotation: 0,
      x: 5,
      y: 5,
      color: "blueberry",
    });
    expect(boardSnapshotInput(board)).toEqual({
      cols: 8,
      rows: 6,
      pieces: [
        { type: "straight", rotation: 1, x: 2, y: 4 },
        { type: "goal", rotation: 0, x: 5, y: 5, color: "blueberry" },
      ],
      gaps: [],
    });
  });
});

describe("buildBoardSnapshot", () => {
  function build() {
    const templates = loadAllTemplates();
    const root = buildBoardSnapshot(SPEC, (type) => templates.get(type) ?? null);
    if (!root) {
      throw new Error("expected a preview root");
    }
    return { root, templates };
  }

  it("composes the board, posed piece clones, and gap hints", () => {
    const { root } = build();
    expect(root.name).toBe("board-preview");
    expect(root.getObjectByName("board")?.getObjectByName("floor")).not.toBeUndefined();

    const curved = root.getObjectByName("piece-curved");
    expect(curved?.position.x).toBeCloseTo(cellToWorld(2, 3)[0]);
    expect(curved?.position.z).toBeCloseTo(cellToWorld(2, 3)[2]);
    expect(curved?.rotation.order).toBe("YXZ");
    expect(curved?.rotation.y).toBeCloseTo(rotationYaw(1) + CONNECTIONS.curved.modelYawOffset);
    expect(curved?.rotation.x).toBeCloseTo(CONNECTIONS.curved.slope ?? 0);

    const gap = root.getObjectByName("gap-highlight") as THREE.Mesh;
    expect(gap.position.toArray()).toEqual([cellToWorld(6, 1)[0], 0.02, cellToWorld(6, 1)[2]]);
    expect(gap.rotation.x).toBeCloseTo(-Math.PI / 2);
    const material = gap.material as THREE.MeshBasicMaterial;
    expect(material.color.getHex()).toBe(0x2ecc71);
    expect(material.transparent).toBe(true);
    expect(material.opacity).toBeCloseTo(0.45);
  });

  it("deep-clones templates and tints colored cups without touching the model", () => {
    const { root, templates } = build();
    const goal = root.getObjectByName("piece-goal");
    expect(goal).not.toBe(templates.get("goal"));
    expect(firstMaterial(goal)?.color.getHex()).toBe(
      Number.parseInt(colorHex("mint").slice(1), 16),
    );
    expect(firstMaterial(templates.get("goal"))?.color.getHex()).toBe(0xffffff);
  });

  it("returns null when any needed template is missing", () => {
    expect(buildBoardSnapshot(SPEC, () => null)).toBeNull();
  });
});

describe("generateLevelPreviews", () => {
  it("renders one preview per shipped level in a single capture pass", () => {
    const templates = loadAllTemplates();
    const stub = stubCapture((object) => `data:image/png;base64,${object.name}`);
    const previews = generateLevelPreviews(
      LEVELS,
      (type) => templates.get(type) ?? null,
      stub.factory,
    );
    expect(
      Object.keys(previews)
        .map(Number)
        .sort((a, b) => a - b),
    ).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(stub.state.factories).toEqual([[8, 6]]);
    expect(stub.state.objects).toHaveLength(9);
    expect(stub.state.disposed).toBe(1);
    expect(previews[1]).toBe("data:image/png;base64,board-preview");
  });

  it("omits levels with missing templates and keeps the rest", () => {
    const templates = loadAllTemplates();
    templates.delete("curved"); // levels 2, 3, 6, 7, 8, 9 need it
    const stub = stubCapture();
    const previews = generateLevelPreviews(
      LEVELS,
      (type) => templates.get(type) ?? null,
      stub.factory,
    );
    expect(previews[1]).toBeDefined();
    expect(previews[2]).toBeUndefined();
    expect(stub.state.disposed).toBe(1);
  });

  it("omits a failed level without throwing", () => {
    const templates = loadAllTemplates();
    let calls = 0;
    const stub = stubCapture(() => {
      calls += 1;
      if (calls === 2) {
        throw new Error("render failed");
      }
      return "data:image/png;base64,img";
    });
    const previews = generateLevelPreviews(
      LEVELS,
      (type) => templates.get(type) ?? null,
      stub.factory,
    );
    expect(Object.keys(previews)).toHaveLength(8);
    expect(stub.state.disposed).toBe(1);
  });

  it("returns an empty record when offscreen WebGL is unavailable", () => {
    expect(generateLevelPreviews([LEVELS[0]], () => new THREE.Object3D())).toEqual({});
  });
});

describe("createBoardPreview", () => {
  it("renders one sandbox snapshot and disposes the capture", () => {
    const templates = loadAllTemplates();
    const stub = stubCapture(() => "data:image/png;base64,sandbox");
    const url = createBoardPreview(SPEC, (type) => templates.get(type) ?? null, stub.factory);
    expect(url).toBe("data:image/png;base64,sandbox");
    expect(stub.state.factories).toEqual([[8, 6]]);
    expect(stub.state.disposed).toBe(1);
  });

  it("returns null instead of throwing when the capture cannot be created", () => {
    const url = createBoardPreview(
      SPEC,
      () => new THREE.Object3D(),
      () => {
        throw new Error("no webgl");
      },
    );
    expect(url).toBeNull();
  });
});

describe("createBoardCapture", () => {
  it("configures a small transparent square canvas", () => {
    const { gl, state } = fakeGL();
    createBoardCapture(8, 6, () => gl);
    expect(state.sizes).toEqual([[THUMBNAIL_SIZE, THUMBNAIL_SIZE]]);
    expect(state.clears).toEqual([[0x000000, 0]]);
  });

  it("frames the board from the fixed gameplay camera", () => {
    const { gl, state } = fakeGL();
    const capture = createBoardCapture(8, 6, () => gl);
    capture.capture(new THREE.Group());
    const camera = state.cameras[0];
    expect(camera.isPerspectiveCamera).toBe(true);
    expect(camera.aspect).toBe(1);
    expect(camera.fov).toBeCloseTo(CAMERA_FOV_DEG);
    expect(camera.position.x).toBeCloseTo(4); // board center column
    expect(camera.position.y).toBeGreaterThan(0);
    expect(camera.position.z).toBeGreaterThan(3); // south of the center row
    const direction = camera.getWorldDirection(new THREE.Vector3());
    expect(direction.y).toBeLessThan(0); // looking down at the table
  });

  it("renders each snapshot alone and returns the canvas PNG data URL", () => {
    const { gl, state } = fakeGL();
    const capture = createBoardCapture(8, 6, () => gl);
    const first = new THREE.Group();
    const second = new THREE.Group();
    expect(capture.capture(first)).toBe("data:image/png;base64,stub");
    capture.capture(second);
    expect(state.lastChildren[0]).toBe(first);
    expect(state.lastChildren[1]).toBe(second);
    capture.dispose();
    expect(state.disposed).toBe(1);
  });
});

describe("createBoardPreviewCache", () => {
  it("reuses the preview while the board token is unchanged", () => {
    let generated = 0;
    const cache = createBoardPreviewCache(
      () => "token-a",
      () => {
        generated += 1;
        return `data:image/png;base64,${generated}`;
      },
    );
    expect(cache()).toBe("data:image/png;base64,1");
    expect(cache()).toBe("data:image/png;base64,1");
    expect(generated).toBe(1);
  });

  it("regenerates when the token changes", () => {
    let token = "a";
    let generated = 0;
    const cache = createBoardPreviewCache(
      () => token,
      () => {
        generated += 1;
        return `url-${generated}`;
      },
    );
    expect(cache()).toBe("url-1");
    token = "b";
    expect(cache()).toBe("url-2");
    token = "b";
    expect(cache()).toBe("url-2");
    expect(generated).toBe(2);
  });

  it("caches a null preview until the token changes", () => {
    let token = "a";
    let generated = 0;
    const cache = createBoardPreviewCache(
      () => token,
      () => {
        generated += 1;
        return generated === 1 ? null : "url-2";
      },
    );
    expect(cache()).toBeNull();
    expect(cache()).toBeNull();
    expect(generated).toBe(1);
    token = "b";
    expect(cache()).toBe("url-2");
  });
});
