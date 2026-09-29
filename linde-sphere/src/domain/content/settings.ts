import { z } from "zod";
import { LanguageSchema, LocalizedTextSchema, ValidationStatusSchema } from "./primitives";

/** Content bundle metadata. `contentVersion` is stored with every recommendation snapshot and report. */
export const ContentManifestSchema = z.strictObject({
  contentVersion: z.string().regex(/^\d+\.\d+\.\d+$/, { error: "Use semantic versioning, e.g. 0.1.0" }),
  defaultLanguage: LanguageSchema,
  updatedAt: z.iso.date(),
});
export type ContentManifest = z.infer<typeof ContentManifestSchema>;

/**
 * Configurable consent wording. Final text needs organizational (legal) approval, so it is content,
 * versioned, and the exact text shown is stored with each lead.
 */
export const ConsentTextSetSchema = z.strictObject({
  version: z.string().regex(/^\d+\.\d+\.\d+$/, { error: "Use semantic versioning, e.g. 0.1.0" }),
  reportDelivery: LocalizedTextSchema,
  salesFollowUp: LocalizedTextSchema,
  privacyNotice: LocalizedTextSchema,
  validationStatus: ValidationStatusSchema,
  internalNotes: z.string().max(2000),
});
export type ConsentTextSet = z.infer<typeof ConsentTextSetSchema>;
