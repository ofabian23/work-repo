import { z } from "zod";
import type { ScoringSettings } from "./engine-settings";
import {
  IdSchema,
  LocalizedTextSchema,
  MAX_SELECTED_CHALLENGES,
  TEMPLATE_PLACEHOLDERS,
  ValidationStatusSchema,
  extractPlaceholders,
  type LocalizedText,
} from "./primitives";

/**
 * Recommendation rules are data, not code. Each rule scores exactly one solution by summing the
 * weights of the visitor signals it matches. The engine (Phase 3) is a pure function over these rules.
 */

export const SIGNAL_TYPES = [
  "personas",
  "challenges",
  "facilityTypes",
  "scenes",
  "hotspots",
  "explicitInterests",
] as const;
export const SignalTypeSchema = z.enum(SIGNAL_TYPES);
export type SignalType = z.infer<typeof SignalTypeSchema>;

export const MAX_SIGNAL_WEIGHT = 10;

/**
 * Weight of one matched signal: a whole number from 1 to 10 (ADR-050). Positive only; negative intent is
 * expressed with exclusions.
 */
export const SignalWeightSchema = z
  .number()
  .int({ error: "Weights must be whole numbers" })
  .min(1)
  .max(MAX_SIGNAL_WEIGHT);

/** Map of signal id → weight, e.g. `{ "supply-continuity": 5 }`. */
const WeightMapSchema = z.record(IdSchema, SignalWeightSchema);

export const SignalWeightsSchema = z.strictObject({
  personas: WeightMapSchema,
  challenges: WeightMapSchema,
  facilityTypes: WeightMapSchema,
  scenes: WeightMapSchema,
  hotspots: WeightMapSchema,
  /** Keyed by solution id: the visitor tapped "Add to my interests" on that solution. */
  explicitInterests: WeightMapSchema,
});
export type SignalWeights = z.infer<typeof SignalWeightsSchema>;

/** If the visitor has ANY of the listed signal ids, the rule's solution is not recommended. */
export const ExclusionRuleSchema = z.strictObject({
  signalType: SignalTypeSchema,
  ids: z.array(IdSchema).min(1).max(20),
  /** Internal explanation for content editors; never shown to visitors. */
  reason: z.string().trim().min(1).max(300),
});
export type ExclusionRule = z.infer<typeof ExclusionRuleSchema>;

function refineTemplate(
  text: LocalizedText,
  path: (string | number)[],
  ctx: z.RefinementCtx,
  { allowPlaceholders }: { allowPlaceholders: boolean },
): void {
  const es = extractPlaceholders(text.es);
  const en = extractPlaceholders(text.en);
  for (const [lang, found] of [
    ["es", es],
    ["en", en],
  ] as const) {
    if (!allowPlaceholders && found.length > 0) {
      ctx.addIssue({
        code: "custom",
        path: [...path, lang],
        message: `Placeholders are not allowed here (found {${found.join("}, {")}})`,
      });
      continue;
    }
    const unknown = found.filter((p) => !(TEMPLATE_PLACEHOLDERS as readonly string[]).includes(p));
    if (unknown.length > 0) {
      ctx.addIssue({
        code: "custom",
        path: [...path, lang],
        message: `Unknown placeholder(s) {${unknown.join("}, {")}}; allowed: ${TEMPLATE_PLACEHOLDERS.join(", ")}`,
      });
    }
  }
  if (allowPlaceholders && [...new Set(es)].sort().join() !== [...new Set(en)].sort().join()) {
    ctx.addIssue({
      code: "custom",
      path,
      message: "Spanish and English templates must use the same placeholders",
    });
  }
}

export const RecommendationRuleSchema = z
  .strictObject({
    id: IdSchema,
    solutionId: IdSchema,
    weights: SignalWeightsSchema,
    /** The solution is recommended only when its total score reaches this threshold. */
    minimumScore: z.number().int({ error: "minimumScore must be a whole number" }).min(1).max(100),
    exclusions: z.array(ExclusionRuleSchema).max(10),
    /**
     * Visitor-facing sentence. Placeholders ({challenges}, {scenes}, …) render the visitor's matched
     * labels for that signal type. If any placeholder has no match, `fallbackExplanation` is used.
     */
    explanationTemplate: LocalizedTextSchema,
    /** Required only when `explanationTemplate` uses placeholders. */
    fallbackExplanation: LocalizedTextSchema.optional(),
    /** Tie-breaker between equal scores: higher priority wins (1–100). */
    priority: z.number().int().min(1).max(100),
    validationStatus: ValidationStatusSchema,
    internalNotes: z.string().max(2000),
  })
  .superRefine((rule, ctx) => {
    const totalSignals = SIGNAL_TYPES.reduce((n, t) => n + Object.keys(rule.weights[t]).length, 0);
    if (totalSignals === 0) {
      ctx.addIssue({ code: "custom", path: ["weights"], message: "A rule must weight at least one signal" });
    }
    refineTemplate(rule.explanationTemplate, ["explanationTemplate"], ctx, { allowPlaceholders: true });
    if (rule.fallbackExplanation) {
      refineTemplate(rule.fallbackExplanation, ["fallbackExplanation"], ctx, { allowPlaceholders: false });
    } else if (
      extractPlaceholders(rule.explanationTemplate.es).length > 0 ||
      extractPlaceholders(rule.explanationTemplate.en).length > 0
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["fallbackExplanation"],
        message: "fallbackExplanation is required when explanationTemplate uses placeholders",
      });
    }

    rule.exclusions.forEach((ex, i) => {
      const overlap = ex.ids.filter((id) => id in rule.weights[ex.signalType]);
      if (overlap.length > 0) {
        ctx.addIssue({
          code: "custom",
          path: ["exclusions", i, "ids"],
          message: `Signal(s) ${overlap.join(", ")} are both weighted and excluded in ${ex.signalType}`,
        });
      }
    });
  });
export type RecommendationRule = z.infer<typeof RecommendationRuleSchema>;

const sumTop = (values: number[], n: number) =>
  [...values]
    .sort((a, b) => b - a)
    .slice(0, n)
    .reduce((a, b) => a + b, 0);

/**
 * Upper bound of the score a single visitor could reach for this rule, using the engine's caps
 * (used by cross-checks to catch unreachable thresholds). Persona and facility type are single-choice;
 * challenges are limited by the selection cap, scenes and hotspots by the engine caps.
 */
export function maxAchievableScore(rule: RecommendationRule, scoring: ScoringSettings): number {
  const w = rule.weights;
  const hotspotWeights = Object.values(w.hotspots);
  const hotspotMax = hotspotWeights.reduce((a, b) => a + b + scoring.engagedHotspotBonus, 0);
  return (
    sumTop(Object.values(w.personas), 1) +
    sumTop(Object.values(w.facilityTypes), 1) +
    sumTop(Object.values(w.challenges), MAX_SELECTED_CHALLENGES) +
    (Object.keys(w.challenges).length > MAX_SELECTED_CHALLENGES ? scoring.impliedChallengeCap : 0) +
    Math.min(sumTop(Object.values(w.scenes), Infinity), scoring.sceneCap) +
    Math.min(hotspotMax, scoring.hotspotCap) +
    sumTop(Object.values(w.explicitInterests), Infinity)
  );
}
