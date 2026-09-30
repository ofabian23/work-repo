import { z } from "zod";
import {
  ContentModeSchema,
  HttpsUrlSchema,
  IdSchema,
  IsoDateTimeSchema,
  LanguageSchema,
} from "../content/primitives";
import { MAX_RECOMMENDATIONS } from "../recommendations/recommendation-result";

/**
 * Fully resolved data for one personalized report, already rendered in the visitor's language.
 * Strict on purpose: internal fields such as lead score cannot be smuggled in (ADR-009).
 */

const text = (max: number) => z.string().trim().min(1).max(max);

export const ReportRecommendationSchema = z.strictObject({
  solutionId: IdSchema,
  title: text(120),
  summary: text(2000),
  reasons: z.array(text(400)).min(1).max(3),
  relatedAreas: z.array(text(120)).max(8),
  nextStep: text(2000),
  /** Links must be reachable from the visitor's inbox, so only public https URLs are allowed. */
  resources: z.array(z.strictObject({ title: text(120), url: HttpsUrlSchema })).max(8),
  pendingValidation: z.boolean(),
});
export type ReportRecommendation = z.infer<typeof ReportRecommendationSchema>;

export const ReportPayloadSchema = z
  .strictObject({
    leadId: z.string().min(1).max(64),
    language: LanguageSchema,
    contentMode: ContentModeSchema,
    contentVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
    /** Version of the report copy (content/report.json). */
    copyVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
    engineVersion: z.string().min(1).max(32),
    generatedAt: IsoDateTimeSchema,
    subject: text(160),
    title: text(160),
    intro: text(1000),
    visitor: z.strictObject({ firstName: text(80), lastName: text(80), organization: text(160) }),
    role: z.strictObject({ id: IdSchema, label: text(120) }),
    priorities: z.array(z.strictObject({ id: IdSchema, label: text(120) })).max(15),
    areasExplored: z.array(z.strictObject({ id: IdSchema, title: text(120) })).max(20),
    recommendations: z.array(ReportRecommendationSchema).min(1).max(MAX_RECOMMENDATIONS),
    callToAction: z.strictObject({
      heading: text(160),
      body: text(1000),
      buttonLabel: text(120),
      /** mailto: link to the sales contact; null when no contact is configured. */
      href: z
        .string()
        .max(600)
        .regex(/^mailto:[^\s<>"]+$/, { error: "Only mailto: links to the sales contact are allowed" })
        .nullable(),
    }),
    salesContact: z
      .strictObject({ name: text(120), email: z.email(), phone: text(40).nullable() })
      .nullable(),
    disclaimer: text(1000),
    privacyFooter: text(1000),
    /** Required whenever any recommendation is pending validation (demo mode only). */
    pendingValidationNotice: text(400).nullable(),
  })
  .superRefine((report, ctx) => {
    const pending = report.recommendations.some((r) => r.pendingValidation);
    if (report.contentMode === "production" && pending) {
      ctx.addIssue({
        code: "custom",
        path: ["recommendations"],
        message: "A production report must not contain content pending validation",
      });
    }
    if (pending && report.pendingValidationNotice === null) {
      ctx.addIssue({
        code: "custom",
        path: ["pendingValidationNotice"],
        message: "pendingValidationNotice is required when recommendations are pending validation",
      });
    }
  });
export type ReportPayload = z.infer<typeof ReportPayloadSchema>;
