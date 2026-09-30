import "server-only";
import type { EmailProviderName } from "@/domain/email/email-delivery-event";

/**
 * Email provider abstraction (ADR-012, ADR-054). Providers throw on failure; the outbox turns any error
 * into a sanitized code (`sanitizeEmailError`) and never stores or logs the raw error.
 */
export type EmailMessage = {
  to: string;
  from: string;
  replyTo?: string;
  subject: string;
  html: string;
  text: string;
};

export interface EmailProvider {
  readonly name: EmailProviderName;
  /** false for the development preview provider, which never leaves the machine. */
  readonly deliversExternally: boolean;
  send(message: EmailMessage, meta: { deliveryId: string }): Promise<{ messageId: string }>;
}

/** Error with a stable code that `sanitizeEmailError` recognizes (no message is ever stored). */
export class EmailProviderError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "EmailProviderError";
  }
}
