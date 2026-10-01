import {
  LeadCreatedResponseSchema,
  SubmissionStatusResponseSchema,
  type LeadSubmissionInput,
  type ReportDeliveryState,
} from "@/domain/leads/lead-submission";
import type { VisitorFollowUp } from "@/domain/follow-up/follow-up-mode";

/**
 * Browser client for the lead routes (ADR-052/053). Results are plain outcomes the UI can explain in
 * visitor language; no response bodies, error texts or status codes reach the screen.
 */
export type SubmitOutcome =
  /** `followUp` comes from the server (FOLLOW_UP_MODE of the stored lead, ADR-062). */
  | { kind: "stored"; statusToken: string; followUp: VisitorFollowUp }
  | { kind: "invalid"; fields: { field: string }[] }
  | { kind: "conflict" }
  | { kind: "failed" };

export type LeadApi = {
  submit: (payload: LeadSubmissionInput) => Promise<SubmitOutcome>;
  /** Report-delivery state, or null when it cannot be read right now. */
  status: (statusToken: string) => Promise<ReportDeliveryState | null>;
};

export function createLeadApi({
  fetchImpl = (...args: Parameters<typeof fetch>) => fetch(...args),
  timeoutMs = 15_000,
}: { fetchImpl?: typeof fetch; timeoutMs?: number } = {}): LeadApi {
  const withTimeout = async (input: string, init: RequestInit) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetchImpl(input, { ...init, signal: controller.signal, cache: "no-store" });
    } finally {
      clearTimeout(timer);
    }
  };

  return {
    async submit(payload) {
      try {
        const res = await withTimeout("/api/leads", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.status === 201 || res.status === 200) {
          const body = LeadCreatedResponseSchema.safeParse(await res.json());
          return body.success
            ? { kind: "stored", statusToken: body.data.statusToken, followUp: body.data.followUp }
            : { kind: "failed" };
        }
        if (res.status === 422) {
          const body = (await res.json().catch(() => null)) as { issues?: { field?: unknown }[] } | null;
          const fields = (body?.issues ?? [])
            .map((i) => i.field)
            .filter((f): f is string => typeof f === "string")
            .map((field) => ({ field }));
          return { kind: "invalid", fields };
        }
        if (res.status === 409) return { kind: "conflict" };
        return { kind: "failed" };
      } catch {
        // Network error or timeout: the lead may or may not be stored; retrying with the same request
        // token is safe (the server answers a replay instead of storing twice).
        return { kind: "failed" };
      }
    },

    async status(statusToken) {
      try {
        const res = await withTimeout(`/api/leads/status/${encodeURIComponent(statusToken)}`, {
          method: "GET",
        });
        if (!res.ok) return null;
        const body = SubmissionStatusResponseSchema.safeParse(await res.json());
        return body.success ? body.data.report : null;
      } catch {
        return null;
      }
    },
  };
}

/**
 * What the completion screen reports. "packaged" (LOCAL_PACKAGE and the other modes without automatic email):
 * the summary is prepared and stored for a representative; no email is attempted, so nothing is polled.
 */
export type DeliveryOutcome = "sent" | "delayed" | "queued" | "packaged";

/**
 * Checks the delivery state a few times after the lead is stored. "sent" once the provider accepted the
 * message; "delayed" when an attempt failed (the outbox retries); otherwise "queued" (stored, not sent yet).
 */
export async function awaitDelivery(
  api: LeadApi,
  statusToken: string,
  {
    attempts,
    intervalMs,
    sleep = (ms: number) => new Promise((r) => setTimeout(r, ms)),
  }: {
    attempts: number;
    intervalMs: number;
    sleep?: (ms: number) => Promise<unknown>;
  },
): Promise<DeliveryOutcome> {
  for (let i = 0; i < attempts; i++) {
    if (i > 0) await sleep(intervalMs);
    const state = await api.status(statusToken);
    if (state === "sent") return "sent";
    if (state === "failed" || state === "retrying") return "delayed";
    if (state === "packaged") return "packaged";
  }
  return "queued";
}
