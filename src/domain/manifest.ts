/** Icon sizes that must be present for a manifest to be installable. */
export const REQUIRED_ICON_SIZES = ["192x192", "512x512"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Validates the fields a browser needs to offer "Add to Home Screen":
 * identity, standalone display, colors, and the mandatory icon sizes
 * (192 + 512 PNG plus a maskable variant). Returns a list of human-readable
 * problems; an empty list means the manifest is installable.
 */
export function validateManifest(input: unknown): string[] {
  if (!isRecord(input)) {
    return ["manifest must be an object"];
  }
  const errors: string[] = [];
  const missing = (key: string) => typeof input[key] !== "string" || input[key].trim() === "";

  if (missing("name")) errors.push("missing name");
  if (missing("short_name")) errors.push("missing short_name");
  if (input.display !== "standalone") errors.push("display must be standalone");
  if (missing("start_url")) errors.push("missing start_url");
  if (missing("theme_color")) errors.push("missing theme_color");
  if (missing("background_color")) errors.push("missing background_color");

  if (!Array.isArray(input.icons) || input.icons.length === 0) {
    errors.push("missing icons");
    return errors;
  }
  const icons = input.icons;
  for (const size of REQUIRED_ICON_SIZES) {
    const has = icons.some(
      (icon) => isRecord(icon) && typeof icon.sizes === "string" && icon.sizes === size,
    );
    if (!has) errors.push(`missing ${size} icon`);
  }
  const hasMaskable = icons.some(
    (icon) =>
      isRecord(icon) && icon.purpose === "maskable" && icon.sizes === REQUIRED_ICON_SIZES[1],
  );
  if (!hasMaskable) errors.push("missing maskable icon");
  return errors;
}
