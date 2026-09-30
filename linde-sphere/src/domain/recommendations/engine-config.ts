/**
 * Engine constants that are code, not tuning. Scoring weights, caps, result sizes, relevance and
 * readiness thresholds are data (`content/engine-settings.json`, ADR-050); changing them requires
 * re-running `npm run content:export` (coverage tables).
 */
export const ENGINE_VERSION = "2.0.0";

/** Reason groups rendered in the "Why this appeared" sentence, and labels per group. */
export const MAX_REASON_GROUPS = 3;
export const MAX_LABELS_PER_REASON = 2;
