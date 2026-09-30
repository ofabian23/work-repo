import { z } from "zod";
import { LocalizedTextSchema, PublicPathSchema } from "@/domain/content/primitives";

/**
 * Validation for src/lib/config/brand-config.ts (ADR-001, ADR-036). Kept separate so the kiosk client can
 * read the brand values without loading zod (ADR-058). The values are checked when the server starts
 * (content loading) and by `npm run content:check`.
 */
const HexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, { error: "Use a 6-digit hex color, e.g. #0E5E78" });

export const BrandConfigSchema = z.strictObject({
  productName: z.string().trim().min(1).max(40),
  tagline: LocalizedTextSchema,
  /** Organization shown in footers and reports; null until approved. */
  organizationName: z.string().trim().min(1).max(80).nullable(),
  /** Approved logo in public/assets/brand; null renders the text wordmark only. */
  logo: z.strictObject({ src: PublicPathSchema, alt: LocalizedTextSchema }).nullable(),
  colors: z.strictObject({
    background: HexColor,
    surface: HexColor,
    surfaceMuted: HexColor,
    text: HexColor,
    textMuted: HexColor,
    primary: HexColor,
    onPrimary: HexColor,
    accent: HexColor,
    border: HexColor,
    focus: HexColor,
    notice: HexColor,
    noticeSurface: HexColor,
    info: HexColor,
    infoSurface: HexColor,
    success: HexColor,
    successSurface: HexColor,
    danger: HexColor,
    dangerSurface: HexColor,
  }),
  approvalStatus: z.enum(["placeholder", "approved"]),
});
export type BrandConfig = z.infer<typeof BrandConfigSchema>;
