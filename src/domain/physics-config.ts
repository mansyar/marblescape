/**
 * Centralized physics & tuning constants (spec NFR: all tunables in one place).
 * Values are starting points — tune during Phase 4 integration, only here.
 */

export const PHYSICS = Object.freeze({
  /** Fixed simulation step: 60Hz regardless of display refresh rate. */
  fixedTimeStep: 1 / 60,
  /** Cap on catch-up steps per frame to avoid spiral-of-death stalls. */
  maxSubSteps: 3,

  /**
   * World gravity, tilted ~8° toward the player (south, +z) — the board
   * reads as a table leaning toward you: marbles always drift south on any
   * surface, while ramps (extra pitch) accelerate them further.
   */
  gravity: [0, -17.8, 2.5] as const,

  /** Marbles roll, then settle — damping keeps runaway energy in check. */
  linearDamping: 0.5,
  angularDamping: 0.6,

  /** Bounciness. Kept < 1 so impacts always lose energy (reliability gate). */
  marbleRestitution: 0.15,
  boardRestitution: 0.08,

  /** Ball-sphere collision shape radius, in world units (1 unit = 1 cell). */
  marbleRadius: 0.3,

  /** Grid cell size in world units — 1 world unit per board cell. */
  cellSize: 1,

  /** Drop height above the board surface (low: landing must not scatter). */
  spawnHeight: 0.4,

  /** Marbles dropped per Play press (user preference: one at a time). */
  maxMarblesPerDrop: 1,

  /** Extra clearance used by guard rails / edge walls. */
  wallHeight: 0.75,
});

/** Candy colors for marble random assignment (hex). */
export const MARBLE_PALETTE: readonly string[] = Object.freeze([
  "#ef476f", // raspberry
  "#f78c6b", // tangerine
  "#ffd166", // lemon
  "#06d6a0", // mint
  "#118ab2", // blueberry
  "#9b5de5", // grape
]);
