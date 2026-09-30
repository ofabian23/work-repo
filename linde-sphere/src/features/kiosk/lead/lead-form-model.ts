import type { z } from "zod";
import type { Language, LocalizedText } from "@/domain/content/primitives";
import type { PublicContentBundle } from "@/domain/content/visibility";
import {
  BusinessEmailSchema,
  OrganizationSchema,
  PersonNameSchema,
  PhoneSchema,
  type LeadSubmissionInput,
} from "@/domain/leads/lead-submission";
import { primaryItems, type RecommendationResult } from "@/domain/recommendations/recommendation-result";
import type { SessionSignals } from "@/domain/session/visitor-session";

/**
 * Pure model of the lead form (ADR-053): values, per-step validation with the same Zod schemas the server
 * uses, the payload sent to POST /api/leads, and mapping of server field errors back onto the form.
 * Contact values exist only in the form component's state, never in the kiosk session store.
 */

export type LeadFormValues = {
  firstName: string;
  lastName: string;
  organization: string;
  email: string;
  phone: string;
  roleId: string;
  language: Language;
  interestIds: string[];
  reportConsent: boolean;
  followUpConsent: boolean;
};

export type LeadFormField = keyof LeadFormValues;
export type FieldErrorKind = "required" | "invalid";
export type FieldErrors = Partial<Record<LeadFormField, FieldErrorKind>>;

export const CONTACT_FIELDS = ["firstName", "lastName", "organization", "email", "phone"] as const;
export const PREFERENCE_FIELDS = ["roleId", "reportConsent"] as const;

/** The server accepts at most this many confirmed interests (`selectedInterestIds`). */
export const MAX_FORM_INTERESTS = 15;

export type InterestOption = { id: string; label: LocalizedText; kind: "challenge" | "solution" };

/** Interests prefilled from the session: chosen challenges, recommended solutions, explicit interests. */
export function interestOptions(
  signals: SessionSignals,
  result: RecommendationResult | null,
  content: PublicContentBundle,
): InterestOption[] {
  const challenges = new Map(content.challenges.map((c) => [c.id, c]));
  const solutions = new Map(content.solutions.map((s) => [s.id, s]));
  const options: InterestOption[] = [];
  const seen = new Set<string>();
  const add = (option: InterestOption | null) => {
    if (!option || seen.has(option.id) || options.length >= MAX_FORM_INTERESTS) return;
    seen.add(option.id);
    options.push(option);
  };
  signals.challengeIds.forEach((id) => {
    const c = challenges.get(id);
    add(c ? { id, label: c.label, kind: "challenge" } : null);
  });
  [...primaryItems(result).map((i) => i.solutionId), ...signals.explicitInterestIds].forEach((id) => {
    const s = solutions.get(id);
    add(s && !s.isFallback ? { id, label: s.title, kind: "solution" } : null);
  });
  return options;
}

export function initialValues({
  signals,
  language,
  interests,
}: {
  signals: SessionSignals;
  language: Language;
  interests: InterestOption[];
}): LeadFormValues {
  return {
    firstName: "",
    lastName: "",
    organization: "",
    email: "",
    phone: "",
    roleId: signals.personaId ?? "",
    language,
    interestIds: interests.map((i) => i.id),
    reportConsent: false,
    followUpConsent: false,
  };
}

const kindOf = (schema: z.ZodType, value: string, optional = false): FieldErrorKind | undefined => {
  if (value.trim() === "") return optional ? undefined : "required";
  return schema.safeParse(value).success ? undefined : "invalid";
};

/** Errors for one field (used for inline validation on blur and while correcting). */
export function validateField(field: LeadFormField, values: LeadFormValues): FieldErrorKind | undefined {
  switch (field) {
    case "firstName":
    case "lastName":
      return kindOf(PersonNameSchema, values[field]);
    case "organization":
      return kindOf(OrganizationSchema, values.organization);
    case "email":
      return kindOf(BusinessEmailSchema, values.email);
    case "phone":
      return kindOf(PhoneSchema, values.phone, true);
    case "roleId":
      return values.roleId ? undefined : "required";
    case "reportConsent":
      return values.reportConsent ? undefined : "required";
    default:
      return undefined;
  }
}

export function validateFields(fields: readonly LeadFormField[], values: LeadFormValues): FieldErrors {
  const errors: FieldErrors = {};
  for (const field of fields) {
    const kind = validateField(field, values);
    if (kind) errors[field] = kind;
  }
  return errors;
}

export type SessionContext = { sessionId: string; sessionStartedAt: string; signals: SessionSignals };

/** The JSON body for POST /api/leads (the server validates again and recomputes recommendations). */
export function buildSubmission(
  values: LeadFormValues,
  context: SessionContext & { idempotencyKey: string; consentVersion: string; submittedAt: string },
): LeadSubmissionInput {
  return {
    sessionId: context.sessionId,
    sessionStartedAt: context.sessionStartedAt,
    idempotencyKey: context.idempotencyKey,
    firstName: values.firstName.trim(),
    lastName: values.lastName.trim(),
    organization: values.organization.trim(),
    jobFunctionId: values.roleId,
    email: values.email.trim(),
    phone: values.phone.trim() === "" ? null : values.phone.trim(),
    preferredLanguage: values.language,
    selectedInterestIds: values.interestIds.slice(0, MAX_FORM_INTERESTS),
    consents: { reportDelivery: values.reportConsent as true, salesFollowUp: values.followUpConsent },
    consentVersion: context.consentVersion,
    signals: context.signals,
    submittedAt: context.submittedAt,
  };
}

const SERVER_FIELDS: Record<string, LeadFormField> = {
  firstName: "firstName",
  lastName: "lastName",
  organization: "organization",
  email: "email",
  phone: "phone",
  jobFunctionId: "roleId",
  "consents.reportDelivery": "reportConsent",
};

/** Maps server validation issues (field names only) onto form fields; unknown fields are ignored. */
export function fieldErrorsFromServer(issues: { field: string }[]): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of issues) {
    const field = SERVER_FIELDS[issue.field];
    if (field) errors[field] = "invalid";
  }
  return errors;
}

/** The step that holds the first field with an error (contact details come first). */
export function stepForErrors(errors: FieldErrors): "contact" | "preferences" | null {
  if (CONTACT_FIELDS.some((f) => errors[f])) return "contact";
  if (PREFERENCE_FIELDS.some((f) => errors[f])) return "preferences";
  return null;
}
