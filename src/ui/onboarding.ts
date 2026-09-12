import {
  nextOnboardingStep,
  type OnboardingEvent,
  type OnboardingStep,
} from "../domain/onboarding";
import type { ScreenPoint } from "../render/projection";
import { registerViewportResize } from "../render/resize";
import { cuePresentation } from "./cue-config";
import { setTilePulse } from "./palette";

export interface CueAnchors {
  /** Screen-pixel anchor of the starter gap cell. */
  gap(): ScreenPoint | null;
  /** Screen-pixel anchor of the Ramp palette tile. */
  tile(): ScreenPoint | null;
  /** Screen-pixel anchor of the Play button. */
  play(): ScreenPoint | null;
}

export interface OnboardingCueOptions {
  /** The HUD's ▶ button; pulsed while step is "play". */
  playButton: HTMLElement;
  reducedMotion?: boolean;
  /** Cues are sandbox-only; e.g. hidden while a puzzle level is loaded. */
  isSandbox?: () => boolean;
}

export interface OnboardingCues {
  readonly el: HTMLElement;
  step(): OnboardingStep;
  /** Advances on real child actions; "play-pressed" completes from any step. */
  advance(event: OnboardingEvent): OnboardingStep;
  /** Fades the cues out for good (first Play, any mode). */
  complete(): void;
  /** Hidden while overlays are up; resumes otherwise. */
  setSuppressed(on: boolean): void;
  dispose(): void;
}

/** One full hand gesture loop (Ramp tile → gap → tap → back). */
const CYCLE_MS = 2600;

/** Injected cue styling; reduced motion keeps opacity-only pulses. */
function cueStyles(): string {
  return [
    "@keyframes ms-cue-ring{",
    "0%,100%{transform:scale(1);opacity:.6}",
    "50%{transform:scale(1.12);opacity:1}",
    "}",
    "@keyframes ms-cue-ring-soft{0%,100%{opacity:.6}50%{opacity:1}}",
    "@keyframes ms-cue-tap{0%,100%{transform:translateY(0)}50%{transform:translateY(6px)}}",
    "@keyframes ms-cue-play{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}",
    "@keyframes ms-cue-play-soft{0%,100%{opacity:1}50%{opacity:.6}}",
    ".ms-cue-ring{animation:ms-cue-ring 1.4s ease-in-out infinite}",
    ".ms-cue-tap{animation:ms-cue-tap 0.9s ease-in-out infinite}",
    '[data-onboarding="play"]{animation:ms-cue-play 1.1s ease-in-out infinite}',
    "@media (prefers-reduced-motion:reduce){",
    ".ms-cue-ring{animation-name:ms-cue-ring-soft}",
    ".ms-cue-tap{animation:none}",
    '[data-onboarding="play"]{animation-name:ms-cue-play-soft}',
    "}",
  ].join("");
}

/** Chunky ghost hand (palm + pointing finger), Kenney-ish flat style. */
function handSvg(): string {
  return [
    '<svg width="44" height="58" viewBox="0 0 44 58" xmlns="http://www.w3.org/2000/svg">',
    '<g stroke="#2c3e50" stroke-width="3" stroke-linejoin="round"',
    ' fill="rgba(255,255,255,0.92)">',
    '<rect x="16" y="20" width="24" height="32" rx="11"/>',
    '<rect x="17" y="6" width="11" height="26" rx="5.5"/>',
    "</g></svg>",
  ].join("");
}

/**
 * First-run cue layer: a passive, pointer-events-none DOM overlay with a
 * target ring at the starter gap and a looping ghost hand gesture. Cues
 * advance on real actions, hide in puzzle mode / under overlays, and fade
 * out for good on completion. Never involved in placement decisions.
 */
