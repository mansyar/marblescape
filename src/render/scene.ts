import * as THREE from "three";
import { addLighting, buildBoard } from "./board";
import { BOARD_COLS, BOARD_ROWS, CAMERA_FOV_DEG, computeCameraFraming } from "./framing";

/**
 * Boots the fixed-camera diorama: renderer, perspective camera and a resize
 * handler that re-frames the board whenever the viewport changes.
 * The camera never moves during play (spec FR-4); only distance re-computes
 * on viewport resize so the board always fits.
 */
export function startRenderer(container: HTMLElement): {
  dispose: () => void;
  onFrame: (cb: (elapsed: number) => void) => void;
} {
  const canvas = document.createElement("canvas");
  canvas.style.display = "block";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
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
    const framing = computeCameraFraming(camera.aspect);
    camera.position.set(...framing.position);
    camera.lookAt(...framing.lookAt);
    camera.updateProjectionMatrix();
  };
  applyFraming();

  const observer = new ResizeObserver(applyFraming);
  observer.observe(container);

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
    dispose: () => {
      observer.disconnect();
      renderer.setAnimationLoop(null);
      renderer.dispose();
      canvas.remove();
    },
    onFrame: (cb: (elapsed: number) => void) => {
      frameCallbacks.push(cb);
    },
  };
}
