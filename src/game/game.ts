import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import RAPIER from "@dimforge/rapier3d-compat";
import { impactParams, selectImpactSound } from "../audio/impact-sounds";
import { isSoundOn, setSoundOn } from "../audio/prefs";
import { SoundManager } from "../audio/sound-manager";
import {
  createBoard,
  type BoardState,
  loadBoard,
  placeTypedPiece,
  removeTypedPiece,
  saveBoard,
  type PlacedPiece,
} from "../domain/board";
import type { PieceType, Rotation } from "../domain/pieces";
import { rotate } from "../domain/pieces";
import {
  buildBoardBodies,
  syncFloorBodies,
  syncPieceBodies,
  type PieceBodyEntry,
} from "../physics/board-bodies";
import { MarbleManager } from "../physics/marbles";
import { PHYSICS } from "../domain/physics-config";
import { createFixedStepLoop } from "../physics/fixed-step-loop";
import { createPhysicsWorld, initPhysics, stepWorld, type World } from "../physics/world";
import { PieceRenderer } from "../render/piece-view";
import { startRenderer } from "../render/scene";
import { BOARD_COLS, BOARD_ROWS } from "../render/framing";

/**
 * Game orchestrator: owns board state, physics world and rendering, and
 * exposes the child-facing vocabulary: place / rotate / remove / play.
 */
