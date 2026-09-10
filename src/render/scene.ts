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
export function startRenderer(container: HTMLElement): {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  getAspect: () => number;
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
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb);
  scene.add(buildBoard(BOARD_COLS, BOARD_ROWS));
  addLighting(scene);
  const camera = new THREE.PerspectiveCamera(CAMERA_FOV_DEG, 1, 0.1, 200);

  const applyFraming = () => {
    const width = container.clientWidth || 1;
    const height = container.clientHeight || 1;
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
  };
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
