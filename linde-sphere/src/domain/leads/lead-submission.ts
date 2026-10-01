import { z } from "zod";
import { IdSchema, IsoDateTimeSchema, LanguageSchema } from "../content/primitives";
import { SessionSignalsSchema, uniqueIds } from "../session/visitor-session";

/**
 * Payload the kiosk sends to POST /api/leads. Minimum business-contact data only (class C2).
 * No free-text fields beyond name, organization, email and phone (ADR-020). No lead score (ADR-009).
 */

export const PersonNameSchema = z
  .string()
  .trim()
  .min(1, { error: "Required" })
  .max(80)
  .regex(/^[\p{L}\p{M}' ’.-]+$/u, { error: "Use letters, spaces, apostrophes, periods or hyphens" });

export const OrganizationSchema = z
  .string()
  .trim()
  .min(2, { error: "Required" })
  .max(160)
  .regex(/^[\p{L}\p{M}\p{N} &'’.,()/+-]+$/u, { error: "Contains unsupported characters" });

/**
 * Normalized business email: trimmed and lower-cased (addresses are treated case-insensitively, so the same
 * person typing "Ana@X.com" and "ana@x.com" is one address). ASCII addresses only: Zod's email check rejects
 * internationalized addresses, which the email providers used here do not reliably support either.
 */
export const BusinessEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .pipe(z.email({ error: "Enter a valid email address" }));

export const PhoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[\d\s().-]{7,25}$/, { error: "Enter a valid phone number" })
  .refine((p) => p.replace(/\D/g, "").length >= 7, { error: "Enter a valid phone number" });

export const SemverSchema = z.string().regex(/^\d+\.\d+\.\d+$/);

export const LeadConsentsSchema = z.strictObject({
  /** Required to receive the requested report (ADR-019). */
  reportDelivery: z.literal(true, { error: "Consent is required to send your report" }),
  /** Optional broader sales follow-up. Unchecked by default in the UI. */
  salesFollowUp: z.boolean(),
});

export const LeadSubmissionSchema = z.strictObject({
  sessionId: z.uuid(),
  /** When the anonymous kiosk session started (stored in the session summary). */
  sessionStartedAt: IsoDateTimeSchema,
  /**
   * Request token generated once per form (crypto.randomUUID, v4). Repeating a submission with the same
   * key (double tap, retry after network loss) returns the original result instead of a duplicate lead.
   */
  idempotencyKey: z.uuidv4(),
  firstName: PersonNameSchema,
  lastName: PersonNameSchema,
  organization: OrganizationSchema,
  /** Persona id selected as the visitor's job role / function. */
  jobFunctionId: IdSchema,
  email: BusinessEmailSchema,
  phone: PhoneSchema.nullable(),
  preferredLanguage: LanguageSchema,
  /** Challenge and/or solution ids confirmed on the form. */
  selectedInterestIds: uniqueIds(15),
  consents: LeadConsentsSchema,
  /** Version of the consent text shown; the server stores the matching text. */
  consentVersion: SemverSchema,
  /** Signals are sent instead of recommendations; the server recomputes (ADR-025). */
  signals: SessionSignalsSchema,
  submittedAt: IsoDateTimeSchema,
});
export type LeadSubmission = z.infer<typeof LeadSubmissionSchema>;
export type LeadSubmissionInput = z.input<typeof LeadSubmissionSchema>;

/** Opaque, URL-safe status token (256-bit, base64url). It reveals nothing about the lead. */
export const StatusTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

/**
 * The only data returned to the kiosk after a successful submission: no lead id, no personal data.
 * `replayed` is true when the same request token was already processed (double tap or retry).
 */
export const LeadCreatedResponseSchema = z.strictObject({
  statusToken: StatusTokenSchema,
  /** True only when an automatic email was queued (email follow-up modes, ADR-062). */
  emailQueued: z.boolean(),
  /** "package": stored and packaged for a representative (LOCAL_PACKAGE); "email": automatic email. */
  followUp: z.enum(["email", "package"]),
  replayed: z.boolean(),
});
export type LeadCreatedResponse = z.infer<typeof LeadCreatedResponseSchema>;

/** "packaged": no email in this follow-up mode; the report is stored for the follow-up package (ADR-062). */
export const ReportDeliveryStateSchema = z.enum(["pending", "sent", "failed", "retrying", "packaged"]);
export type ReportDeliveryState = z.infer<typeof ReportDeliveryStateSchema>;

/** Public shape of the submission-status lookup: states only, never contact data or error details. */
export const SubmissionStatusResponseSchema = z.strictObject({
  submission: z.literal("stored"),
  report: ReportDeliveryStateSchema,
});
export type SubmissionStatusResponse = z.infer<typeof SubmissionStatusResponseSchema>;
