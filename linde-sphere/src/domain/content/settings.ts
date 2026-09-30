import { z } from "zod";
import {
  LanguageSchema,
  LocalizedLabelSchema,
  LocalizedTextSchema,
  ValidationStatusSchema,
} from "./primitives";

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

/** Sales contact shown in the report's consultation call to action (PROJECT_BRIEF Q4). */
export const SalesContactSchema = z
  .strictObject({
    /** Team or person name as shown to the visitor. */
    name: LocalizedLabelSchema,
    email: z.email({ error: "Use a valid email address" }),
    phone: z.string().trim().min(7).max(40).nullable(),
  })
  .nullable();

/**
 * Configurable report copy (content/report.json, ADR-054): the email's title, subject, introduction,
 * consultation call to action, sales contact, applicability disclaimer and privacy footer. Versioned,
 * and governed like consent: production requires `validated`.
 */
export const ReportCopySchema = z
  .strictObject({
    version: z.string().regex(/^\d+\.\d+\.\d+$/, { error: "Use semantic versioning, e.g. 0.1.0" }),
    title: LocalizedLabelSchema,
    subject: LocalizedLabelSchema,
    intro: LocalizedTextSchema,
    callToAction: z.strictObject({
      heading: LocalizedLabelSchema,
      body: LocalizedTextSchema,
      /** Button label; the button opens an email to the sales contact (hidden when there is none). */
      buttonLabel: LocalizedLabelSchema,
    }),
    salesContact: SalesContactSchema,
    disclaimer: LocalizedTextSchema,
    privacyFooter: LocalizedTextSchema,
    /** Shown in demo mode whenever a recommendation is pending local validation. */
    pendingValidationNotice: LocalizedTextSchema,
    validationStatus: ValidationStatusSchema,
    internalNotes: z.string().max(2000),
  })
  .superRefine((copy, ctx) => {
    if (
      copy.validationStatus === "validated" &&
      copy.salesContact &&
      /@(.+\.)?example\.(com|org|net)$|\.invalid$/.test(copy.salesContact.email)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["salesContact", "email"],
        message: "Validated report copy cannot use a reserved example address for the sales contact",
      });
    }
  });
export type ReportCopy = z.infer<typeof ReportCopySchema>;
