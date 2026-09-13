import * as THREE from "three";
import { addLighting, buildBoard } from "./board";
import { BOARD_COLS, BOARD_ROWS, CAMERA_FOV_DEG, computeCameraFraming } from "./framing";
import { registerViewportResize } from "./resize";
import { cameraReservation } from "../ui/layout";

/**
 * Boots the fixed-camera diorama: renderer, perspective camera and a
 * debounced viewport watcher that re-frames the board whenever the window
 * resizes or rotates (including iPad Split View).
 * The camera never moves during play (spec FR-4); only distance re-computes
 * on viewport resize so the board always fits the space left by UI chrome.
 */
/** The renderer surface the shared framing path needs (stubbed in tests). */
export interface FramingRenderer {
  setSize(width: number, height: number, updateStyle?: boolean): void;
  setPixelRatio(ratio: number): void;
}

/** Composes the device pixel ratio with a quality tier's cap; junk falls back to 1. */
export function effectivePixelRatio(devicePixelRatio: number, dprCap: number): number {
  const device = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
  const cap = Number.isFinite(dprCap) && dprCap >= 1 ? dprCap : 1;
  return Math.min(device, cap);
}

/**
 * Shared framing application: viewport size, quality-capped pixel ratio and
 * the fixed-camera fit in one place, so resize, orientation, monitor changes
 * and quality-tier switches all flow through the exact same path.
 * Pure apart from its handles — unit tests drive it with a stub renderer.
 */
export function applyRendererFraming(
  renderer: FramingRenderer,
  camera: THREE.PerspectiveCamera,
  container: { clientWidth: number; clientHeight: number },
  devicePixelRatio: number,
  dprCap: number,
): void {
  const width = container.clientWidth || 1;
  const height = container.clientHeight || 1;
  renderer.setPixelRatio(effectivePixelRatio(devicePixelRatio, dprCap));
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  const reserved = cameraReservation(width, height);
  const framing = computeCameraFraming(
    camera.aspect,
    BOARD_COLS,
    BOARD_ROWS,
    CAMERA_FOV_DEG,
    reserved,
  );
  camera.position.set(...framing.position);
  camera.lookAt(...framing.lookAt);
  camera.updateProjectionMatrix();
}

export function startRenderer(container: HTMLElement): {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  getAspect: () => number;
  /** Applies a quality tier's pixel-ratio cap immediately (spec FR2). */
  setDprCap: (cap: number) => void;
  dispose: () => void;
  onFrame: (cb: (elapsed: number) => void) => void;
} {
  const canvas = document.createElement("canvas");
  canvas.style.display = "block";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  // Touch devices: the browser must not claim drags for page scrolling —
  // that fires pointercancel and kills piece drags mid-gesture.
  canvas.style.touchAction = "none";
  canvas.style.userSelect = "none";
  container.appendChild(canvas);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  /** Quality tier's dpr cap; the shared framing path applies it every pass. */
  let dprCap = 2;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb);
  scene.add(buildBoard(BOARD_COLS, BOARD_ROWS));
  addLighting(scene);
  const camera = new THREE.PerspectiveCamera(CAMERA_FOV_DEG, 1, 0.1, 200);

  const applyFraming = () =>
    applyRendererFraming(renderer, camera, container, window.devicePixelRatio, dprCap);
  applyFraming();

  const teardownResize = registerViewportResize(window, applyFraming);

  const frameCallbacks: Array<(elapsed: number) => void> = [];
  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const elapsed = clock.getElapsedTime();
    for (const cb of frameCallbacks) {
      cb(elapsed);
    }
    renderer.render(scene, camera);
  });

  return {
    scene,
    camera,
    getAspect: () => camera.aspect,
    setDprCap: (cap: number) => {
      dprCap = cap;
      renderer.setPixelRatio(effectivePixelRatio(window.devicePixelRatio, dprCap));
    },
    dispose: () => {
      teardownResize();
      renderer.setAnimationLoop(null);
      renderer.dispose();
      canvas.remove();
    },
    onFrame: (cb: (elapsed: number) => void) => {
      frameCallbacks.push(cb);
    },
  };
}
