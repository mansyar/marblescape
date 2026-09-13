import type { LevelDef } from "../domain/levels";
import { loadBadges } from "../domain/badges";

export type LevelSelectPick = number | "sandbox";

/** Data-URL preview for a pick; null keeps the glyph fallback tile. */
export type LevelPreviewProvider = (pick: LevelSelectPick) => string | null;

export interface LevelSelectOptions {
  preview?: LevelPreviewProvider;
}

export interface LevelSelectHandle {
  el: HTMLElement;
  /** Re-reads badges from storage and refreshes the ✓ chips (e.g. after a solve). */
  refreshBadges(): void;
}

/** Picture-tile image sizing: fits inside the ≥84px tile. */
const TILE_IMAGE_CSS =
  "width:72px;height:72px;object-fit:contain;display:block;pointer-events:none";

function tile(
  label: string,
  accessibleName: string,
  glyph: string,
  solved: boolean,
  preview: string | null,
): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.dataset.levelSelect = label;
  btn.setAttribute("aria-label", accessibleName);
  btn.style.cssText = [
    "min-width:84px;min-height:84px;font-size:34px;font-weight:700",
    "border-radius:18px;border:3px solid #2c3e50;background:#ffd166;color:#2c3e50",
    "touch-action:manipulation;position:relative",
  ].join(";");
  if (preview) {
    // Camera-matched mini-board; no visible text on picture tiles.
    const img = document.createElement("img");
    img.src = preview;
    img.alt = "";
    img.style.cssText = TILE_IMAGE_CSS;
    btn.appendChild(img);
  } else {
    btn.textContent = glyph;
  }
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
 * Full-screen level select: one tile per level (sandbox + all shipped levels)
 * with nothing locked and a ✓ chip on solved levels. Picture tiles show
 * camera-matched mini-boards and fall back to glyphs when a preview is
 * unavailable; big enough for small fingers, portrait and landscape friendly.
 */
export function createLevelSelect(
  container: HTMLElement,
  levels: readonly LevelDef[],
  badges: Set<number>,
  onPick: (pick: LevelSelectPick) => void,
  options?: LevelSelectOptions,
): LevelSelectHandle {
  const overlay = document.createElement("div");
  overlay.dataset.levelSelect = "overlay";
  overlay.style.cssText = [
    "position:fixed;inset:0;z-index:20;display:none",
    "align-items:center;justify-content:center;background:rgba(20,30,40,0.85)",
  ].join(";");

  const grid = document.createElement("div");
  grid.style.cssText = [
    "display:grid;grid-template-columns:repeat(auto-fit,minmax(96px,1fr));gap:16px",
    "max-width:min(520px,92vw);padding:20px;border-radius:24px;background:#f8f3e9",
  ].join(";");

  const buildGrid = (badgeSet: Set<number>) => {
    grid.replaceChildren();
    const sandboxPreview = options?.preview?.("sandbox") ?? null;
    const sandboxTile = tile("sandbox", "Sandbox", "🏖️", false, sandboxPreview);
    sandboxTile.addEventListener("click", () => onPick("sandbox"));
    grid.appendChild(sandboxTile);
    for (const level of levels) {
      const preview = options?.preview?.(level.id) ?? null;
      const t = tile(
        `level-${level.id}`,
        `Level ${level.id}`,
        String(level.id),
        badgeSet.has(level.id),
        preview,
      );
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
