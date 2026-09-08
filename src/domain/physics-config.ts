/**
 * Centralized physics & tuning constants (spec NFR: all tunables in one place).
 * Values are starting points — tune during Phase 4 integration, only here.
 */

export const PHYSICS = Object.freeze({
  /** Fixed simulation step: 60Hz regardless of display refresh rate. */
  fixedTimeStep: 1 / 60,
  /** Cap on catch-up steps per frame to avoid spiral-of-death stalls. */
  maxSubSteps: 3,

  /** World gravity along the vertical axis (units: cell-size based world). */
  gravity: [0, -25, 0] as const,

  /** Marbles roll, then settle — damping keeps runaway energy in check. */
  linearDamping: 0.12,
  angularDamping: 0.25,

  /** Bounciness. Kept < 1 so impacts always lose energy (reliability gate). */
  marbleRestitution: 0.35,
  boardRestitution: 0.2,

  /** Ball-sphere collision shape radius, in world units (1 unit = 1 cell). */
  marbleRadius: 0.3,

  /** Grid cell size in world units — 1 world unit per board cell. */
  cellSize: 1,

  /** Height above the board surface where marbles spawn. */
  spawnHeight: 2.5,

  /** Marbles dropped per Play press (spec: few at a time, 2-5). */
  maxMarblesPerDrop: 3,

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
