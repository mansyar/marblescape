import { MARBLE_PALETTE } from "../domain/physics-config";

/** Hard cap on flying confetti pieces per shower (spec FR2). */
export const CONFETTI_MAX_PIECES = 120;
/** Auto-cleanup deadline: every piece is gone by then (spec FR2 ~2.5 s). */
export const CONFETTI_DURATION_MS = 2500;
/** Test hook for the Playwright suite. */
export const CONFETTI_TESTID = "confetti-layer";

const DEFAULT_PIECE_COUNT = 100;
const GLOW_DURATION_MS = CONFETTI_DURATION_MS - 600;

export interface ConfettiPiece {
  /** Horizontal start, percent of viewport width. */
  left: number;
  /** Vertical start, percent of viewport height (slightly above the top). */
  top: number;
  /** Horizontal drift in px. */
  dx: number;
  /** Fall distance in vh. */
  dy: number;
  /** End rotation in degrees. */
  rotation: number;
  delayMs: number;
  durationMs: number;
  color: string;
}

/**
 * Piece specs for one shower: bounded by CONFETTI_MAX_PIECES and fully
 * deterministic when a seeded rng is injected (unit tests).
 */
export function confettiPieces(count: number, rng: () => number = Math.random): ConfettiPiece[] {
  const safe = Number.isFinite(count) ? Math.floor(count) : 0;
  const total = Math.max(0, Math.min(CONFETTI_MAX_PIECES, safe));
  const pieces: ConfettiPiece[] = [];
  for (let i = 0; i < total; i += 1) {
    pieces.push({
      left: rng() * 100,
      top: -10 - rng() * 5,
      dx: (rng() - 0.5) * 160,
      dy: 70 + rng() * 50,
      rotation: (rng() - 0.5) * 1080,
      delayMs: rng() * 250,
      durationMs: 1500 + rng() * 700, // ≤2.2 s so delay + duration fits the cleanup window
      color: MARBLE_PALETTE[Math.floor(rng() * MARBLE_PALETTE.length)] ?? "#ffffff",
    });
  }
  return pieces;
}

export interface ConfettiLayerOptions {
  reducedMotion?: boolean;
  pieceCount?: number;
}

export interface ConfettiLayerHandle {
  el: HTMLElement;
  /** Fires one shower; a second call replaces the previous one. */
  burst(): void;
  setReducedMotion(on: boolean): void;
  dispose(): void;
}

/**
 * DOM confetti layer: candy-colored pieces fall with a CSS keyframe
 * animation and are cleaned up together after CONFETTI_DURATION_MS.
 * Reduced motion gets a single soft glow flash instead of flying pieces.
 */
export function createConfettiLayer(
  host: HTMLElement,
  options: ConfettiLayerOptions = {},
): ConfettiLayerHandle {
  let reducedMotion = options.reducedMotion ?? false;
  const requestedCount = options.pieceCount ?? DEFAULT_PIECE_COUNT;
  let cleanupTimer: number | null = null;
  let effects: HTMLElement[] = [];
  let bursts = 0;

  const el = document.createElement("div");
  el.dataset.testid = CONFETTI_TESTID;
  el.style.cssText = [
    "position:fixed",
    "inset:0",
    "z-index:19",
    "pointer-events:none",
    "overflow:hidden",
  ].join(";");

  const styleEl = document.createElement("style");
  styleEl.textContent = [
    "@keyframes ms-confetti-fall{from{transform:translate(0,0) rotate(0deg);opacity:1}",
    "85%{opacity:1}",
    "to{transform:translate(var(--dx),var(--dy)) rotate(var(--rot));opacity:0}}",
    "@keyframes ms-confetti-glow{from{opacity:0.55;transform:scale(1)}to{opacity:0;transform:scale(1.35)}}",
  ].join("");
  el.appendChild(styleEl);
  host.appendChild(el);

  function clearEffects(): void {
    for (const node of effects) {
      node.remove();
    }
    effects = [];
  }

  function burst(): void {
    bursts += 1;
    el.dataset.bursts = String(bursts);
    clearEffects();
    if (reducedMotion) {
      const glow = document.createElement("div");
      glow.dataset.confetti = "glow";
      glow.style.cssText = [
        "position:absolute",
        "left:50%",
        "top:50%",
        "width:46vmin",
        "height:46vmin",
        "margin:-23vmin",
        "border-radius:50%",
        "background:radial-gradient(circle,#ffffff88 0%,#06d6a066 45%,transparent 70%)",
        `animation:ms-confetti-glow ${GLOW_DURATION_MS}ms ease-out forwards`,
      ].join(";");
      el.appendChild(glow);
      effects.push(glow);
    } else {
      for (const piece of confettiPieces(requestedCount)) {
        const node = document.createElement("div");
        node.dataset.confetti = "piece";
        node.style.cssText = [
          "position:absolute",
          `left:${piece.left}%`,
          `top:${piece.top}%`,
          "width:10px",
          "height:14px",
          "border-radius:2px",
          `background-color:${piece.color}`,
          `animation:ms-confetti-fall ${piece.durationMs}ms ease-in ${piece.delayMs}ms forwards`,
        ].join(";");
        node.style.setProperty("--dx", `${piece.dx.toFixed(1)}px`);
        node.style.setProperty("--dy", `${piece.dy.toFixed(1)}vh`);
        node.style.setProperty("--rot", `${piece.rotation.toFixed(0)}deg`);
        el.appendChild(node);
        effects.push(node);
      }
    }
    if (cleanupTimer !== null) {
      clearTimeout(cleanupTimer);
    }
    cleanupTimer = setTimeout(() => {
      cleanupTimer = null;
      clearEffects();
    }, CONFETTI_DURATION_MS) as unknown as number; // Node types say Timeout; the browser returns a numeric id
  }

  return {
    el,
    burst,
    setReducedMotion(on: boolean) {
      reducedMotion = on;
    },
    dispose() {
      if (cleanupTimer !== null) {
        clearTimeout(cleanupTimer);
        cleanupTimer = null;
      }
      clearEffects();
      el.remove();
    },
  };
}
