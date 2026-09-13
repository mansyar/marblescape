import type { QualityStats } from "../render/quality";

/** Test hook for the unit/Playwright suites. */
export const DEBUG_OVERLAY_TESTID = "debug-overlay";

/** True when the hidden performance readout was requested via `?debug`. */
export function debugOverlayEnabled(search: string): boolean {
  return new URLSearchParams(search).has("debug");
}

/** One compact, deterministic line for the readout. */
export function formatQualityStats(stats: QualityStats): string {
  return (
    `tier ${stats.tier} · ema ${stats.emaFrameMs.toFixed(1)}ms · ` +
    `p95 ${stats.p95FrameMs.toFixed(1)}ms · frames ${stats.frameCount} · ` +
    `down ${stats.downgrades} up ${stats.upgrades}`
  );
}

export interface DebugOverlayHandle {
  el: HTMLElement;
  update(stats: QualityStats): void;
  dispose(): void;
}

/**
 * Hidden dev readout (spec FR4): a tiny pointer-transparent line rendering the
 * governor snapshot. It is only created when `?debug` is present, so the cost
 * without the flag is exactly zero.
 */
export function createDebugOverlay(host: HTMLElement): DebugOverlayHandle {
  const el = document.createElement("div");
  el.dataset.testid = DEBUG_OVERLAY_TESTID;
  el.style.cssText = [
    "position:fixed",
    "left:10px",
    "top:10px",
    "z-index:30",
    "pointer-events:none",
    "font:12px/1.5 ui-monospace,Menlo,monospace",
    "color:#073b4c",
    "background:#ffffffd9",
    "padding:4px 8px",
    "border-radius:8px",
    "white-space:nowrap",
  ].join(";");
  el.textContent = "";
  host.appendChild(el);

  return {
    el,
    update(stats) {
      el.textContent = formatQualityStats(stats);
    },
    dispose() {
      el.remove();
    },
  };
}
