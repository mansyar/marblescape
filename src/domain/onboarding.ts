import type { Storage } from "./storage";

/**
 * First-run completion flag — same tiny-helper pattern as prefs/badges:
 * a stable versioned key, corrupt or foreign values forgiven as "not done".
 */
export const ONBOARDED_KEY = "marblescape.onboarded.v1";

/** Marker value written once the child has pressed Play for the first time. */
export const ONBOARDED_VALUE = "done";

/** The passive first-run sequence: drag a piece, then press Play. */
export type OnboardingStep = "place" | "play" | "done";

export type OnboardingEvent = "piece-placed" | "play-pressed";

/** True once the first-run sequence has completed on this device. */
export function isOnboarded(storage: Pick<Storage, "getItem">): boolean {
  return storage.getItem(ONBOARDED_KEY) === ONBOARDED_VALUE;
}

/** Writes the completion flag; safe to call repeatedly. */
export function markOnboarded(storage: Pick<Storage, "setItem">): void {
  storage.setItem(ONBOARDED_KEY, ONBOARDED_VALUE);
}

/**
 * Pure step transition for the cues:
 * - the first successful placement advances "place" → "play" (extra
 *   placements during "play" are ignored);
 * - the first Play press completes from any step — a child who skips
 *   straight to Play has already learned the loop;
 * - "done" is terminal.
 */
export function nextOnboardingStep(step: OnboardingStep, event: OnboardingEvent): OnboardingStep {
  if (step === "done" || event === "play-pressed") {
    return "done";
  }
  return step === "place" ? "play" : step;
}
