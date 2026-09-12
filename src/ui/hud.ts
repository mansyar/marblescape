import type { Game } from "../game/game";
import { isSoundOn } from "../audio/prefs";
import { registerViewportResize } from "../render/resize";
import { layoutMode, type LayoutMode } from "./layout";

function button(label: string, bg: string): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.textContent = label;
  btn.style.cssText = `min-width:72px;min-height:64px;font-size:26px;font-weight:700;border-radius:14px;border:3px solid #2c3e50;background:${bg};color:#fff;touch-action:manipulation;`;
  return btn;
}

export interface HudHandle {
  bar: HTMLElement;
  /** The big ▶ button; the cue layer pulses it during first-run step 2. */
  play: HTMLButtonElement;
}

/**
 * Horizontal space the landscape palette rail occupies (a 72px tile column
 * plus the rail's padding) with a small breathing gap; the HUD slides left
 * by this much so its buttons never sit on top of a tile.
 */
export const LANDSCAPE_HUD_CLEARANCE_PX = 84;

/** Right-edge inset for the HUD bar; in landscape it clears the palette rail. */
export function hudRightInset(mode: LayoutMode): string {
  const safeArea = "max(10px, env(safe-area-inset-right))";
  return mode === "landscape" ? `calc(${safeArea} + ${LANDSCAPE_HUD_CLEARANCE_PX}px)` : safeArea;
}

/**
 * Top HUD: big Play button (drops marbles), mute toggle and board reset.
 * The mute preference persists and is applied to the game's audio manager.
 */
export function createHud(game: Game, container: HTMLElement, onHome?: () => void): HudHandle {
  const bar = document.createElement("div");
  bar.style.cssText = [
    "position:fixed;top:10px;right:max(10px, env(safe-area-inset-right))",
    "display:flex;gap:10px;z-index:10",
  ].join(";");

  // Keep the bar clear of the right-side palette rail in landscape (the rail's
  // top tile would otherwise sit underneath the ♻ button on short viewports).
  const applyBarPlacement = () => {
    bar.style.right = hudRightInset(layoutMode(window.innerWidth, window.innerHeight).mode);
  };
  applyBarPlacement();
  registerViewportResize(window, applyBarPlacement);

  const home = button("🏠", "#073b4c");
  home.dataset.testid = "hud-home";
  home.addEventListener("click", () => onHome?.());

  const play = button("▶", "#06d6a0");
  play.style.flex = "0 0 auto";
  play.addEventListener("click", () => {
    void game.initAudio();
    game.play();
  });

  const mute = button(isSoundOn(localStorage) ? "🔊" : "🔇", "#118ab2");
  mute.addEventListener("click", () => {
    const on = !isSoundOn(localStorage);
    game.setSoundOn(on);
    mute.textContent = on ? "🔊" : "🔇";
  });

  const reset = button("♻", "#ef476f");
  reset.addEventListener("click", () => game.reset());

  bar.append(home, play, mute, reset);
  container.appendChild(bar);
  return { bar, play };
}
