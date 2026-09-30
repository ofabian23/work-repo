import "server-only";

/**
 * Turns any provider error into a short UPPER_SNAKE code plus a retryable flag (ADR-052). Raw messages and
 * provider responses are never kept: they can contain recipient addresses, server banners or credentials.
 */
export type SanitizedEmailError = { code: string; retryable: boolean };

const NETWORK_CODES: Record<string, string> = {
  ETIMEDOUT: "NETWORK_TIMEOUT",
  ESOCKETTIMEDOUT: "NETWORK_TIMEOUT",
  ECONNREFUSED: "CONNECTION_REFUSED",
  ECONNRESET: "CONNECTION_RESET",
  EPIPE: "CONNECTION_RESET",
  ENOTFOUND: "DNS_FAILURE",
  EAI_AGAIN: "DNS_FAILURE",
  EDNS: "DNS_FAILURE",
  ENETUNREACH: "NETWORK_UNREACHABLE",
  EHOSTUNREACH: "NETWORK_UNREACHABLE",
};

/** Nodemailer-style codes. */
const PROVIDER_CODES: Record<string, SanitizedEmailError> = {
  EAUTH: { code: "PROVIDER_AUTH_FAILED", retryable: false },
  EENVELOPE: { code: "RECIPIENT_REJECTED", retryable: false },
  EMESSAGE: { code: "MESSAGE_REJECTED", retryable: false },
  ETLS: { code: "TLS_FAILURE", retryable: true },
  ECONNECTION: { code: "CONNECTION_FAILED", retryable: true },
  ESOCKET: { code: "CONNECTION_FAILED", retryable: true },
  PROVIDER_NOT_CONFIGURED: { code: "PROVIDER_NOT_CONFIGURED", retryable: false },
  REPORT_UNAVAILABLE: { code: "REPORT_UNAVAILABLE", retryable: false },
};

export function sanitizeEmailError(error: unknown): SanitizedEmailError {
  const e = (error ?? {}) as { code?: unknown; responseCode?: unknown };
  const code = typeof e.code === "string" ? e.code.toUpperCase() : undefined;
  if (code && NETWORK_CODES[code]) return { code: NETWORK_CODES[code], retryable: true };
  if (code && PROVIDER_CODES[code]) return PROVIDER_CODES[code];
  if (typeof e.responseCode === "number") {
    // SMTP reply classes: 4xx transient, 5xx permanent.
    if (e.responseCode >= 400 && e.responseCode < 500)
      return { code: "SMTP_TRANSIENT_FAILURE", retryable: true };
    if (e.responseCode >= 500 && e.responseCode < 600)
      return { code: "SMTP_PERMANENT_FAILURE", retryable: false };
  }
  return { code: "UNKNOWN_ERROR", retryable: true };
}
