import type { OnboardingStep } from "../domain/onboarding";

/** Where the ghost hand points; "tile" is the reduced-motion static spot. */
export type HandTarget = "tile" | "gap" | "play";

export interface CuePresentation {
  /** Root layer visible. */
  visible: boolean;
  ringVisible: boolean;
  rampTilePulse: boolean;
  playPulse: boolean;
  handVisible: boolean;
  handTarget: HandTarget;
}

/**
 * Maps the onboarding step to what the cue layer shows:
 * - "place" invites the drag (ring at the gap + Ramp tile pulse + hand);
 *   under reduced motion the hand rests beside the Ramp tile instead of
 *   traveling to the gap;
 * - "play" swaps to the Play-button pulse and the hand at Play;
 * - "done" shows nothing.
 */
export function cuePresentation(step: OnboardingStep, reducedMotion: boolean): CuePresentation {
  if (step === "place") {
    return {
      visible: true,
      ringVisible: true,
      rampTilePulse: true,
      playPulse: false,
      handVisible: true,
      handTarget: reducedMotion ? "tile" : "gap",
    };
  }
  if (step === "play") {
    return {
      visible: true,
      ringVisible: false,
      rampTilePulse: false,
      playPulse: true,
      handVisible: true,
      handTarget: "play",
    };
  }
  return {
    visible: false,
    ringVisible: false,
    rampTilePulse: false,
    playPulse: false,
    handVisible: false,
    handTarget: "play",
  };
}
