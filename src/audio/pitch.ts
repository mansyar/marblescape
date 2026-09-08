/** Impact force → playback rate mapping (musical band, no screeching). */
export const MAX_FORCE = 25;

const BASE_RATE = 0.85;
const MAX_RATE = 1.6;

export function impactToPlayback(force: number): number {
  const t = Math.min(force / MAX_FORCE, 1);
  return BASE_RATE + (MAX_RATE - BASE_RATE) * t;
}

const MIN_VOLUME = 0.05;
const MAX_VOLUME = 0.9;

export function impactToVolume(force: number): number {
  const t = Math.min(force / MAX_FORCE, 1);
  return MIN_VOLUME + (MAX_VOLUME - MIN_VOLUME) * t;
}
