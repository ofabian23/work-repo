import { z } from "zod";
import { IsoDateTimeSchema } from "../content/primitives";

/**
 * Append-only history of one outbox message. Events never contain recipient addresses or message
 * bodies (class C2 data stays in Lead/Report); error text is sanitized and short.
 */

export const EmailProviderNameSchema = z.enum(["file", "smtp", "graph"]);
export type EmailProviderName = z.infer<typeof EmailProviderNameSchema>;

export const EmailEventTypeSchema = z.enum([
  "queued",
  "attempt-started",
  "sent",
  "attempt-failed",
  "retry-scheduled",
  "gave-up",
  "cancelled",
]);
export type EmailEventType = z.infer<typeof EmailEventTypeSchema>;

const EMAIL_ADDRESS_PATTERN = /[^\s@]+@[^\s@]+\.[^\s@]+/;

export const EmailDeliveryEventSchema = z
  .strictObject({
    id: z.string().min(1).max(64),
    outboxId: z.string().min(1).max(64),
    leadId: z.string().min(1).max(64),
    kind: z.literal("visitor-report"),
    eventType: EmailEventTypeSchema,
    /** 0 for `queued`; 1-based for attempt-related events. */
    attempt: z.number().int().min(0).max(50),
    provider: EmailProviderNameSchema,
    occurredAt: IsoDateTimeSchema,
    providerMessageId: z.string().min(1).max(200).nullable(),
    errorCode: z
      .string()
      .regex(/^[A-Z0-9_]{2,40}$/, { error: "Use an UPPER_SNAKE_CASE code, e.g. SMTP_TIMEOUT" })
      .nullable(),
    errorMessage: z
      .string()
      .max(300)
      .refine((m) => !EMAIL_ADDRESS_PATTERN.test(m), {
        error: "Error messages must not contain email addresses (sanitize provider errors)",
      })
      .nullable(),
    retryable: z.boolean().nullable(),
    nextAttemptAt: IsoDateTimeSchema.nullable(),
  })
  .superRefine((e, ctx) => {
    const issue = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });
    if (e.eventType === "queued" && e.attempt !== 0) issue("attempt", "A queued event has attempt 0");
    if (e.eventType !== "queued" && e.eventType !== "cancelled" && e.attempt < 1) {
      issue("attempt", `A '${e.eventType}' event requires attempt ≥ 1`);
    }
    if ((e.eventType === "attempt-failed" || e.eventType === "gave-up") && e.errorCode === null) {
      issue("errorCode", `errorCode is required for '${e.eventType}'`);
    }
    if (e.eventType === "attempt-failed" && e.retryable === null) {
      issue("retryable", "retryable is required for 'attempt-failed'");
    }
    if (e.eventType === "sent" && e.providerMessageId === null) {
      issue("providerMessageId", "providerMessageId is required for 'sent'");
    }
    if (e.eventType === "sent" && e.errorCode !== null)
      issue("errorCode", "A sent event cannot carry an error");
    if (e.eventType === "retry-scheduled") {
      if (e.nextAttemptAt === null) issue("nextAttemptAt", "nextAttemptAt is required for 'retry-scheduled'");
      else if (Date.parse(e.nextAttemptAt) <= Date.parse(e.occurredAt)) {
        issue("nextAttemptAt", "nextAttemptAt must be after occurredAt");
      }
    }
    if (e.eventType !== "retry-scheduled" && e.nextAttemptAt !== null) {
      issue("nextAttemptAt", "nextAttemptAt is only set on 'retry-scheduled' events");
    }
  });
export type EmailDeliveryEvent = z.infer<typeof EmailDeliveryEventSchema>;
