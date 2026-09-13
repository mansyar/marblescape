/**
 * Camera-matched board previews for the level select: miniature renders of a
 * starting level board or the child's sandbox build, produced offscreen with
 * the same capture pipeline as the piece palette thumbnails.
 */

import * as THREE from "three";
import type { BoardState } from "../domain/board";
import type { MarbleColor } from "../domain/colors";
import type { LevelDef } from "../domain/levels";
import type { PieceType, Rotation } from "../domain/pieces";
import { buildBoard } from "./board";
import { CAMERA_FOV_DEG, computeCameraFraming } from "./framing";
import { posePiece, tintCup } from "./piece-view";
import {
  createOffscreenCapture,
  defaultOffscreenGL,
  type OffscreenGL,
  type PieceCapture,
} from "./piece-thumbnails";

/** Same soft green as the in-game placement highlight. */
const GAP_COLOR = 0x2ecc71;

/** A piece placed on a preview board (level furniture or sandbox piece). */
export interface BoardSnapshotPiece {
  type: PieceType;
  rotation: Rotation;
  x: number;
  y: number;
  color?: MarbleColor;
}

/** Everything needed to render one board preview. */
export interface BoardSnapshotSpec {
  cols: number;
  rows: number;
  pieces: BoardSnapshotPiece[];
  gaps: Array<{ x: number; y: number }>;
}

/** Data-URL board previews keyed by level id; a missing id falls back to text. */
export type BoardPreviews = Partial<Record<number, string>>;

/** Builds the offscreen capture for a board; `createGL` is injectable for tests. */
export function createBoardCapture(
  cols: number,
  rows: number,
  createGL: () => OffscreenGL = defaultOffscreenGL,
): PieceCapture {
  return createOffscreenCapture(createGL, createBoardCamera(cols, rows));
}

/** Frames the whole board from the same fixed tilted camera the game uses. */
function createBoardCamera(cols: number, rows: number): THREE.PerspectiveCamera {
  const { position, lookAt } = computeCameraFraming(1, cols, rows);
  const camera = new THREE.PerspectiveCamera(CAMERA_FOV_DEG, 1, 0.1, 200);
  camera.position.set(...position);
  camera.lookAt(...lookAt);
  return camera;
}

// --- Snapshot inputs ---

/** Maps a level's starting board: furniture pieces plus highlighted gap cells. */
export function levelSnapshotInput(level: LevelDef): BoardSnapshotSpec {
  return {
    cols: level.boardWidth,
    rows: level.boardHeight,
    pieces: level.fixed.map(({ type, rotation, x, y, color }) =>
      color === undefined ? { type, rotation, x, y } : { type, rotation, x, y, color },
    ),
    gaps: level.gaps.map(({ x, y }) => ({ x, y })),
  };
}

/** Maps a sandbox board; sandbox builds have no gaps to hint. */
export function boardSnapshotInput(board: BoardState): BoardSnapshotSpec {
  return {
    cols: board.width,
    rows: board.height,
    pieces: board.pieces.map(({ type, rotation, x, y, color }) =>
      color === undefined ? { type, rotation, x, y } : { type, rotation, x, y, color },
    ),
    gaps: [],
  };
}

// --- Scene composition ---

/**
 * Builds the offscreen scene: diorama board, posed piece clones, and soft gap
 * hints. Returns null when a needed template is unavailable, so the tile falls
 * back to its glyph rather than showing an incomplete board.
 */
export function buildBoardSnapshot(
  spec: BoardSnapshotSpec,
  templateFor: (type: PieceType) => THREE.Object3D | null,
): THREE.Group | null {
  const root = new THREE.Group();
  root.name = "board-preview";

  const board = buildBoard(spec.cols, spec.rows);
  board.name = "board";
  root.add(board);

  for (const piece of spec.pieces) {
    const template = templateFor(piece.type);
    if (!template) {
      return null;
    }
    const clone = template.clone(true);
    clone.name = `piece-${piece.type}`;
    posePiece(clone, piece);
    if (piece.type === "goal" && piece.color !== undefined) {
      tintCup(clone, piece.color);
    }
    root.add(clone);
  }

  for (const gap of spec.gaps) {
    const highlight = new THREE.Mesh(
      new THREE.PlaneGeometry(0.96, 0.96),
      new THREE.MeshBasicMaterial({ color: GAP_COLOR, transparent: true, opacity: 0.45 }),
    );
    highlight.name = "gap-highlight";
    highlight.rotation.x = -Math.PI / 2;
    highlight.position.set(gap.x + 0.5, 0.02, gap.y + 0.5);
    root.add(highlight);
  }

  return root;
}

// --- Generation ---

/**
 * Renders every level preview in one pass, reusing one capture per board size
 * and disposing it at the end. Fault-tolerant: a level whose templates are
 * unavailable or that fails to render is omitted so its tile keeps its glyph.
 */
export function generateLevelPreviews(
  levels: readonly LevelDef[],
  templateFor: (type: PieceType) => THREE.Object3D | null,
  createCapture: (cols: number, rows: number) => PieceCapture = createBoardCapture,
): BoardPreviews {
  const captures = new Map<string, PieceCapture | null>();
  const captureFor = (cols: number, rows: number): PieceCapture | null => {
    const key = `${cols}x${rows}`;
    if (!captures.has(key)) {
      let capture: PieceCapture | null = null;
      try {
        capture = createCapture(cols, rows);
      } catch {
        // Headless / no-WebGL environments: tiles keep their text glyphs.
      }
      captures.set(key, capture);
    }
    return captures.get(key) ?? null;
  };

  const previews: BoardPreviews = {};
  try {
    for (const level of levels) {
      const spec = levelSnapshotInput(level);
      const capture = captureFor(spec.cols, spec.rows);
      if (!capture) {
        continue;
      }
      try {
        const root = buildBoardSnapshot(spec, templateFor);
        const url = root ? capture.capture(root) : null;
        if (url) {
          previews[level.id] = url;
        }
      } catch {
        // Omit this level; its tile falls back to the digit.
      }
    }
  } finally {
    for (const capture of captures.values()) {
      capture?.dispose();
    }
  }
  return previews;
}

/**
 * Renders one sandbox board preview, or null when it cannot be produced; a
 * fresh capture per call keeps its offscreen renderer short-lived.
 */
export function createBoardPreview(
  spec: BoardSnapshotSpec,
  templateFor: (type: PieceType) => THREE.Object3D | null,
  createCapture: (cols: number, rows: number) => PieceCapture = createBoardCapture,
): string | null {
  let capture: PieceCapture;
  try {
    capture = createCapture(spec.cols, spec.rows);
  } catch {
    return null;
  }
  try {
    const root = buildBoardSnapshot(spec, templateFor);
    return root ? capture.capture(root) : null;
  } catch {
    return null;
  } finally {
    capture.dispose();
  }
}

/**
 * Caches one preview keyed by a board token (its serialized form): the
 * snapshot is regenerated only when the token changes.
 */
export function createBoardPreviewCache(
  tokenOf: () => string | null,
  generate: () => string | null,
): () => string | null {
  let initialized = false;
  let token: string | null = null;
  let preview: string | null = null;
  return () => {
    const current = tokenOf();
    if (!initialized || current !== token) {
      initialized = true;
      token = current;
      preview = generate();
    }
    return preview;
  };
}
