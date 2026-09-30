import { z } from "zod";

/**
 * Shared building blocks for every content and runtime schema.
 * All schemas are strict: unknown keys are rejected so typos in JSON content fail validation.
 */

export const LANGUAGES = ["es", "en"] as const;
export const LanguageSchema = z.enum(LANGUAGES);
export type Language = z.infer<typeof LanguageSchema>;

/** Kebab-case identifier, e.g. `supply-continuity`. */
export const IdSchema = z
  .string()
  .min(2)
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    error: "Must be kebab-case: lowercase letters, digits and single hyphens (e.g. 'gas-plant')",
  });
export type Id = z.infer<typeof IdSchema>;

/** URL-safe slug; same format as ids but kept separate so they can diverge later. */
export const SlugSchema = IdSchema;

const nonEmptyText = z.string().trim().min(1, { error: "Text must not be empty" }).max(2000);

/** Every visitor-facing string must exist in Spanish (primary) and English. */
export const LocalizedTextSchema = z.strictObject({
  es: nonEmptyText,
  en: nonEmptyText,
});
export type LocalizedText = z.infer<typeof LocalizedTextSchema>;

/** Short localized label (buttons, chips, cards). */
export const LocalizedLabelSchema = z.strictObject({
  es: nonEmptyText.max(120),
  en: nonEmptyText.max(120),
});
export type LocalizedLabel = z.infer<typeof LocalizedLabelSchema>;

export const VALIDATION_STATUSES = ["validated", "assumed", "placeholder", "unavailable"] as const;
export const ValidationStatusSchema = z.enum(VALIDATION_STATUSES);
export type ValidationStatus = z.infer<typeof ValidationStatusSchema>;

export const MARKETS = ["puerto-rico", "united-states-reference", "global-reference", "unknown"] as const;
export const MarketSchema = z.enum(MARKETS);
export type Market = z.infer<typeof MarketSchema>;

export const CONTENT_MODES = ["production", "demo"] as const;
export const ContentModeSchema = z.enum(CONTENT_MODES);
export type ContentMode = z.infer<typeof ContentModeSchema>;

/** Calendar date `YYYY-MM-DD`. */
export const IsoDateSchema = z.iso.date();
/** Timestamp with timezone offset, e.g. `2026-09-29T14:00:00Z`. */
export const IsoDateTimeSchema = z.iso.datetime({ offset: true });

/** A visitor may select at most this many challenges. */
export const MAX_SELECTED_CHALLENGES = 3;

export const SortOrderSchema = z.number().int().min(0).max(10_000);

/** Icon key resolved by the UI icon set (no image URLs in content). */
export const IconKeySchema = IdSchema;

/** Root-relative path to a file served from `public/`, e.g. `/scenes/placeholder/icu.svg`. */
export const PublicPathSchema = z
  .string()
  .regex(/^\/(?!\/)[A-Za-z0-9._\-/]+$/, {
    error: "Must be a root-relative path inside public/, e.g. '/scenes/icu.svg'",
  })
  .refine((p) => !p.split("/").includes(".."), { error: "Path must not contain '..'" })
  // Static files are served as-is: only media types that cannot run code (ADR-057).
  .refine((p) => /\.(svg|png|jpe?g|webp|avif|pdf|mp4|webm)$/i.test(p), {
    error: "Use an image, PDF or video file (.svg .png .jpg .webp .avif .pdf .mp4 .webm)",
  });

export const HttpsUrlSchema = z.url({ protocol: /^https$/, error: "Must be an https:// URL" });

/** Governance fields required on every solution and digital asset (see CONTENT_VALIDATION.md). */
export const GovernanceShape = {
  validationStatus: ValidationStatusSchema,
  market: MarketSchema,
  /** Internal only — stripped before content reaches the kiosk client or reports. */
  internalNotes: z.string().max(2000),
  lastReviewedAt: IsoDateSchema.nullable(),
  reviewedBy: z.string().trim().min(1).max(200).nullable(),
  sourceLabel: z.string().trim().min(1).max(200),
  /** True while the item still needs confirmation by the Puerto Rico sales team. */
  requiresSalesValidation: z.boolean(),
} as const;

export type Governance = {
  validationStatus: ValidationStatus;
  market: Market;
  internalNotes: string;
  lastReviewedAt: string | null;
  reviewedBy: string | null;
  sourceLabel: string;
  requiresSalesValidation: boolean;
};

export const GOVERNANCE_INTERNAL_FIELDS = [
  "internalNotes",
  "reviewedBy",
  "sourceLabel",
  "lastReviewedAt",
  "requiresSalesValidation",
  "market",
] as const;

/**
 * Governance invariants:
 * - `validated` and `unavailable` are decisions, so they need a reviewer and review date.
 * - `validated` means "confirmed local offering", so the market must be Puerto Rico and
 *   no further sales validation may be pending.
 * - `assumed` / `placeholder` items must be flagged as requiring sales validation.
 */
export function refineGovernance(value: Governance, ctx: z.RefinementCtx): void {
  const decided = value.validationStatus === "validated" || value.validationStatus === "unavailable";
  if (decided && value.reviewedBy === null) {
    ctx.addIssue({
      code: "custom",
      path: ["reviewedBy"],
      message: `reviewedBy is required when validationStatus is '${value.validationStatus}'`,
    });
  }
  if (decided && value.lastReviewedAt === null) {
    ctx.addIssue({
      code: "custom",
      path: ["lastReviewedAt"],
      message: `lastReviewedAt is required when validationStatus is '${value.validationStatus}'`,
    });
  }
  if (value.validationStatus === "validated" && value.market !== "puerto-rico") {
    ctx.addIssue({
      code: "custom",
      path: ["market"],
      message: "Validated content must have market 'puerto-rico' (validation confirms a local offering)",
    });
  }
  if (value.validationStatus === "validated" && value.requiresSalesValidation) {
    ctx.addIssue({
      code: "custom",
      path: ["requiresSalesValidation"],
      message: "Validated content cannot still require sales validation",
    });
  }
  if (
    (value.validationStatus === "assumed" || value.validationStatus === "placeholder") &&
    !value.requiresSalesValidation
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["requiresSalesValidation"],
      message: `'${value.validationStatus}' content must set requiresSalesValidation: true`,
    });
  }
}

/** Placeholders allowed in explanation templates, mapped to the signal they render. */
export const TEMPLATE_PLACEHOLDERS = [
  "persona",
  "challenges",
  "facilityType",
  "scenes",
  "hotspots",
  "interests",
  "solution",
] as const;
export type TemplatePlaceholder = (typeof TEMPLATE_PLACEHOLDERS)[number];

export function extractPlaceholders(text: string): string[] {
  return [...text.matchAll(/\{([^{}]*)\}/g)].map((m) => m[1] ?? "");
}
