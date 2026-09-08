import type { Game } from "../game/game";

const SOUND_KEY = "marblescape.sound";

function button(label: string, bg: string): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.textContent = label;
  btn.style.cssText = `min-width:72px;min-height:64px;font-size:26px;font-weight:700;border-radius:14px;border:3px solid #2c3e50;background:${bg};color:#fff;touch-action:manipulation;`;
  return btn;
}

/**
 * Top HUD: big Play button (drops marbles), mute toggle and board reset.
 * The mute flag persists under SOUND_KEY and is consumed by the audio
 * manager arriving in Phase 6.
 */
export function createHud(game: Game, container: HTMLElement): HTMLElement {
  const bar = document.createElement("div");
  bar.style.cssText = "position:fixed;top:10px;right:10px;display:flex;gap:10px;z-index:10;";

  const play = button("▶", "#06d6a0");
  play.addEventListener("click", () => game.play());

  const mute = button(localStorage.getItem(SOUND_KEY) === "off" ? "🔇" : "🔊", "#118ab2");
  mute.addEventListener("click", () => {
    const off = localStorage.getItem(SOUND_KEY) === "off";
    localStorage.setItem(SOUND_KEY, off ? "on" : "off");
    mute.textContent = off ? "🔊" : "🔇";
  });

  const reset = button("♻", "#ef476f");
  reset.addEventListener("click", () => game.reset());

  bar.append(play, mute, reset);
  container.appendChild(bar);
  return bar;
}
