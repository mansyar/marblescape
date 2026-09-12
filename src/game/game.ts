import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import RAPIER from "@dimforge/rapier3d-compat";
import { impactParams, MIN_IMPACT_FORCE, selectImpactSound } from "../audio/impact-sounds";
import { IMPACT_COOLDOWN_MS, ImpactThrottler } from "../audio/impact-throttle";
import { RollVoices } from "../audio/roll";
import { playChime } from "../audio/chime";
import { playSettleCue } from "../audio/settle-cue";
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
import { openCupKeys } from "../domain/cup-lids";
import { FIRST_RUN_LAYOUT } from "../domain/first-run";
import { getLevel, nextScriptedColor } from "../domain/levels";
import { isLevelComplete, markSolved } from "../domain/solve";
import type { PieceType, Rotation } from "../domain/pieces";
import { CONNECTIONS, rotate } from "../domain/pieces";
import { PIECE_TYPES } from "../domain/pieces";
import {
  boardFor,
  createPuzzle,
  gapAt,
  move as puzzleMove,
  place as puzzlePlace,
  placementAt,
  remove as puzzleRemove,
  reset as puzzleReset,
  rotate as puzzleRotate,
  type PuzzleState,
} from "../domain/puzzle";
import {
  buildBoardBodies,
  syncFloorBodies,
  syncPieceBodies,
  type PieceBodyEntry,
} from "../physics/board-bodies";
import { MarbleManager } from "../physics/marbles";
import { colorHex, MARBLE_COLORS, nextMarbleColor, type MarbleColor } from "../domain/colors";
import { PHYSICS } from "../domain/physics-config";
import { createFixedStepLoop } from "../physics/fixed-step-loop";
import { createPhysicsWorld, initPhysics, stepWorld, type World } from "../physics/world";
import { CupGlow, glowIntensityFor } from "../render/cup-glow";
import { disposeFadeMesh, MarbleFader } from "../render/marble-fade";
import { MarbleGleam } from "../render/marble-gleam";
import { MarbleShadows } from "../render/marble-shadow";
import { PieceJuice } from "../render/piece-juice";
import { cupTintTarget, PieceRenderer, rotationYaw } from "../render/piece-view";
import { worldToScreen } from "../render/projection";
import { startRenderer } from "../render/scene";
import { SparkleSystem } from "../render/sparkles";
import { createTrophyTray, type TrophyTray } from "../render/trophies";
import { createWaitingMarble, type WaitingMarble } from "../render/waiting-marble";
import { BOARD_COLS, BOARD_ROWS } from "../render/framing";
import { CUP_BURST_HEIGHT } from "./celebration";

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
  private readonly marbleFades = new MarbleFader();
  private shadows: MarbleShadows | null = null;
  private gleam: MarbleGleam | null = null;
  private cupGlow: CupGlow | null = null;
  /** Last glow intensity per cup cell — Playwright hook only, never rendered. */
  private readonly cupGlowNow = new Map<number, number>();
  /** Reused per-frame buffer for glow retain calls (no allocations). */
  private readonly cupGlowSeen: THREE.Object3D[] = [];
  private popTweens: Array<{ mesh: THREE.Object3D; t: number }> = [];
  private highlight: THREE.Mesh | null = null;
  private sparkles: SparkleSystem | null = null;
  private waiting: WaitingMarble | null = null;
  private trophies: TrophyTray | null = null;
  private readonly juice = new PieceJuice();
  private board: BoardState;
  /** Non-null while a puzzle level is loaded; the sandbox board is parked in sandboxBoard. */
  private puzzle: PuzzleState | null = null;
  private sandboxBoard: BoardState | null = null;
  /** Child-chosen sandbox marble color (tap the chute); null = natural cycle. */
  private sandboxColor: MarbleColor | null = null;
  /** Color used by the sandbox color-cup palette tile. */
  private cupColor: MarbleColor = MARBLE_COLORS[0];
  private reducedMotion = false;

  /** Fired each time a marble lands in the goal cup while in level mode. */
  onLevelSolved: ((levelId: number) => void) | null = null;
  /** Fired after each successful sandbox placement (first-run cues). */
  onPiecePlaced: (() => void) | null = null;
  /** Fired on every Play press, in any mode (first-run completion). */
  onPlayed: (() => void) | null = null;
  private nextId = 1;
  private lastElapsed = -1;
  private sound: SoundManager | null = null;
  private audioCtx: AudioContext | null = null;
  private eventQueue: RAPIER.EventQueue | null = null;
  private readonly impactThrottler = new ImpactThrottler();
  private rolls: RollVoices | null = null;
  private floorBodies: RAPIER.RigidBody[] = [];
  private floorHolesKey: string | null = "init";
  private readonly collectedByColor = new Map<MarbleColor, number>();
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
    if (this.puzzle) {
      return; // never clobber the sandbox save while a level is loaded
    }
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
      // Resume the id counter past every restored id so new pieces never
      // collide with them (renderer meshes and physics bodies are keyed by id).
      this.nextId = this.board.pieces.reduce(
        (max, p) => Math.max(max, Number(p.id.slice(1)) + 1 || 1),
        1,
      );
    }
  }

  async start(): Promise<void> {
    const handle = startRenderer(this.container);
    this.rendererHandle = handle;

    // Collect-celebration sparkles ride on the scene; reduced-motion users
    // get the gentle pulse fallback and the setting is honored live.
    this.sparkles = new SparkleSystem(handle.scene);
    // The waiting marble (the next drop, hovering at the chute) also honors
    // reduced motion: it bobs gently, or stands perfectly still.
    this.waiting = createWaitingMarble(handle.scene);
    this.trophies = createTrophyTray(handle.scene);
    this.shadows = new MarbleShadows(handle.scene);
    this.gleam = new MarbleGleam(handle.scene);
    this.cupGlow = new CupGlow();
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    this.sparkles.setReducedMotion(reducedMotion.matches);
    this.waiting.setReducedMotion(reducedMotion.matches);
    this.reducedMotion = reducedMotion.matches;
    reducedMotion.addEventListener("change", (event) => {
      this.sparkles?.setReducedMotion(event.matches);
      this.waiting?.setReducedMotion(event.matches);
      this.reducedMotion = event.matches;
    });

    await initPhysics();
    const world = createPhysicsWorld();
    this.world = world;
    this.eventQueue = new RAPIER.EventQueue(true);
    this.ticker = createFixedStepLoop(
      PHYSICS.fixedTimeStep,
      () => {
        stepWorld(world, this.eventQueue);
        this.drainImpacts();
        this.updateRolls();
      },
      PHYSICS.maxSubSteps,
    );
    this.floorBodies = buildBoardBodies(world);
    this.marbles = new MarbleManager(world, {
      onCollected: (body, color) => {
        this.removeMarbleMesh(body);
        this.sound?.play("plonk", { rate: 1, volume: 0.9 });
        const cup = this.collectedCup(body);
        if (cup) {
          this.sparkles?.burstAt({ x: cup.x + 0.5, y: CUP_BURST_HEIGHT, z: cup.y + 0.5 });
          if (this.puzzle) {
            // The marble rests visibly in the cup it actually reached.
            this.trophies?.add({ x: cup.x, z: cup.y }, color);
          }
        }
        this.collectedByColor.set(color, (this.collectedByColor.get(color) ?? 0) + 1);
        if (this.puzzle) {
          // Sorting levels solve when their script is fully collected;
          // classic levels (no script) solve on any catch. Persist the
          // badge on the first solve; repeat solves celebrate again.
          if (isLevelComplete(this.puzzle.level, this.collectedByColor)) {
            markSolved(localStorage, this.puzzle.level.id);
            playChime(this.audioCtx);
            this.onLevelSolved?.(this.puzzle.level.id);
          }
        }
        // The collectible color advances: refresh which cups are open.
        this.refreshCupState();
      },
      onRescued: (body) => {
        this.removeMarbleMesh(body);
        // The board is empty again (rescue or stall): show the next marble.
        this.refreshCupState();
      },
      // A wandered leftover replaced by a fresh run retires its mesh too.
      onLost: (body) => this.removeMarbleMesh(body),
      // A table-cap recycle eases the oldest mesh out; the freshly dropped
      // marble stays live (spec FR1).
      onRecycled: (body) => this.fadeOutMarbleMesh(body),
      // Run over: a soft cue only when the run ended without a goal (the
      // plonk/chime cover success). Play itself never locks on settle.
      onRunSettled: (reason) => playSettleCue(this.audioCtx, reason, this.sound?.isMuted ?? true),
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
      const dt = this.lastElapsed >= 0 ? Math.min(elapsed - this.lastElapsed, 0.1) : 0;
      this.lastElapsed = elapsed;
      if (this.ticker) {
        this.ticker.update(elapsed);
      }
      this.marbles?.reap();
      this.syncMarbleMeshes();
      this.shadows?.update();
      this.gleam?.update(handle.camera);
      this.updateCupGlow(elapsed);
      this.stepPopTweens(dt);
      this.marbleFades.update(dt);
      this.juice.update(dt);
      this.sparkles?.update(dt);
      this.waiting?.update(elapsed);
    });
  }

  /**
   * Enters puzzle mode for a level: parks the sandbox board, loads the level's
   * furniture, and switches every interaction to gap-only placement.
   */
  enterLevel(id: number): boolean {
    if (this.puzzle) {
      return false;
    }
    const level = getLevel(id);
    if (!level) {
      return false;
    }
    this.sandboxBoard = this.board;
    this.puzzle = createPuzzle(level);
    this.board = boardFor(this.puzzle);
    this.collectedByColor.clear();
    this.syncPieces();
    return true;
  }

  /** Leaves puzzle mode and restores the sandbox board exactly as it was. */
  exitLevel(): void {
    if (!this.puzzle) {
      return;
    }
    this.puzzle = null;
    this.board = this.sandboxBoard ?? this.board;
    this.sandboxBoard = null;
    this.collectedByColor.clear();
    this.trophies?.clear();
    this.syncPieces();
  }

  /** The level id while in puzzle mode, otherwise null (sandbox). */
  currentLevelId(): number | null {
    return this.puzzle?.level.id ?? null;
  }

  /** Palette entries for the current mode; sandbox adds the color-cup tile. */
  currentPalette(): Array<{ type: PieceType; color?: MarbleColor }> {
    if (this.puzzle) {
      return this.puzzle.level.palette.map((type) => ({ type }));
    }
    return [...PIECE_TYPES.map((type) => ({ type })), { type: "goal", color: this.cupColor }];
  }

  /**
   * Places a piece of the given type at a cell (drag-from-palette target).
   * Colored goal cups accept an optional candy color; all other types ignore it.
   * Returns false when the cell is occupied or off-board (reject wiggle).
   */
  place(type: PieceType, cellX: number, cellY: number, color?: MarbleColor): boolean {
    if (this.puzzle) {
      const next = puzzlePlace(this.puzzle, type, cellX, cellY);
      if (next === this.puzzle) {
        return false;
      }
      this.puzzle = next;
      this.board = boardFor(next);
      this.syncPieces();
      const placed = placementAt(this.puzzle, cellX, cellY);
      if (placed) {
        this.snapBouncePiece(placed.id);
      }
      return true;
    }
    const piece: PlacedPiece = {
      id: `p${this.nextId++}`,
      type,
      rotation: 0 as Rotation,
      x: cellX,
      y: cellY,
    };
    if (color !== undefined && type === "goal") {
      piece.color = color;
    }
    try {
      this.board = placeTypedPiece(this.board, piece);
    } catch {
      return false;
    }
    this.syncPieces();
    this.snapBouncePiece(piece.id);
    this.onPiecePlaced?.();
    return true;
  }

  /** Tap-to-rotate: cycles a piece's rotation 90° per tap. */
  rotate(cellX: number, cellY: number): void {
    if (this.puzzle) {
      const existing = placementAt(this.puzzle, cellX, cellY);
      const mesh = existing ? (this.pieceRenderer?.meshFor(existing.id) ?? null) : null;
      const fromYaw = mesh?.rotation.y ?? 0;
      const next = puzzleRotate(this.puzzle, cellX, cellY);
      if (next === this.puzzle) {
        return;
      }
      this.puzzle = next;
      this.board = boardFor(next);
      this.syncPieces();
      const rotated = placementAt(this.puzzle, cellX, cellY);
      if (mesh && rotated) {
        this.juice.rotate(
          mesh,
          fromYaw,
          rotationYaw(rotated.rotation) + CONNECTIONS[rotated.type].modelYawOffset,
        );
      }
      this.sound?.play("tick", { rate: 1, volume: 0.4 });
      return;
    }
    const piece = this.pieceAt(cellX, cellY);
    if (!piece) {
      // Sandbox chute (the empty spawn cell): a tap cycles the waiting
      // marble's color. In levels the chute is fixed furniture: no-op.
      if (cellX === Math.floor(BOARD_COLS / 2) && cellY === 0) {
        this.cyclePreviewColor();
      }
      return;
    }
    if (piece.type === "goal") {
      // Colored cups are non-rotatable: a tap re-tints instead of spinning.
      this.cycleCupColor(cellX, cellY);
      return;
    }
    const rotated: PlacedPiece = {
      ...piece,
      rotation: rotate(piece.type, piece.rotation, 1),
    };
    if (rotated.rotation === piece.rotation) {
      return; // not rotatable: no spin, no tick
    }
    const mesh = this.pieceRenderer?.meshFor(piece.id) ?? null;
    const fromYaw = mesh?.rotation.y ?? 0;
    this.board = {
      ...this.board,
      pieces: this.board.pieces.map((p) => (p.id === piece.id ? rotated : p)),
    };
    this.syncPieces();
    if (mesh) {
      this.juice.rotate(
        mesh,
        fromYaw,
        rotationYaw(rotated.rotation) + CONNECTIONS[rotated.type].modelYawOffset,
      );
    }
    this.sound?.play("tick", { rate: 1, volume: 0.4 });
  }

  /** Removes the piece at a cell; returns the removed type (palette pop-back) or null. */
  remove(cellX: number, cellY: number): PieceType | null {
    if (this.puzzle) {
      const existing = placementAt(this.puzzle, cellX, cellY);
      if (!existing) {
        return null;
      }
      const next = puzzleRemove(this.puzzle, cellX, cellY);
      this.puzzle = next;
      this.board = boardFor(next);
      this.syncPieces();
      return existing.type;
    }
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
    if (this.puzzle) {
      const existing = placementAt(this.puzzle, cellX, cellY);
      if (!existing) {
        return null;
      }
      const mesh = this.pieceRenderer?.meshFor(existing.id);
      const removed = this.remove(cellX, cellY);
      if (mesh && this.rendererHandle) {
        const parent = this.rendererHandle.scene;
        parent.add(mesh);
        this.popTweens.push({ mesh, t: 0 });
      }
      return removed;
    }
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
    if (this.puzzle) {
      const next = puzzleMove(this.puzzle, fromX, fromY, toX, toY);
      if (next === this.puzzle) {
        return false;
      }
      this.puzzle = next;
      this.board = boardFor(next);
      this.syncPieces();
      const placed = placementAt(this.puzzle, toX, toY);
      if (placed) {
        this.snapBouncePiece(placed.id);
      }
      return true;
    }
    const piece = this.pieceAt(fromX, fromY);
    if (!piece || (fromX === toX && fromY === toY)) {
      return false;
    }
    if (!this.isPlaceable(toX, toY)) {
      return false;
    }
    // Re-place with UPDATED coordinates — the original piece object still
    // carries the from-cell coords, so passing it directly would put the
    // piece right back where it was.
    const moved = { ...piece, x: toX, y: toY };
    this.board = placeTypedPiece(removeTypedPiece(this.board, fromX, fromY), moved);
    this.syncPieces();
    this.snapBouncePiece(piece.id);
    return true;
  }

  /** Big Play button: drops a batch of marbles above the spawn cell. */
  play(color?: MarbleColor): void {
    if (this.puzzle) {
      const script = this.puzzle.level.marbleColors;
      const scripted = script ? nextScriptedColor(script, this.collectedByColor) : null;
      this.marbles?.spawnDrop(
        this.puzzle.level.spawn.x,
        this.puzzle.level.spawn.y,
        color ?? scripted ?? undefined,
      );
    } else {
      // Sandbox drops ride the cycled color when the child picked one (tap
      // on the chute), else the natural random sequence: peekColor() is
      // exactly this marble's color, so preview and drop never disagree.
      this.marbles?.spawnDrop(
        Math.floor(BOARD_COLS / 2),
        0,
        color ?? this.sandboxColor ?? undefined,
      );
    }
    // A live marble changes which cups are compatible: refresh lids/floors.
    this.refreshCupState();
    this.onPlayed?.();
  }

  /** Reset: clears placed pieces (marbles finish their run naturally). */
  reset(): void {
    if (this.puzzle) {
      this.puzzle = puzzleReset(this.puzzle);
      this.board = boardFor(this.puzzle);
      // Reset starts the level over: trophies and progress clear with it.
      this.trophies?.clear();
      this.collectedByColor.clear();
      this.syncPieces();
      return;
    }
    const pieces = [...this.board.pieces];
    for (const piece of pieces) {
      this.board = removeTypedPiece(this.board, piece.x, piece.y);
    }
    this.syncPieces();
  }

  /**
   * Sandbox chute tap: cycles the waiting marble's color (tick feedback).
   * Levels script their own marbles, so this is a no-op there.
   */
  cyclePreviewColor(): MarbleColor | null {
    if (this.puzzle || (this.marbles?.count ?? 0) > 0) {
      return null;
    }
    const next = nextMarbleColor(this.nextDropColor());
    this.sandboxColor = next;
    this.sound?.play("tick", { rate: 1, volume: 0.4 });
    this.syncWaiting();
    return next;
  }

  /** Tap a placed colored cup: cycles its candy color with tint feedback. */
  cycleCupColor(cellX: number, cellY: number): MarbleColor | null {
    const piece = this.pieceAt(cellX, cellY);
    if (piece?.type !== "goal" || piece.color === undefined) {
      return null;
    }
    const next = nextMarbleColor(piece.color);
    this.board = {
      ...this.board,
      pieces: this.board.pieces.map((p) => (p.id === piece.id ? { ...p, color: next } : p)),
    };
    this.syncPieces();
    this.sound?.play("tick", { rate: 1, volume: 0.4 });
    const mesh = this.pieceRenderer?.meshFor(piece.id);
    if (mesh && !this.reducedMotion) {
      this.juice.tintPulse(cupTintTarget(mesh));
    }
    return next;
  }

  /** Palette color-tile tap: advances the color new cups will wear. */
  cyclePaletteColor(): MarbleColor {
    this.cupColor = nextMarbleColor(this.cupColor);
    return this.cupColor;
  }

  /**
   * Tap raycast for the floating waiting marble: it hovers above the board,
   * so its screen spot lands past the board edge — cycle when it is hit.
   */
  tapWaitingMarble(ndcX: number, ndcY: number): boolean {
    const handle = this.rendererHandle;
    const waiting = this.waiting;
    if (!handle || !waiting || this.puzzle || !waiting.isVisible()) {
      return false;
    }
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), handle.camera);
    if (raycaster.intersectObject(waiting.mesh, false).length === 0) {
      return false;
    }
    return this.cyclePreviewColor() !== null;
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

  /**
   * First-run seed: places the starter track's ordinary sandbox pieces with
   * normal ids and saves immediately, so the welcome run survives a reload
   * exactly like any child-built board. Called once, only on a fresh start.
   */
  seedFirstRun(): void {
    for (const piece of FIRST_RUN_LAYOUT) {
      this.board = placeTypedPiece(this.board, {
        id: `p${this.nextId++}`,
        type: piece.type,
        rotation: piece.rotation,
        x: piece.x,
        y: piece.y,
        ...(piece.color !== undefined ? { color: piece.color } : {}),
      });
    }
    this.syncPieces();
    saveBoard(localStorage, this.board);
  }

  /** Screen-pixel anchor of a cell's center for DOM overlays (first-run cues). */
  cellToScreen(cellX: number, cellY: number): { x: number; y: number } | null {
    const handle = this.rendererHandle;
    if (!handle) {
      return null;
    }
    return worldToScreen(
      { x: cellX + 0.5, y: 0.35, z: cellY + 0.5 },
      handle.camera,
      this.container.clientWidth || 1,
      this.container.clientHeight || 1,
    );
  }

  /**
   * Invalid move feedback: the piece shakes side to side and answers with a
   * soft low tick, so the toy says "not there" without words.
   */
  rejectPiece(cell: { x: number; y: number } | null): void {
    const piece = cell ? this.pieceAt(cell.x, cell.y) : null;
    const mesh = piece ? this.pieceRenderer?.meshFor(piece.id) : null;
    if (mesh) {
      this.juice.wiggle(mesh);
    }
    this.sound?.play("tick", { rate: 0.7, volume: 0.5 });
  }

  /** Valid-drop pop for a piece that just landed (palette or re-place). */
  private snapBouncePiece(id: string): void {
    const mesh = this.pieceRenderer?.meshFor(id);
    if (mesh) {
      this.juice.snapBounce(mesh);
    }
  }

  /** Collect-celebration counter for the Playwright hooks. */
  burstCount(): number {
    return this.sparkles?.totalBurstCount ?? 0;
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

  /** Quiet table-cap recycles, distinct from fresh-run leftover clears (FR5). */
  recycledCount(): number {
    return this.marbles?.recycledCount ?? 0;
  }

  /** Active recycle fades; stays 0 under reduced motion (instant removal). */
  marbleFadeCount(): number {
    return this.marbleFades.activeCount;
  }

  /** Live marble positions for the Playwright hooks. */
  marblePositions(): Array<{ x: number; y: number; z: number }> {
    return (this.marbles?.all() ?? []).map((body) => {
      const t = body.translation();
      return { x: t.x, y: t.y, z: t.z };
    });
  }

  /** Live marble colors for the Playwright hooks. */
  marbleColors(): MarbleColor[] {
    return (this.marbles?.all() ?? []).map(
      (body) => this.marbles?.colorOf(body) ?? MARBLE_COLORS[0],
    );
  }

  /** Waiting-marble state for the Playwright hooks. */
  waitingVisible(): boolean {
    return this.waiting?.isVisible() ?? false;
  }

  waitingColor(): MarbleColor | null {
    return this.waiting?.isVisible() ? this.waiting.currentColor() : null;
  }

  /** Cup color at a cell for the Playwright hooks (level furniture included). */
  cupColorAt(cellX: number, cellY: number): MarbleColor | null {
    const piece = this.board.pieces.find((p) => p.x === cellX && p.y === cellY);
    return piece?.type === "goal" ? (piece.color ?? null) : null;
  }

  /** Last glow intensity applied to a cup (Playwright hook). */
  cupGlowAt(cellX: number, cellY: number): number {
    return this.cupGlowNow.get(cellY * this.board.width + cellX) ?? 0;
  }

  isPlaceable(cellX: number, cellY: number, type?: PieceType): boolean {
    if (this.puzzle) {
      // Drag feedback: an empty gap that accepts the dragged type (or any
      // empty gap when no type is given) is a valid landing spot.
      const gap = gapAt(this.puzzle, cellX, cellY);
      return (
        gap !== null &&
        !placementAt(this.puzzle, cellX, cellY) &&
        (type === undefined || gap.accepted.includes(type))
      );
    }
    if (cellX < 0 || cellX >= this.board.width || cellY < 0 || cellY >= this.board.height) {
      return false;
    }
    return this.board.cells[cellY * this.board.width + cellX] === null;
  }

  pieceAt(cellX: number, cellY: number): PlacedPiece | null {
    if (this.puzzle) {
      // Furniture is not interactive: only child-placed pieces can be
      // tapped/rotated/moved/removed in level mode.
      return placementAt(this.puzzle, cellX, cellY);
    }
    return this.board.pieces.find((p) => p.x === cellX && p.y === cellY) ?? null;
  }

  private syncPieces(): void {
    this.pieceRenderer?.sync(this.board.pieces);
    this.refreshCupState();
    this.scheduleSave();
  }

  /**
   * The cup state machine: a cup is open when it can currently collect —
   * classic cups always, colored cups only while they match the collectible
   * marble (the live marble in flight, else the next drop's color). Refreshes
   * piece lids, floor holes and marble collection targets together.
   */
  private refreshCupState(): void {
    const openKeys = openCupKeys(this.board.pieces, this.collectibleColor());
    if (this.world) {
      const pieces = this.board.pieces.map((p) =>
        p.type === "goal" && !openKeys.has(`${p.x},${p.y}`) ? { ...p, lid: "closed" as const } : p,
      );
      this.pieceBodies = syncPieceBodies(this.world, this.pieceBodies, pieces);
    }
    this.syncGoalBodies(openKeys);
    this.syncWaiting();
  }

  /** The color the next collection can match: live marble, else next drop. */
  private collectibleColor(): MarbleColor {
    const marbles = this.marbles;
    const live = marbles?.all()[0];
    if (marbles && live) {
      return marbles.colorOf(live);
    }
    return this.nextDropColor();
  }

  /**
   * Cup anticipation glow (spec FR4): compatible cups pulse softly and
   * brighten as a matching marble nears, peaking as it drops in. Same
   * compatibility rule as the lids; visual-only emissive writes per frame.
   */
  private updateCupGlow(elapsed: number): void {
    const glow = this.cupGlow;
    const marbles = this.marbles;
    const renderer = this.pieceRenderer;
    if (!glow || !marbles || !renderer) {
      return;
    }
    const collectible = this.collectibleColor();
    const live = marbles.all();
    // Reused buffer + cleared map: the per-frame glow path allocates nothing.
    const seen = this.cupGlowSeen;
    seen.length = 0;
    this.cupGlowNow.clear();
    for (const piece of this.board.pieces) {
      if (piece.type !== "goal") {
        continue;
      }
      const mesh = renderer.meshFor(piece.id);
      if (!mesh) {
        continue;
      }
      seen.push(mesh);
      const compatible = piece.color === undefined || piece.color === collectible;
      let distance: number | null = null;
      if (compatible) {
        for (const body of live) {
          if (piece.color !== undefined && marbles.colorOf(body) !== piece.color) {
            continue;
          }
          const t = body.translation();
          const d = Math.hypot(t.x - (piece.x + 0.5), t.z - (piece.y + 0.5));
          if (distance === null || d < distance) {
            distance = d;
          }
        }
      }
      const amount = glowIntensityFor(compatible, distance, elapsed, this.reducedMotion);
      glow.apply(mesh, amount);
      this.cupGlowNow.set(piece.y * this.board.width + piece.x, amount);
    }
    glow.retain(seen);
  }

  /** The color the next Play drops (scripted in levels, cycle in sandbox). */
  private nextDropColor(): MarbleColor {
    const script = this.puzzle?.level.marbleColors;
    if (script) {
      return (
        nextScriptedColor(script, this.collectedByColor) ??
        this.marbles?.peekColor() ??
        MARBLE_COLORS[0]
      );
    }
    return this.sandboxColor ?? this.marbles?.peekColor() ?? MARBLE_COLORS[0];
  }

  /**
   * Shows the waiting marble at the chute wearing the next drop's color
   * while no marble is live; hides it during a run.
   */
  private syncWaiting(): void {
    if (!this.waiting) {
      return;
    }
    const marbles = this.marbles;
    if (!marbles || marbles.count > 0) {
      this.waiting.setVisible(false);
      return;
    }
    const spawn = this.puzzle ? this.puzzle.level.spawn : { x: Math.floor(BOARD_COLS / 2), y: 0 };
    this.waiting.setCell(spawn.x, spawn.y);
    this.waiting.setColor(this.nextDropColor());
    this.waiting.setVisible(true);
  }

  /** The cup the marble actually fell into (sparkle + trophy anchor). */
  private collectedCup(body: RAPIER.RigidBody): PlacedPiece | null {
    const t = body.translation();
    return (
      this.board.pieces.find(
        (p) =>
          p.type === "goal" &&
          Math.abs(t.x - (p.x + 0.5)) < 0.5 &&
          Math.abs(t.z - (p.y + 0.5)) < 0.5,
      ) ?? null
    );
  }

  /** Opens holes under the open cups and points collection at them. */
  private syncGoalBodies(openKeys: Set<string>): void {
    const openCups = this.board.pieces.filter(
      (p) => p.type === "goal" && openKeys.has(`${p.x},${p.y}`),
    );
    const holes = openCups.map((p) => ({ x: p.x, z: p.y }));
    const key = holes.map((hole) => `${hole.x},${hole.z}`).join("|");
    if (key !== this.floorHolesKey) {
      this.floorHolesKey = key;
      if (this.world) {
        this.floorBodies = syncFloorBodies(this.world, this.floorBodies, holes);
      }
    }
    if (this.marbles) {
      this.marbles.setGoalCells(openCups.map((p) => ({ x: p.x, z: p.y, color: p.color ?? null })));
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
      this.sound.load("roll", "/sounds/roll.ogg"),
    ]);
    this.sound.setMuted(!isSoundOn(localStorage));
    this.rolls = new RollVoices({
      create: () => {
        const voice = this.sound?.loop("roll");
        if (!voice) {
          throw new Error("roll sample not loaded");
        }
        return voice;
      },
    });
    this.rolls.setMuted(!isSoundOn(localStorage));
  }

  /** Mute toggle from the HUD; persists the preference. */
  setSoundOn(on: boolean): void {
    setSoundOn(on, localStorage);
    this.sound?.setMuted(!on);
    this.rolls?.setMuted(!on);
  }

  /** Feeds the roll voices with current marble speeds (one voice per marble). */
  private updateRolls(): void {
    if (!this.marbles || !this.rolls) {
      return;
    }
    const states = [];
    for (const body of this.marbles.all()) {
      const v = body.linvel();
      states.push({ marble: body, speed: Math.hypot(v.x, v.y, v.z) });
    }
    this.rolls.update(states);
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
      // Relative speed at contact drives pitch and loudness; gentle
      // low-speed ticks stay audible thanks to the lowered cutoff.
      const v1 = b1.linvel();
      const v2 = b2.linvel();
      const force = Math.hypot(v1.x - v2.x, v1.y - v2.y, v1.z - v2.z);
      if (force < MIN_IMPACT_FORCE) {
        return;
      }
      // Per-marble voice throttling: one marble's click no longer mutes
      // the others during pile-ups (spec FR2).
      // Non-empty: name !== null above guarantees at least one marble.
      const involved = [b1, b2].filter((body) => marbles.has(body));
      const now = performance.now();
      if (
        !this.impactThrottler.shouldPlay(involved[0], now, IMPACT_COOLDOWN_MS, involved.slice(1))
      ) {
        return;
      }
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
          new THREE.MeshStandardMaterial({
            color: colorHex(this.marbles.colorOf(body)),
            roughness: 0.1,
          }),
        );
        mesh.castShadow = true;
        this.marbleMeshes.set(body, mesh);
        scene.add(mesh);
        this.shadows?.attach(mesh);
        this.gleam?.attach(mesh);
      }
      const t = body.translation();
      mesh.position.set(t.x, t.y, t.z);
    }
  }

  private removeMarbleMesh(body: object): void {
    const mesh = this.marbleMeshes.get(body);
    if (mesh) {
      this.shadows?.detach(mesh);
      this.gleam?.detach(mesh);
      disposeFadeMesh(mesh);
      this.marbleMeshes.delete(body);
    }
  }

  /**
   * Cap-driven recycle (spec FR1): detach the mesh from the live sync so it
   * eases out on its own — instantly under reduced motion.
   */
  private fadeOutMarbleMesh(body: object): void {
    const mesh = this.marbleMeshes.get(body);
    if (!mesh) {
      return;
    }
    this.marbleMeshes.delete(body);
    this.shadows?.detach(mesh);
    this.gleam?.detach(mesh);
    if (this.reducedMotion) {
      disposeFadeMesh(mesh);
      return;
    }
    this.marbleFades.start(mesh);
  }

  private stepPopTweens(dt: number): void {
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
