import { z } from "zod";
import {
  GovernanceShape,
  HttpsUrlSchema,
  IdSchema,
  LanguageSchema,
  LocalizedLabelSchema,
  LocalizedTextSchema,
  PublicPathSchema,
  SlugSchema,
  refineGovernance,
} from "./primitives";

/**
 * Offering content: what could be recommended. Every record carries full governance metadata,
 * because presenting an unconfirmed capability as a local offering is the main content risk.
 */

/**
 * Internal sales-review worksheet for one solution (CONTENT_VALIDATION.md §11). Filled in by the
 * Puerto Rico sales team; never shown to visitors (stripped by the visibility filter).
 */
export const SalesReviewSchema = z
  .strictObject({
    decision: z.enum(["pending", "keep", "remove", "rename"]),
    /** Required when decision is "rename". */
    proposedName: LocalizedLabelSchema.nullable(),
    puertoRicoAvailability: z.enum(["requires-verification", "available", "not-available"]),
    conventionPriority: z.enum(["high", "medium", "low", "unset"]),
    /** False while the priority is only a project-team proposal. */
    priorityConfirmedBySales: z.boolean(),
    notes: z.string().max(1000),
  })
  .superRefine((review, ctx) => {
    if (review.decision === "rename" && review.proposedName === null) {
      ctx.addIssue({ code: "custom", path: ["proposedName"], message: "proposedName is required to rename" });
    }
    if (review.decision !== "rename" && review.proposedName !== null) {
      ctx.addIssue({
        code: "custom",
        path: ["proposedName"],
        message: "proposedName is only used when decision is 'rename'",
      });
    }
    if (review.priorityConfirmedBySales && review.conventionPriority === "unset") {
      ctx.addIssue({
        code: "custom",
        path: ["conventionPriority"],
        message: "A confirmed priority cannot be 'unset'",
      });
    }
  });
export type SalesReview = z.infer<typeof SalesReviewSchema>;

export const SolutionSchema = z
  .strictObject({
    id: IdSchema,
    slug: SlugSchema,
    title: LocalizedLabelSchema,
    summary: LocalizedTextSchema,
    nextStep: LocalizedTextSchema,
    relatedChallengeIds: z.array(IdSchema).max(12),
    relatedSceneIds: z.array(IdSchema).max(8),
    digitalAssetIds: z.array(IdSchema).max(8),
    /** The single "speak with a specialist" recommendation used when nothing else qualifies. */
    isFallback: z.boolean(),
    ...GovernanceShape,
    salesReview: SalesReviewSchema,
  })
  .superRefine(refineGovernance)
  .superRefine((solution, ctx) => {
    const { validationStatus: status } = solution;
    const { puertoRicoAvailability: availability, decision } = solution.salesReview;
    const issue = (path: string[], message: string) => ctx.addIssue({ code: "custom", path, message });
    // Review outcomes and validation status must tell the same story.
    if (status === "validated" && availability !== "available") {
      issue(
        ["salesReview", "puertoRicoAvailability"],
        "Validated solutions must be 'available' in Puerto Rico",
      );
    }
    if (status === "validated" && (decision === "remove" || decision === "pending")) {
      issue(["salesReview", "decision"], `A validated solution cannot have decision '${decision}'`);
    }
    if (availability === "not-available" && status !== "unavailable") {
      issue(["validationStatus"], "Solutions not available in Puerto Rico must be marked 'unavailable'");
    }
    if (decision === "remove" && status !== "unavailable") {
      issue(["validationStatus"], "Solutions the sales team removed must be marked 'unavailable'");
    }
  });
export type Solution = z.infer<typeof SolutionSchema>;

export const DigitalAssetTypeSchema = z.enum(["brochure", "video", "web-page", "guide", "checklist"]);
export type DigitalAssetType = z.infer<typeof DigitalAssetTypeSchema>;

export const DigitalAssetAccessSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("url"), url: HttpsUrlSchema }),
  z.strictObject({ kind: z.literal("local-file"), path: PublicPathSchema }),
]);
export type DigitalAssetAccess = z.infer<typeof DigitalAssetAccessSchema>;

export const DigitalAssetSchema = z
  .strictObject({
    id: IdSchema,
    title: LocalizedLabelSchema,
    description: LocalizedTextSchema,
    type: DigitalAssetTypeSchema,
    access: DigitalAssetAccessSchema,
    /** Languages the asset itself is available in. */
    languages: z.array(LanguageSchema).min(1).max(2),
    ...GovernanceShape,
  })
  .superRefine(refineGovernance)
  .superRefine((asset, ctx) => {
    if (
      asset.validationStatus === "validated" &&
      asset.access.kind === "url" &&
      /(^|\.)example\.(com|org|net)$/.test(new URL(asset.access.url).hostname)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["access", "url"],
        message: "A validated asset cannot point to a reserved example domain",
      });
    }
    if (new Set(asset.languages).size !== asset.languages.length) {
      ctx.addIssue({ code: "custom", path: ["languages"], message: "Languages must be unique" });
    }
  });
export type DigitalAsset = z.infer<typeof DigitalAssetSchema>;
