import { describe, expect, it } from "vitest";
import { en } from "@/data/i18n/en";
import { es } from "@/data/i18n/es";
import { appConfig } from "@/lib/config/app-config";
import { BrandConfigSchema, brandConfig, brandCssVariables } from "@/lib/config/brand-config";
import { interpolate, localize, translate } from "@/lib/i18n/translate";

function leafKeys(obj: object, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === "string" ? [`${prefix}${k}`] : leafKeys(v as object, `${prefix}${k}.`),
  );
}

describe("translation dictionaries", () => {
  it("Spanish and English have exactly the same keys", () => {
    expect(leafKeys(en).sort()).toEqual(leafKeys(es).sort());
  });

  it("have no empty strings", () => {
    for (const dict of [es, en])
      for (const key of leafKeys(dict)) expect(translate("es", key as never)).not.toBe("");
  });

  it("use the same placeholders in both languages", () => {
    for (const key of leafKeys(es)) {
      const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
      expect(placeholders(translate("en", key as never)), key).toEqual(
        placeholders(translate("es", key as never)),
      );
    }
  });
});

describe("translate", () => {
  it("returns the string for the requested language", () => {
    expect(translate("es", "status.retry")).toBe("Intentar de nuevo");
    expect(translate("en", "status.retry")).toBe("Try again");
  });

  it("interpolates parameters", () => {
    expect(translate("en", "shell.footerVersion", { version: "1.2.3" })).toBe("Version 1.2.3");
    expect(interpolate("Hola {name}", { other: 1 })).toBe("Hola {name}");
  });

  it("falls back to the key for unknown keys instead of throwing", () => {
    expect(translate("en", "does.not.exist" as never)).toBe("does.not.exist");
  });

  it("localizes content fields", () => {
    expect(localize({ es: "Hola", en: "Hello" }, "en")).toBe("Hello");
  });
});

describe("app configuration", () => {
  it("is Spanish-first and kiosk-oriented", () => {
    expect(appConfig.defaultLanguage).toBe("es");
    expect(appConfig.supportedLanguages).toEqual(["es", "en"]);
    expect(appConfig.kiosk.designViewport).toEqual({ width: 1080, height: 1920 });
    expect(appConfig.kiosk.minTouchTargetPx).toBeGreaterThanOrEqual(48);
  });
});

/** WCAG 2.x relative luminance contrast ratio. */
function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * bl!;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

describe("brand configuration", () => {
  it("shows the Linde Sphere product name with no logo or brand mark", () => {
    expect(brandConfig.productName).toBe("Linde Sphere");
    expect(brandConfig.logo).toBeNull();
    expect(brandConfig.approvalStatus).toBe("placeholder");
  });

  it("rejects invalid colors", () => {
    const bad = { ...brandConfig, colors: { ...brandConfig.colors, primary: "blue" } };
    expect(BrandConfigSchema.safeParse(bad).success).toBe(false);
  });

  it.each([
    ["text", "background"],
    ["text", "surface"],
    ["textMuted", "surface"],
    ["textMuted", "surfaceMuted"],
    ["onPrimary", "primary"],
    ["primary", "surface"],
    ["notice", "noticeSurface"],
  ] as const)("%s on %s meets WCAG AA (4.5:1)", (fg, bg) => {
    expect(contrast(brandConfig.colors[fg], brandConfig.colors[bg])).toBeGreaterThanOrEqual(4.5);
  });

  it("exposes every color as a CSS variable", () => {
    const vars = brandCssVariables() as Record<string, string>;
    expect(vars["--brand-primary"]).toBe(brandConfig.colors.primary);
    expect(Object.keys(vars)).toHaveLength(Object.keys(brandConfig.colors).length);
  });
});
