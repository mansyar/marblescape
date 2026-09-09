import type { Game } from "../game/game";
import { isSoundOn } from "../audio/prefs";

function button(label: string, bg: string): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.textContent = label;
  btn.style.cssText = `min-width:72px;min-height:64px;font-size:26px;font-weight:700;border-radius:14px;border:3px solid #2c3e50;background:${bg};color:#fff;touch-action:manipulation;`;
  return btn;
}

/**
 * Top HUD: big Play button (drops marbles), mute toggle and board reset.
 * The mute preference persists and is applied to the game's audio manager.
 */
export function createHud(game: Game, container: HTMLElement, onHome?: () => void): HTMLElement {
  const bar = document.createElement("div");
  bar.style.cssText = [
    "position:fixed;top:10px;right:max(10px, env(safe-area-inset-right))",
    "display:flex;gap:10px;z-index:10",
  ].join(";");

  const home = button("🏠", "#073b4c");
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
  return bar;
}