export function createOnboardingCues(
  container: HTMLElement,
  anchors: CueAnchors,
  options: OnboardingCueOptions,
): OnboardingCues {
  const reducedQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  let reduced = options.reducedMotion ?? reducedQuery.matches;
  let step: OnboardingStep = "place";
  let suppressed = false;
  let finished = false;

  const root = document.createElement("div");
  root.dataset.onboardingCues = "";
  root.dataset.onboardingStep = step;
  root.dataset.onboardingMotion = reduced ? "static" : "full";
  root.setAttribute("aria-hidden", "true");
  root.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:12;overflow:hidden";
  const style = document.createElement("style");
  style.textContent = cueStyles();
  root.appendChild(style);

  const ring = document.createElement("div");
  ring.dataset.onboarding = "ring";
  ring.style.cssText =
    "position:absolute;left:0;top:0;width:76px;height:76px;display:none;will-change:transform";
  const ringPulse = document.createElement("div");
  ringPulse.className = "ms-cue-ring";
  ringPulse.style.cssText = [
    "position:absolute;inset:0;border-radius:50%",
    "border:5px solid #06d6a0",
    "background:rgba(6,214,160,0.12)",
    "box-shadow:0 0 18px rgba(6,214,160,0.8)",
  ].join(";");
  ring.appendChild(ringPulse);

  const hand = document.createElement("div");
  hand.dataset.onboarding = "hand";
  hand.dataset.onboardingTarget = "gap";
  hand.style.cssText =
    "position:absolute;left:0;top:0;width:44px;height:58px;display:none;will-change:transform";
  const handArt = document.createElement("div");
  handArt.className = "ms-cue-tap";
  handArt.style.cssText = "position:absolute;inset:0";
  handArt.innerHTML = handSvg();
  hand.appendChild(handArt);

  root.append(ring, hand);
  container.appendChild(root);

  let gapPoint: ScreenPoint | null = null;
  let tilePoint: ScreenPoint | null = null;
  let playPoint: ScreenPoint | null = null;
  let cycleStart = performance.now();
  let rafId = 0;
  let intervalId = 0;
  let lastShow: boolean | null = null;
  let lastRing = "";
  let lastHand = "";

  const presentation = () => cuePresentation(step, reduced);

  function positionRing(): void {
    const p = presentation();
    if (!p.ringVisible || !gapPoint) {
      return;
    }
    const transform = `translate3d(${Math.round(gapPoint.x - 38)}px,${Math.round(
      gapPoint.y - 38,
    )}px,0)`;
    if (transform !== lastRing) {
      lastRing = transform;
      ring.style.transform = transform;
    }
  }

  const tapBob = (now: number): number => Math.sin(now / 130) * 3;

  const lerp = (a: ScreenPoint, b: ScreenPoint, k: number): ScreenPoint => ({
    x: a.x + (b.x - a.x) * k,
    y: a.y + (b.y - a.y) * k,
  });

  const smooth = (k: number): number => k * k * (3 - 2 * k);

  function positionHand(now: number): void {
    const p = presentation();
    if (!p.handVisible) {
      return;
    }
    let point: ScreenPoint | null = null;
    let bob = 0;
    if (reduced) {
      // Static hand: parked beside the Ramp tile (step 1) or at Play (step 2).
      point = p.handTarget === "tile" ? tilePoint : p.handTarget === "gap" ? gapPoint : playPoint;
    } else if (step === "place") {
      if (!tilePoint || !gapPoint) {
        return;
      }
      const t = ((now - cycleStart) / CYCLE_MS) % 1;
      if (t < 0.15) {
        point = tilePoint;
        bob = tapBob(now);
      } else if (t < 0.45) {
        point = lerp(tilePoint, gapPoint, smooth((t - 0.15) / 0.3));
      } else if (t < 0.8) {
        point = gapPoint;
        bob = tapBob(now);
      } else {
        point = lerp(gapPoint, tilePoint, smooth((t - 0.8) / 0.2));
      }
    } else {
      point = playPoint;
      bob = tapBob(now);
    }
    if (!point) {
      return;
    }
    const transform = `translate3d(${Math.round(point.x - 22)}px,${Math.round(
      point.y - 29 + bob,
    )}px,0)`;
    if (transform !== lastHand) {
      lastHand = transform;
      hand.style.transform = transform;
    }
  }

  function refreshAnchors(): void {
    gapPoint = anchors.gap();
    tilePoint = anchors.tile();
    playPoint = anchors.play();
    lastRing = "";
    lastHand = "";
    positionRing();
    positionHand(performance.now());
  }

  function syncVisibility(): void {
    const p = presentation();
    const show = p.visible && !suppressed && !finished && (options.isSandbox?.() ?? true);
    if (show !== lastShow) {
      lastShow = show;
      root.style.display = show ? "block" : "none";
      if (show) {
        refreshAnchors();
      }
    }
  }

  function apply(): void {
    const p = presentation();
    root.dataset.onboardingStep = step;
    root.dataset.onboardingMotion = reduced ? "static" : "full";
    ring.style.display = p.ringVisible ? "block" : "none";
    hand.style.display = p.handVisible ? "block" : "none";
    hand.dataset.onboardingTarget = p.handTarget;
    if (p.playPulse) {
      options.playButton.setAttribute("data-onboarding", "play");
    } else {
      options.playButton.removeAttribute("data-onboarding");
    }
    setTilePulse("straight", p.rampTilePulse);
    syncVisibility();
  }

  function frame(now: number): void {
    rafId = requestAnimationFrame(frame);
    if (lastShow !== true) {
      return;
    }
    if (now - cycleStart >= CYCLE_MS) {
      cycleStart = now;
      refreshAnchors();
      return;
    }
    positionRing();
    positionHand(now);
  }

  // Palette rebuilds (orientation changes) recreate the tiles, so the pulse
  // is re-applied while it should be on; visibility is polled for free.
  intervalId = window.setInterval(() => {
    if (finished) {
      return;
    }
    const p = presentation();
    if (p.rampTilePulse) {
      setTilePulse("straight", true);
    }
    if (p.playPulse && !options.playButton.hasAttribute("data-onboarding")) {
      options.playButton.setAttribute("data-onboarding", "play");
    }
    syncVisibility();
  }, 250);

  const teardownResize = registerViewportResize(window, () => refreshAnchors());

  const onMotionChange = (): void => {
    reduced = reducedQuery.matches;
    cycleStart = performance.now();
    apply();
    refreshAnchors();
  };
  reducedQuery.addEventListener("change", onMotionChange);

  function disposeRun(): void {
    if (rafId !== 0) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
    if (intervalId !== 0) {
      window.clearInterval(intervalId);
      intervalId = 0;
    }
    teardownResize();
    reducedQuery.removeEventListener("change", onMotionChange);
  }

  apply();
  rafId = requestAnimationFrame(frame);

  function advance(event: OnboardingEvent): OnboardingStep {
    if (finished) {
      return step;
    }
    step = nextOnboardingStep(step, event);
    cycleStart = performance.now();
    apply();
    refreshAnchors();
    return step;
  }

  function complete(): void {
    if (finished) {
      return;
    }
    finished = true;
    step = "done";
    root.dataset.onboardingStep = "done";
    root.dataset.onboardingMotion = reduced ? "static" : "full";
    setTilePulse("straight", false);
    options.playButton.removeAttribute("data-onboarding");
    root.style.transition = "opacity 0.4s ease";
    root.style.opacity = "0";
    window.setTimeout(() => {
      root.style.display = "none";
    }, 450);
    disposeRun();
  }

  function setSuppressed(on: boolean): void {
    suppressed = on;
    syncVisibility();
  }

  function dispose(): void {
    disposeRun();
    root.remove();
  }

  return {
    el: root,
    step: () => step,
    advance,
    complete,
    setSuppressed,
    dispose,
  };
}
