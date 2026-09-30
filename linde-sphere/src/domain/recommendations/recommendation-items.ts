import type { RecommendationResult } from "./recommendation-result";

/** Tier filters used by the kiosk screens (zod-free, ADR-058). */
export const primaryItems = (result: RecommendationResult | null) =>
  (result?.items ?? []).filter((i) => i.tier === "primary");
export const secondaryItems = (result: RecommendationResult | null) =>
  (result?.items ?? []).filter((i) => i.tier === "secondary");
