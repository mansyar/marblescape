import { describe, expect, it } from "vitest";
import { REQUIRED_ICON_SIZES, validateManifest } from "./manifest";

/** Minimal valid manifest fixture. */
function validManifest(): unknown {
  return {
    name: "Marble Scape",
    short_name: "Marble",
    id: "/",
    start_url: "/",
    display: "standalone",
    theme_color: "#87ceeb",
    background_color: "#87ceeb",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}

describe("validateManifest", () => {
  it("accepts a valid manifest", () => {
    expect(validateManifest(validManifest())).toEqual([]);
  });

  it("rejects non-object input", () => {
    expect(validateManifest(null)).toContain("manifest must be an object");
    expect(validateManifest("nope")).toContain("manifest must be an object");
    expect(validateManifest([])).toContain("manifest must be an object");
  });

  it("requires a non-empty name", () => {
    const m = validManifest() as Record<string, unknown>;
    expect(validateManifest({ ...m, name: "" })).toContain("missing name");
    expect(validateManifest({ ...m, name: undefined })).toContain("missing name");
  });

  it("requires a non-empty short_name", () => {
    const m = validManifest() as Record<string, unknown>;
    expect(validateManifest({ ...m, short_name: "" })).toContain("missing short_name");
  });

  it("requires standalone display", () => {
    const m = validManifest() as Record<string, unknown>;
    expect(validateManifest({ ...m, display: "browser" })).toContain("display must be standalone");
    expect(validateManifest({ ...m, display: undefined })).toContain("display must be standalone");
  });

  it("requires a start_url", () => {
    const m = validManifest() as Record<string, unknown>;
    expect(validateManifest({ ...m, start_url: "" })).toContain("missing start_url");
  });

  it("requires theme and background colors", () => {
    const m = validManifest() as Record<string, unknown>;
    expect(validateManifest({ ...m, theme_color: "" })).toContain("missing theme_color");
    expect(validateManifest({ ...m, background_color: "" })).toContain("missing background_color");
  });

  it("requires icons", () => {
    const m = validManifest() as Record<string, unknown>;
    expect(validateManifest({ ...m, icons: [] })).toContain("missing icons");
    expect(validateManifest({ ...m, icons: undefined })).toContain("missing icons");
  });

  it("requires a 192x192 icon", () => {
    const m = validManifest() as { icons: Array<Record<string, unknown>> };
    expect(
      validateManifest({
        ...m,
        icons: [m.icons[1], m.icons[2]],
      }),
    ).toContain(`missing ${REQUIRED_ICON_SIZES[0]} icon`);
  });

  it("requires a 512x512 icon", () => {
    const m = validManifest() as { icons: Array<Record<string, unknown>> };
    expect(
      validateManifest({
        ...m,
        icons: [m.icons[0]],
      }),
    ).toContain(`missing ${REQUIRED_ICON_SIZES[1]} icon`);
  });

  it("requires a maskable icon", () => {
    const m = validManifest() as { icons: Array<Record<string, unknown>> };
    expect(
      validateManifest({
        ...m,
        icons: [m.icons[0], m.icons[1]],
      }),
    ).toContain("missing maskable icon");
  });

  it("rejects a maskable icon that is not 512x512", () => {
    const m = validManifest() as { icons: Array<Record<string, unknown>> };
    const offSize = { ...m.icons[2], sizes: "192x192" };
    expect(
      validateManifest({
        ...m,
        icons: [m.icons[0], m.icons[1], offSize],
      }),
    ).toContain("missing maskable icon");
  });

  it("reports every problem found", () => {
    const errors = validateManifest({});
    expect(errors).toContain("missing name");
    expect(errors).toContain("missing short_name");
    expect(errors).toContain("display must be standalone");
    expect(errors).toContain("missing start_url");
    expect(errors).toContain("missing theme_color");
    expect(errors).toContain("missing background_color");
    expect(errors).toContain("missing icons");
  });
});
