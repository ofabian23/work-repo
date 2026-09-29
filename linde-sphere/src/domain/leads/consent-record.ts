import { z } from "zod";
import { IsoDateTimeSchema, LanguageSchema } from "../content/primitives";
import { SemverSchema } from "./lead-submission";

/**
 * Server-side record of one consent decision, including the exact text the visitor saw.
 * Report delivery and sales follow-up are always separate records.
 */
export const ConsentTypeSchema = z.enum(["report-delivery", "sales-follow-up"]);
export type ConsentType = z.infer<typeof ConsentTypeSchema>;

export const ConsentRecordSchema = z.strictObject({
  consentType: ConsentTypeSchema,
  granted: z.boolean(),
  consentVersion: SemverSchema,
  language: LanguageSchema,
  /** Exact wording displayed, in the language displayed. */
  textShown: z.string().trim().min(1).max(2000),
  recordedAt: IsoDateTimeSchema,
  source: z.literal("kiosk-lead-form"),
});
export type ConsentRecord = z.infer<typeof ConsentRecordSchema>;

/** A lead's consents: exactly one record per consent type. */
export const ConsentRecordSetSchema = z
  .array(ConsentRecordSchema)
  .length(2)
  .refine((records) => new Set(records.map((r) => r.consentType)).size === 2, {
    error: "Exactly one record per consent type is required",
  })
  .refine((records) => new Set(records.map((r) => r.consentVersion)).size === 1, {
    error: "All consent records of a lead must share the same consent version",
  });
