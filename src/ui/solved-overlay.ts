export const SOLVED_OVERLAY_TESTID = "solved-overlay";
export const SOLVED_REPLAY_TESTID = "solved-replay";

export interface SolvedOverlayHandlers {
  /** ▶ Play again: hide the overlay and re-run the same track. */
  onReplay: () => void;
  /** 🏠 Back to the level select. */
  onHome: () => void;
}

export interface SolvedOverlayHandle {
  el: HTMLElement;
  show(): void;
  hide(): void;
}

/**
 * Post-solve overlay: ✓ pulse, "Level solved!" and two big kid-sized buttons
 * (▶ replay the same track, 🏠 home). Styled to match the HUD.
 */
export function createSolvedOverlay(
  host: HTMLElement,
  handlers: SolvedOverlayHandlers,
): SolvedOverlayHandle {
  const el = document.createElement("div");
  el.dataset.testid = SOLVED_OVERLAY_TESTID;
  el.style.cssText =
    "position:fixed;inset:0;z-index:18;display:none;align-items:center;justify-content:center;flex-direction:column;gap:24px;background:rgba(20,30,40,0.55)";

  const check = document.createElement("div");
  check.textContent = "✓";
  check.style.cssText =
    "width:112px;height:112px;border-radius:50%;background:#06d6a0;color:#fff;font-size:64px;font-weight:800;display:flex;align-items:center;justify-content:center;animation:ms-pop 0.5s ease-out;box-shadow:0 8px 24px rgba(6,214,160,0.6)";

  const label = document.createElement("div");
  label.textContent = "Level solved!";
  label.style.cssText = "color:#f8f3e9;font-size:28px;font-weight:700";

  const row = document.createElement("div");
  row.style.cssText = "display:flex;gap:24px";

  const replay = document.createElement("button");
  replay.dataset.testid = SOLVED_REPLAY_TESTID;
  replay.textContent = "▶";
  replay.setAttribute("aria-label", "Play again");
  replay.style.cssText =
    "min-width:112px;min-height:112px;font-size:52px;border-radius:24px;border:3px solid #2c3e50;background:#06d6a0;touch-action:manipulation";
  replay.addEventListener("click", () => handlers.onReplay());

  const home = document.createElement("button");
  home.textContent = "🏠";
  home.setAttribute("aria-label", "Back to level select");
  home.style.cssText =
    "min-width:112px;min-height:112px;font-size:52px;border-radius:24px;border:3px solid #2c3e50;background:#073b4c;touch-action:manipulation";
  home.addEventListener("click", () => handlers.onHome());

  row.append(replay, home);
  el.append(check, label, row);
  host.appendChild(el);

  return {
    el,
    show() {
      el.style.display = "flex";
    },
    hide() {
      el.style.display = "none";
    },
  };
}
