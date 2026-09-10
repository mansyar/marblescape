/** Impact force → playback mapping (musical band, no screeching). */

/** Relative impact speed treated as "as hard as it gets". */
export const MAX_FORCE = 25;

export const BASE_RATE = 0.85;
export const MAX_RATE = 1.6;

export const MIN_VOLUME = 0.05;
export const MAX_VOLUME = 0.9;

/** Pitch wakes up early: small hits still sing (spec FR2 refined curves). */
const RATE_EXPONENT = 0.9;
/** Loudness grows late: gentle rolls stay soft, hard hits pop (spec FR2). */
const VOLUME_EXPONENT = 1.4;

export function impactToPlayback(force: number): number {
  const t = Math.min(force / MAX_FORCE, 1);
  return BASE_RATE + (MAX_RATE - BASE_RATE) * t ** RATE_EXPONENT;
}

export function impactToVolume(force: number): number {
  const t = Math.min(force / MAX_FORCE, 1);
  return MIN_VOLUME + (MAX_VOLUME - MIN_VOLUME) * t ** VOLUME_EXPONENT;
}
