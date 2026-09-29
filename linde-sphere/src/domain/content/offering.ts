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
  })
  .superRefine(refineGovernance);
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
