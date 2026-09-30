import { describe, expect, it } from "vitest";
import {
  isComponentGalleryEnabled,
  isDevToolPathEnabled,
  isSceneCalibrationEnabled,
} from "@/server/dev-tools";
import { parseServerEnv } from "@/server/env";

const env = (raw: Record<string, string>) => {
  const result = parseServerEnv(raw);
  if (!result.ok) throw new Error("invalid env");
  return result.env;
};

describe("component gallery gate", () => {
  it("is available in development and tests", () => {
    expect(isComponentGalleryEnabled(env({ NODE_ENV: "development" }))).toBe(true);
    expect(isComponentGalleryEnabled(env({ NODE_ENV: "test" }))).toBe(true);
  });

  it("is disabled in production by default", () => {
    expect(isComponentGalleryEnabled(env({ NODE_ENV: "production" }))).toBe(false);
    expect(
      isComponentGalleryEnabled(env({ NODE_ENV: "production", ENABLE_COMPONENT_GALLERY: "false" })),
    ).toBe(false);
  });

  it("can be enabled in production only explicitly", () => {
    expect(isComponentGalleryEnabled(env({ NODE_ENV: "production", ENABLE_COMPONENT_GALLERY: "true" }))).toBe(
      true,
    );
  });
});

describe("scene calibration gate", () => {
  it("is available in development and tests", () => {
    expect(isSceneCalibrationEnabled(env({ NODE_ENV: "development" }))).toBe(true);
    expect(isSceneCalibrationEnabled(env({ NODE_ENV: "test" }))).toBe(true);
  });

  it("is disabled in production unless explicitly enabled", () => {
    expect(isSceneCalibrationEnabled(env({ NODE_ENV: "production" }))).toBe(false);
    expect(isSceneCalibrationEnabled(env({ NODE_ENV: "production", ENABLE_SCENE_CALIBRATION: "true" }))).toBe(
      true,
    );
  });

  it("uses its own flag, independent from the gallery", () => {
    const galleryOnly = env({ NODE_ENV: "production", ENABLE_COMPONENT_GALLERY: "true" });
    expect(isDevToolPathEnabled("/dev/scenes", galleryOnly)).toBe(false);
    expect(isDevToolPathEnabled("/dev/components", galleryOnly)).toBe(true);
    const calibrationOnly = env({ NODE_ENV: "production", ENABLE_SCENE_CALIBRATION: "true" });
    expect(isDevToolPathEnabled("/dev/scenes", calibrationOnly)).toBe(true);
    expect(isDevToolPathEnabled("/dev/components", calibrationOnly)).toBe(false);
    expect(isDevToolPathEnabled("/dev/other", calibrationOnly)).toBe(false);
  });
});
