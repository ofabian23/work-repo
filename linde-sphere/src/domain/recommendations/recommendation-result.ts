import { z } from "zod";
import { ContentModeSchema, IdSchema, LocalizedTextSchema } from "../content/primitives";
import { SignalTypeSchema } from "../content/recommendation-rule";
import { uniqueIds } from "../session/visitor-session";

export const MAX_RECOMMENDATIONS = 5;

/** One matched signal that contributed to a recommendation — the basis of "why it appeared". */
export const MatchKindSchema = z.enum([
  /** The visitor selected / opened / visited this signal and the rule weights it. */
  "direct",
  /** A challenge implied by an opened hotspot's recommendationSignals (not selected by the visitor). */
  "implied-challenge",
  /** An opened hotspot lists this solution in its recommendationSignals. */
  "hotspot-affinity",
  /** Bonus for a contributing hotspot whose panel stayed open past the engagement threshold. */
  "engaged-bonus",
]);
export type MatchKind = z.infer<typeof MatchKindSchema>;

export const MatchedSignalSchema = z.strictObject({
  signalType: SignalTypeSchema,
  signalId: IdSchema,
  kind: MatchKindSchema,
  weight: z.number().positive(),
});
export type MatchedSignal = z.infer<typeof MatchedSignalSchema>;

export const RecommendationItemSchema = z
  .strictObject({
    solutionId: IdSchema,
    /** Null only for the fallback recommendation, which has no rule. */
    ruleId: IdSchema.nullable(),
    rank: z.number().int().min(1).max(MAX_RECOMMENDATIONS),
    /** Relevance score used for ordering. Never displayed to visitors; unrelated to lead scoring. */
    score: z.number().min(0),
    matchedSignals: z.array(MatchedSignalSchema).max(40),
    /**
     * Plain-language "Why this appeared", generated from the visitor's matched signals.
     * Rendered in both languages so the UI can switch language without recomputing.
     */
    whyThisAppeared: LocalizedTextSchema,
    /** Rule-specific sentence on when this category tends to matter (no claims). */
    relevance: LocalizedTextSchema,
    relatedSceneIds: uniqueIds(8),
    digitalAssetIds: uniqueIds(8),
    nextStep: LocalizedTextSchema,
    /** True when the solution is not validated; the UI must show the pending-validation indicator. */
    pendingValidation: z.boolean(),
    isFallback: z.boolean(),
  })
  .superRefine((item, ctx) => {
    if (item.isFallback && item.ruleId !== null) {
      ctx.addIssue({ code: "custom", path: ["ruleId"], message: "The fallback recommendation has no rule" });
    }
    if (!item.isFallback && item.ruleId === null) {
      ctx.addIssue({
        code: "custom",
        path: ["ruleId"],
        message: "A rule-based recommendation requires ruleId",
      });
    }
    if (!item.isFallback && item.matchedSignals.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["matchedSignals"],
        message: "A rule-based recommendation must be explained by at least one matched signal",
      });
    }
  });
export type RecommendationItem = z.infer<typeof RecommendationItemSchema>;

export const RecommendationResultSchema = z
  .strictObject({
    engineVersion: z.string().min(1).max(32),
    contentVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
    contentMode: ContentModeSchema,
    items: z.array(RecommendationItemSchema).min(1).max(MAX_RECOMMENDATIONS),
  })
  .superRefine((result, ctx) => {
    result.items.forEach((item, i) => {
      if (item.rank !== i + 1) {
        ctx.addIssue({ code: "custom", path: ["items", i, "rank"], message: `Expected rank ${i + 1}` });
      }
      if (result.contentMode === "production" && item.pendingValidation) {
        ctx.addIssue({
          code: "custom",
          path: ["items", i, "pendingValidation"],
          message: "Production mode must never recommend content pending validation",
        });
      }
    });
    const ids = result.items.map((i) => i.solutionId);
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({ code: "custom", path: ["items"], message: "A solution may appear only once" });
    }
    if (result.items.some((i) => i.isFallback) && result.items.length !== 1) {
      ctx.addIssue({
        code: "custom",
        path: ["items"],
        message: "The fallback recommendation is only used on its own",
      });
    }
  });
export type RecommendationResult = z.infer<typeof RecommendationResultSchema>;
