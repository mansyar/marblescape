import type { LevelDef } from "../domain/levels";
import { loadBadges } from "../domain/badges";

export type LevelSelectPick = number | "sandbox";

export interface LevelSelectHandle {
  el: HTMLElement;
  /** Re-reads badges from storage and refreshes the ✓ chips (e.g. after a solve). */
  refreshBadges(): void;
}

function tile(glyph: string, label: string, solved: boolean): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.dataset.levelSelect = label;
  btn.style.cssText = [
    "min-width:84px;min-height:84px;font-size:34px;font-weight:700",
    "border-radius:18px;border:3px solid #2c3e50;background:#ffd166;color:#2c3e50",
    "touch-action:manipulation;position:relative",
  ].join(";");
  btn.textContent = glyph;
  if (solved) {
    const chip = document.createElement("span");
    chip.textContent = "✓";
    chip.style.cssText = [
      "position:absolute;top:-10px;right:-10px;width:34px;height:34px;line-height:34px",
      "border-radius:50%;background:#06d6a0;color:#fff;font-size:20px;font-weight:800",
    ].join(";");
    btn.appendChild(chip);
  }
  return btn;
}

/**
 * Full-screen level select: a 7-tile grid (sandbox + 6 levels) with nothing
 * locked and a ✓ chip on solved levels. Icon-only tiles, big enough for small
 * fingers, portrait and landscape friendly.
 */
export function createLevelSelect(
  container: HTMLElement,
  levels: readonly LevelDef[],
  badges: Set<number>,
  onPick: (pick: LevelSelectPick) => void,
): LevelSelectHandle {
  const overlay = document.createElement("div");
  overlay.dataset.levelSelect = "overlay";
  overlay.style.cssText = [
    "position:fixed;inset:0;z-index:20;display:none",
    "align-items:center;justify-content:center;background:rgba(20,30,40,0.85)",
  ].join(";");

  const grid = document.createElement("div");
  grid.style.cssText = [
    "display:grid;grid-template-columns:repeat(auto-fit,minmax(84px,1fr));gap:16px",
    "max-width:min(520px,92vw);padding:20px;border-radius:24px;background:#f8f3e9",
  ].join(";");

  const buildGrid = (badgeSet: Set<number>) => {
    grid.replaceChildren();
    const sandboxTile = tile("🏖️", "sandbox", false);
    sandboxTile.addEventListener("click", () => onPick("sandbox"));
    grid.appendChild(sandboxTile);
    for (const level of levels) {
      const t = tile(String(level.id), `level-${level.id}`, badgeSet.has(level.id));
      t.addEventListener("click", () => onPick(level.id));
      grid.appendChild(t);
    }
  };

  buildGrid(badges);
  overlay.appendChild(grid);
  container.appendChild(overlay);

  const refreshBadges = () => {
    buildGrid(loadBadges(localStorage));
  };

  return { el: overlay, refreshBadges };
}

export function showLevelSelect(handle: LevelSelectHandle): void {
  handle.refreshBadges();
  handle.el.style.display = "flex";
}

export function hideLevelSelect(handle: LevelSelectHandle): void {
  handle.el.style.display = "none";
}
