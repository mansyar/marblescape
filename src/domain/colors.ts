/**
 * The six candy marble colors — single source of truth for marble, cup,
 * confetti, and preview tints. Names are the domain vocabulary; the hex
 * values drive rendering.
 */

export const MARBLE_COLORS = [
  "raspberry",
  "tangerine",
  "lemon",
  "mint",
  "blueberry",
  "grape",
] as const;

export type MarbleColor = (typeof MARBLE_COLORS)[number];

/** Candy hex per color (Kenney warm-workshop palette). */
export const MARBLE_COLOR_HEX: Record<MarbleColor, string> = {
  raspberry: "#ef476f",
  tangerine: "#f78c6b",
  lemon: "#ffd166",
  mint: "#06d6a0",
  blueberry: "#118ab2",
  grape: "#9b5de5",
};

/** Hex palette in tap order; index-aligned with MARBLE_COLORS. */
export const MARBLE_PALETTE: readonly string[] = Object.freeze(
  MARBLE_COLORS.map((color) => MARBLE_COLOR_HEX[color]),
);

/** Resolves a candy color to its render hex. */
export function colorHex(color: MarbleColor): string {
  return MARBLE_COLOR_HEX[color];
}

/** Next color in tap order (wraps after the sixth). */
export function nextMarbleColor(color: MarbleColor): MarbleColor {
  const index = MARBLE_COLORS.indexOf(color);
  return MARBLE_COLORS[(index + 1) % MARBLE_COLORS.length];
}

/** Runtime guard for persisted / untrusted color strings. */
export function isMarbleColor(value: unknown): value is MarbleColor {
  return typeof value === "string" && (MARBLE_COLORS as readonly string[]).includes(value);
}
