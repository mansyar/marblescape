/**
 * Per-marble impact voice throttling (spec FR2).
 *
 * The old gate was a single global timestamp: one marble's click muted
 * every other marble for 60 ms, silently dropping rapid click-clack
 * sequences. Here every marble owns its own voice window; an impact may
 * speak if ANY involved marble's voice is free, and then stamps all of
 * them so a single collision can't double-fire.
 */

/** Per-marble cooldown between two audible impacts, in milliseconds. */
export const IMPACT_COOLDOWN_MS = 60;

/** Cap on tracked voices before stale entries are pruned (long sessions). */
const MAX_TRACKED = 256;

export class ImpactThrottler {
  private readonly lastSpokeAt = new Map<object, number>();

  /**
   * Decides whether an impact involving `primary` (plus any `others`) may
   * sound at time `now`. On a positive verdict every involved voice is
   * stamped, so the same collision can't fire twice.
   */
  shouldPlay(
    primary: object,
    now: number,
    cooldownMs: number = IMPACT_COOLDOWN_MS,
    others: readonly object[] = [],
  ): boolean {
    const involved = others.length > 0 ? [primary, ...others] : [primary];
    const free = involved.some(
      (voice) => now - (this.lastSpokeAt.get(voice) ?? Number.NEGATIVE_INFINITY) >= cooldownMs,
    );
    if (!free) {
      return false;
    }
    for (const voice of involved) {
      this.lastSpokeAt.set(voice, now);
    }
    this.prune(now, cooldownMs);
    return true;
  }

  /** Drops long-idle voices so reaped marbles don't accumulate forever. */
  private prune(now: number, cooldownMs: number): void {
    if (this.lastSpokeAt.size <= MAX_TRACKED) {
      return;
    }
    for (const [voice, at] of this.lastSpokeAt) {
      if (now - at > cooldownMs * 10) {
        this.lastSpokeAt.delete(voice);
      }
    }
  }
}
