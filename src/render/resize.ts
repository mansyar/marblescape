/**
 * Debounced viewport-resize watcher.
 * Rotation (orientationchange) and window resizes (including iPad Split View)
 * funnel through one quiet-window timer so the game re-frames at most once
 * per settle, without reloading or re-initializing state.
 */

/** Anything window-like with add/removeEventListener (window in production). */
export interface ResizeTarget {
  addEventListener(type: string, listener: () => void): void;
  removeEventListener(type: string, listener: () => void): void;
}

/** Default quiet window after the last event, in milliseconds. */
export const RESIZE_DEBOUNCE_MS = 100;

const RESIZE_EVENTS = ["resize", "orientationchange"] as const;

/**
 * Registers a callback fired once after the viewport stops changing.
 * Returns a teardown that removes the listeners and cancels pending work.
 */
export function registerViewportResize(
  target: ResizeTarget,
  callback: () => void,
  debounceMs: number = RESIZE_DEBOUNCE_MS,
): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const schedule = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      callback();
    }, debounceMs);
  };

  for (const type of RESIZE_EVENTS) target.addEventListener(type, schedule);

  return () => {
    for (const type of RESIZE_EVENTS) target.removeEventListener(type, schedule);
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  };
}
