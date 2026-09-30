import { describe, expect, it } from "vitest";
import { isComponentGalleryEnabled } from "@/server/dev-tools";
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