export class Game {
  private readonly container: HTMLElement;
  private rendererHandle: ReturnType<typeof startRenderer> | null = null;
  private world: World | null = null;
  private ticker: ReturnType<typeof createFixedStepLoop> | null = null;
  private marbles: MarbleManager | null = null;
  private pieceRenderer: PieceRenderer | null = null;
  private pieceBodies = new Map<string, PieceBodyEntry>();
  private marbleMeshes = new Map<object, THREE.Mesh>();
  private popTweens: Array<{ mesh: THREE.Object3D; t: number }> = [];
  private highlight: THREE.Mesh | null = null;
  private board: BoardState;
  private nextId = 1;
  private lastElapsed = -1;
  private sound: SoundManager | null = null;
  private audioCtx: AudioContext | null = null;
  private eventQueue: RAPIER.EventQueue | null = null;
  private lastImpactAt = 0;
  private floorBodies: RAPIER.RigidBody[] = [];
  private floorGoal: string | null = "init";
  private saveTimer: number | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    this.board = createBoard(BOARD_COLS, BOARD_ROWS);
  }

  /**
   * Auto-save: persists the board after every change (debounced). Uses the
   * Phase 2 serializer; corrupt storage is forgiven with a fresh board.
   */
  private scheduleSave(): void {
    if (this.saveTimer !== null) {
      clearTimeout(this.saveTimer);
    }
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      if (this.board) {
        saveBoard(localStorage, this.board);
      }
    }, 400) as unknown as number;
  }

  private restore(): void {
    const loaded = loadBoard(localStorage);
    if (loaded) {
      this.board = loaded;
    }
  }

  async start(): Promise<void> {
    const handle = startRenderer(this.container);
    this.rendererHandle = handle;

    await initPhysics();
    const world = createPhysicsWorld();
    this.world = world;
    this.eventQueue = new RAPIER.EventQueue(true);
    this.ticker = createFixedStepLoop(
      PHYSICS.fixedTimeStep,
      () => {
        stepWorld(world, this.eventQueue);
        this.drainImpacts();
      },
      PHYSICS.maxSubSteps,
    );
    this.floorBodies = buildBoardBodies(world);
    this.marbles = new MarbleManager(world, {
      onCollected: (body) => {
        this.removeMarbleMesh(body);
        this.sound?.play("plonk", { rate: 1, volume: 0.9 });
      },
      onRescued: (body) => this.removeMarbleMesh(body),
    });

    const pieceGroup = new THREE.Group();
    handle.scene.add(pieceGroup);
    this.pieceRenderer = new PieceRenderer(pieceGroup, new GLTFLoader());
    await this.pieceRenderer.loadTemplates();

    // Resume the saved sandbox layout (corrupt storage → fresh board).
    this.restore();
    this.syncPieces();

    this.highlight = new THREE.Mesh(
      new THREE.PlaneGeometry(0.96, 0.96),
      new THREE.MeshBasicMaterial({ color: 0x2ecc71, transparent: true, opacity: 0.45 }),
    );
    this.highlight.rotation.x = -Math.PI / 2;
    this.highlight.position.y = 0.02;
    this.highlight.visible = false;
    handle.scene.add(this.highlight);

    handle.onFrame((elapsed) => {
      if (this.ticker) {
        this.ticker.update(elapsed);
      }
      this.marbles?.reap();
      this.syncMarbleMeshes();
      this.stepPopTweens(elapsed);
    });
  }

  /**
   * Places a piece of the given type at a cell (drag-from-palette target).
   * Returns false when the cell is occupied or off-board (reject wiggle).
   */
  place(type: PieceType, cellX: number, cellY: number): boolean {
    const piece: PlacedPiece = {
      id: `p${this.nextId++}`,
      type,
      rotation: 0 as Rotation,
      x: cellX,
      y: cellY,
    };
    try {
      this.board = placeTypedPiece(this.board, piece);
    } catch {
      return false;
    }
    this.syncPieces();
    return true;
  }

  /** Tap-to-rotate: cycles a piece's rotation 90° per tap. */
  rotate(cellX: number, cellY: number): void {
    const piece = this.pieceAt(cellX, cellY);
    if (!piece) {
      return;
    }
    const rotated: PlacedPiece = {
      ...piece,
      rotation: rotate(piece.type, piece.rotation, 1),
    };
    this.board = {
      ...this.board,
      pieces: this.board.pieces.map((p) => (p.id === piece.id ? rotated : p)),
    };
    this.syncPieces();
  }

  /** Removes the piece at a cell; returns the removed type (palette pop-back) or null. */
  remove(cellX: number, cellY: number): PieceType | null {
    const piece = this.pieceAt(cellX, cellY);
    if (!piece) {
      return null;
    }
    this.board = removeTypedPiece(this.board, cellX, cellY);
    this.syncPieces();
    return piece.type;
  }

  /**
   * Drag-off-board delete: removes the piece and plays a quick shrink
   * "pop-back" before it returns home to the palette.
   */
  popOut(cellX: number, cellY: number): PieceType | null {
    const piece = this.pieceAt(cellX, cellY);
    if (!piece) {
      return null;
    }
    const mesh = this.pieceRenderer?.meshFor(piece.id);
    const removed = this.remove(cellX, cellY);
    if (mesh && this.rendererHandle) {
      // sync() detached the mesh; re-attach for a short shrink animation.
      const parent = this.rendererHandle.scene;
      parent.add(mesh);
      this.popTweens.push({ mesh, t: 0 });
    }
    return removed;
  }

  /** Hold-drag-to-move: relocates a piece, keeping its id/type/rotation. */
  move(fromX: number, fromY: number, toX: number, toY: number): boolean {
    const piece = this.pieceAt(fromX, fromY);
    if (!piece || (fromX === toX && fromY === toY)) {
      return false;
    }
    if (!this.isPlaceable(toX, toY)) {
      return false;
    }
    this.board = placeTypedPiece(removeTypedPiece(this.board, fromX, fromY), piece);
    this.syncPieces();
    return true;
  }

  /** Big Play button: drops a batch of marbles above the spawn cell. */
  play(): void {
    this.marbles?.spawnDrop(Math.floor(BOARD_COLS / 2), 0);
  }

  /** Reset: clears all placed pieces (marbles finish their run naturally). */
  reset(): void {
    const pieces = [...this.board.pieces];
    for (const piece of pieces) {
      this.board = removeTypedPiece(this.board, piece.x, piece.y);
    }
    this.syncPieces();
  }

  /** Live drag feedback: shows the highlight at a cell, tinted by validity. */
  showHighlight(cell: { x: number; y: number } | null, valid: boolean): void {
    if (!this.highlight) {
      return;
    }
    if (!cell) {
      this.highlight.visible = false;
      return;
    }
    const material = this.highlight.material as THREE.MeshBasicMaterial;
    material.color.set(valid ? 0x2ecc71 : 0xe74c3c);
    this.highlight.position.x = cell.x + 0.5;
    this.highlight.position.z = cell.y + 0.5;
    this.highlight.visible = true;
  }

  hideHighlight(): void {
    this.showHighlight(null, false);
  }

  /** Marble bookkeeping for the Playwright reliability gate. */
  marbleCount(): number {
    return this.marbles?.count ?? 0;
  }

  collectedCount(): number {
    return this.marbles?.getCollected().length ?? 0;
  }

  rescuedCount(): number {
    return this.marbles?.getRescued().length ?? 0;
  }

  isPlaceable(cellX: number, cellY: number): boolean {
    if (cellX < 0 || cellX >= this.board.width || cellY < 0 || cellY >= this.board.height) {
      return false;
    }
    return this.board.cells[cellY * this.board.width + cellX] === null;
  }

  pieceAt(cellX: number, cellY: number): PlacedPiece | null {
    return this.board.pieces.find((p) => p.x === cellX && p.y === cellY) ?? null;
  }

  private syncPieces(): void {
    this.pieceRenderer?.sync(this.board.pieces);
    if (this.world) {
      this.pieceBodies = syncPieceBodies(this.world, this.pieceBodies, this.board.pieces);
    }
    this.updateGoalCell();
    this.scheduleSave();
  }

  /** Tells the marble manager where the goal hole is (collection footprint). */
  private updateGoalCell(): void {
    const goal = this.board.pieces.find((p) => p.type === "goal");
    const key = goal ? `${goal.x},${goal.y}` : null;
    if (key !== this.floorGoal) {
      this.floorGoal = key;
      if (this.world) {
        this.floorBodies = syncFloorBodies(
          this.world,
          this.floorBodies,
          goal ? { x: goal.x, z: goal.y } : null,
        );
      }
    }
    if (!this.marbles) {
      return;
    }
    if (goal) {
      this.marbles.setGoalCell(goal.x, goal.y);
    } else {
      this.marbles.setGoalCell(null);
    }
  }

  /** Lazily creates the audio graph; safe to call on every user interaction. */
  async initAudio(): Promise<void> {
    if (this.audioCtx) {
      if (this.audioCtx.state === "suspended") {
        await this.audioCtx.resume();
      }
      return;
    }
    try {
      this.audioCtx = new AudioContext();
    } catch {
      return;
    }
    this.sound = new SoundManager(this.audioCtx);
    await Promise.all([
      this.sound.load("clack", "/sounds/clack.ogg"),
      this.sound.load("tick", "/sounds/tick.ogg"),
      this.sound.load("plonk", "/sounds/plonk.ogg"),
    ]);
    this.sound.setMuted(!isSoundOn(localStorage));
  }

  /** Mute toggle from the HUD; persists the preference. */
  setSoundOn(on: boolean): void {
    setSoundOn(on, localStorage);
    this.sound?.setMuted(!on);
  }

  private drainImpacts(): void {
    if (!this.world || !this.eventQueue || !this.marbles || !this.sound) {
      return;
    }
    const world = this.world;
    const marbles = this.marbles;
    this.eventQueue.drainCollisionEvents((h1, h2, started) => {
      if (!started) {
        return;
      }
      const b1 = world.getCollider(h1)?.parent();
      const b2 = world.getCollider(h2)?.parent();
      if (!b1 || !b2) {
        return;
      }
      const name = selectImpactSound(marbles.has(b1), marbles.has(b2));
      if (!name) {
        return;
      }
      // Relative speed at contact drives pitch and loudness.
      const v1 = b1.linvel();
      const v2 = b2.linvel();
      const force = Math.hypot(v1.x - v2.x, v1.y - v2.y, v1.z - v2.z);
      if (force < 1) {
        return;
      }
      const now = performance.now();
      if (now - this.lastImpactAt < 60) {
        return; // avoid machine-gunning during pile-ups
      }
      this.lastImpactAt = now;
      this.sound?.play(name, impactParams(force));
    });
  }

  private syncMarbleMeshes(): void {
    const scene = this.rendererHandle?.scene;
    if (!this.marbles || !scene) {
      return;
    }
    for (const body of this.marbles.all()) {
      let mesh = this.marbleMeshes.get(body);
      if (!mesh) {
        mesh = new THREE.Mesh(
          new THREE.SphereGeometry(PHYSICS.marbleRadius, 24, 16),
          new THREE.MeshStandardMaterial({ color: this.marbles.colorOf(body), roughness: 0.15 }),
        );
        mesh.castShadow = true;
        this.marbleMeshes.set(body, mesh);
        scene.add(mesh);
      }
      const t = body.translation();
      mesh.position.set(t.x, t.y, t.z);
    }
  }

  private removeMarbleMesh(body: object): void {
    const mesh = this.marbleMeshes.get(body);
    if (mesh) {
      mesh.parent?.remove(mesh);
      mesh.geometry.dispose();
      this.marbleMeshes.delete(body);
    }
  }

  private stepPopTweens(elapsed: number): void {
    const dt = this.lastElapsed >= 0 ? Math.min(elapsed - this.lastElapsed, 0.1) : 0;
    this.lastElapsed = elapsed;
    const done: Array<{ mesh: THREE.Object3D; t: number }> = [];
    for (const tween of this.popTweens) {
      tween.t += dt / 0.25;
      if (tween.t >= 1) {
        tween.mesh.parent?.remove(tween.mesh);
        done.push(tween);
      } else {
        const s = Math.max(1 - tween.t, 0.01);
        tween.mesh.scale.set(s, s, s);
      }
    }
    for (const tween of done) {
      this.popTweens = this.popTweens.filter((t) => t !== tween);
    }
  }
}
