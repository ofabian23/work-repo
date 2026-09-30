import type { CSSProperties } from "react";
import type { BrandConfig } from "./brand-config-schema";

export type { BrandConfig } from "./brand-config-schema";

/**
 * Branding configuration with safe placeholder values (ADR-001, ADR-036).
 * - No corporate logo or brand mark is included; the product name renders as a text wordmark.
 * - The palette is a neutral healthcare placeholder, not an official brand palette.
 * Replace values here only with assets and colors approved by marketing (PROJECT_BRIEF Q1).
 * Validated by BrandConfigSchema (brand-config-schema.ts) at server start-up and in `npm run content:check`.
 */
export const brandConfig: BrandConfig = {
  productName: "Linde Sphere",
  tagline: {
    es: "Descubra oportunidades para su organización de salud",
    en: "Discover opportunities for your healthcare organization",
  },
  organizationName: null,
  logo: null,
  colors: {
    background: "#EEF3F6",
    surface: "#FFFFFF",
    surfaceMuted: "#F4F7F9",
    text: "#13232F",
    textMuted: "#46596A",
    primary: "#0E5E78",
    onPrimary: "#FFFFFF",
    accent: "#2B8A7E",
    border: "#C9D6DE",
    focus: "#1B4FD1",
    notice: "#7A4E00",
    noticeSurface: "#FFF4DB",
    info: "#0B5570",
    infoSurface: "#E5F1F6",
    success: "#1C6536",
    successSurface: "#E5F4EA",
    danger: "#A0232A",
    dangerSurface: "#FCEBEC",
  },
  approvalStatus: "placeholder",
};

/** Brand colors as CSS custom properties (`surfaceMuted` → `--brand-surface-muted`), consumed by tokens.css. */
export function brandCssVariables(brand: BrandConfig = brandConfig): CSSProperties {
  return Object.fromEntries(
    Object.entries(brand.colors).map(([name, value]) => [
      `--brand-${name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`,
      value,
    ]),
  ) as CSSProperties;
}
