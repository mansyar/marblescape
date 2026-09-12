import * as THREE from "three";
import { CONNECTIONS, PIECE_TYPES, type PieceType } from "../domain/pieces";
import { addLighting } from "./board";
import { CAMERA_ELEVATION_DEG, CAMERA_FOV_DEG } from "./framing";

/** Square snapshot edge in pixels: crisp at 2x DPR for the 72px palette tiles. */
export const THUMBNAIL_SIZE = 160;

/** Center point the snapshot camera frames on a single piece. */
const THUMBNAIL_LOOK_AT: [number, number, number] = [0, 0.15, 0];

/** Camera distance and azimuth for a three-quarter view of one piece. */
const THUMBNAIL_DISTANCE = 2.6;
const THUMBNAIL_AZIMUTH_DEG = 40;

/** Data-URL snapshots keyed by piece type; a missing type falls back to text. */
export type PieceThumbnails = Partial<Record<PieceType, string>>;

/** The small slice of THREE.WebGLRenderer the offscreen capture needs. */
export interface OffscreenGL {
  readonly domElement: { toDataURL: (type?: string) => string };
  setSize: (width: number, height: number) => void;
  setClearColor: (color: number, alpha: number) => void;
  render: (scene: THREE.Object3D, camera: THREE.Camera) => void;
  dispose: () => void;
}

/** Renders one object at a time and releases the renderer on dispose. */
export interface PieceCapture {
  /** Returns a PNG data URL of the object, or null when it cannot render. */
  capture: (object: THREE.Object3D) => string | null;
  dispose: () => void;
}

/**
 * Clones a template already posed as on the board at rotation 0: authored
 * yaw alignment, ramp pitch, and the same lift so the picture matches the
 * piece the player sees placed.
 */
export function createThumbnailClone(type: PieceType, template: THREE.Object3D): THREE.Object3D {
  const clone = template.clone(true);
  clone.rotation.order = "YXZ";
  clone.rotation.y = CONNECTIONS[type].modelYawOffset;
  const slope = CONNECTIONS[type].slope ?? 0;
  clone.rotation.x = slope;
  clone.position.y += slope > 0 ? 0.48 * Math.sin(slope) : 0;
  return clone;
}

/**
 * Renders one snapshot per loaded piece template in a single pass, then
 * disposes the offscreen renderer. Fault-tolerant by design: a type that
 * fails to render (or has no template) is omitted so its tile keeps the word
 * label; an empty record is returned when offscreen WebGL is unavailable.
 */
export function generatePieceThumbnails(
  templateFor: (type: PieceType) => THREE.Object3D | null,
  createCapture: () => PieceCapture = createWebGLCapture,
): PieceThumbnails {
  const capture = createCaptureSafely(createCapture);
  if (!capture) {
    return {};
  }
  const thumbnails: PieceThumbnails = {};
  try {
    for (const type of PIECE_TYPES) {
      const template = templateFor(type);
      if (!template) {
        continue;
      }
      try {
        const url = capture.capture(createThumbnailClone(type, template));
        if (url) {
          thumbnails[type] = url;
        }
      } catch {
        // Omit this type; its palette tile falls back to the word label.
      }
    }
  } finally {
    capture.dispose();
  }
  return thumbnails;
}

/** Builds the offscreen capture; `createGL` is injectable for tests. */
export function createWebGLCapture(createGL: () => OffscreenGL = defaultOffscreenGL): PieceCapture {
  const gl = createGL();
  gl.setSize(THUMBNAIL_SIZE, THUMBNAIL_SIZE);
  gl.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  addLighting(scene);
  const camera = createThumbnailCamera();

  return {
    capture(object) {
      scene.add(object);
      try {
        gl.render(scene, camera);
        return gl.domElement.toDataURL("image/png");
      } finally {
        scene.remove(object);
      }
    },
    dispose() {
      gl.dispose();
    },
  };
}

function createCaptureSafely(createCapture: () => PieceCapture): PieceCapture | null {
  try {
    return createCapture();
  } catch {
    // Headless / no-WebGL environments: palette tiles keep their text labels.
    return null;
  }
}

function createThumbnailCamera(): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(CAMERA_FOV_DEG, 1, 0.1, 50);
  const elevation = (CAMERA_ELEVATION_DEG * Math.PI) / 180;
  const azimuth = (THUMBNAIL_AZIMUTH_DEG * Math.PI) / 180;
  const horizontal = THUMBNAIL_DISTANCE * Math.cos(elevation);
  camera.position.set(
    horizontal * Math.sin(azimuth),
    THUMBNAIL_DISTANCE * Math.sin(elevation),
    horizontal * Math.cos(azimuth),
  );
  camera.lookAt(...THUMBNAIL_LOOK_AT);
  return camera;
}

function defaultOffscreenGL(): OffscreenGL {
  return new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
}
