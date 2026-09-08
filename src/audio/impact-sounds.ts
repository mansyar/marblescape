import { impactToPlayback, impactToVolume, MAX_FORCE } from "./pitch";

export type ImpactSample = "tick" | "clack";

/** Both participants marbles = glass tick; a marble hitting anything else = clack. */
export function selectImpactSound(aIsMarble: boolean, bIsMarble: boolean): ImpactSample | null {
  if (!aIsMarble && !bIsMarble) {
    return null;
  }
  return aIsMarble && bIsMarble ? "tick" : "clack";
}

/** Relative impact speed → playback params within the musical band. */
export function impactParams(force: number): { rate: number; volume: number } {
  const clamped = Math.min(Math.max(force, 0), MAX_FORCE);
  return { rate: impactToPlayback(clamped), volume: impactToVolume(clamped) };
}
