/**
 * Plain constants and helpers shared by the content schemas and the kiosk client. This module must not import
 * zod: client code reads these values at runtime, and schema modules would pull the whole validation library
 * into the first-load bundle (ADR-058). Schema modules re-export them, so server code may use either.
 */
export const LANGUAGES = ["es", "en"] as const;

/** Kebab-case identifier, e.g. `supply-continuity` (IdSchema applies it with a 2–64 length). */
export const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const ID_MIN_LENGTH = 2;
export const ID_MAX_LENGTH = 64;

export const VALIDATION_STATUSES = ["validated", "assumed", "placeholder", "unavailable"] as const;
export const MARKETS = ["puerto-rico", "united-states-reference", "global-reference", "unknown"] as const;
export const CONTENT_MODES = ["production", "demo"] as const;

/** A visitor may select at most this many challenges. */
export const MAX_SELECTED_CHALLENGES = 3;

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

/** Visitor signal groups a recommendation rule can weight. */
export const SIGNAL_TYPES = [
  "personas",
  "challenges",
  "facilityTypes",
  "scenes",
  "hotspots",
  "explicitInterests",
] as const;
