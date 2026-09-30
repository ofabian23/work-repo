import "server-only";
import type { EmailDeliveryRepository } from "@/server/leads/email-delivery-repository";
import { sanitizeEmailError } from "@/server/leads/email-error";
import type { Logger } from "@/server/logging/logger";
import type { EmailProvider } from "./email-provider";

/**
 * Transactional outbox worker (ADR-011, ADR-054). The lead, its report and a pending delivery are stored
 * first (one transaction); this module only attempts delivery afterwards:
 *   claim atomically → load the stored report → send → mark sent, or retrying (backoff) / failed.
 * Retries are bounded by `maxAttempts`, each tick handles at most `batchSize` deliveries, and nothing
 * re-schedules itself recursively, so it can never loop indefinitely. Errors become sanitized codes.
 */
export type AttemptOutcome = "sent" | "retrying" | "failed" | "skipped";

export type EmailOutboxDeps = {
  deliveries: EmailDeliveryRepository;
  provider: EmailProvider;
  sender: { from: string; replyTo?: string };
  maxAttempts: number;
  retryDelayMs: (attempt: number) => number;
  logger: Logger;
  now?: () => Date;
  /** A claim older than this is considered abandoned (process crashed mid-send). */
  claimTimeoutMs?: number;
  batchSize?: number;
};

export function createEmailOutbox({
  deliveries,
  provider,
  sender,
  maxAttempts,
  retryDelayMs,
  logger,
  now = () => new Date(),
  claimTimeoutMs = 5 * 60_000,
  batchSize = 10,
}: EmailOutboxDeps) {
  async function processDelivery(deliveryId: string, { manual = false } = {}): Promise<AttemptOutcome> {
    const claimed = await deliveries.claim(deliveryId, { now: now(), claimTimeoutMs, manual });
    if (!claimed) return "skipped";

    const message = await deliveries.loadMessage(deliveryId);
    let result: Parameters<EmailDeliveryRepository["recordAttempt"]>[1];
    if (!message) {
      result = { ok: false, error: sanitizeEmailError({ code: "REPORT_UNAVAILABLE" }) };
    } else {
      try {
        const sent = await provider.send({ ...sender, ...message }, { deliveryId });
        result = { ok: true, providerMessageId: sent.messageId };
      } catch (error) {
        result = { ok: false, error: sanitizeEmailError(error) };
      }
    }
    const update = await deliveries.recordAttempt(deliveryId, result, {
      at: now(),
      maxAttempts,
      retryDelayMs,
      manual,
    });
    const log = update.status === "sent" ? logger.info : logger.warn;
    log(`email.${update.status}`, {
      deliveryId,
      provider: provider.name,
      attempt: update.attempts,
      errorCode: result.ok ? null : result.error.code,
      manual,
    });
    return update.status;
  }

  async function processDue(): Promise<{ processed: number }> {
    const due = await deliveries.findDue({ now: now(), limit: batchSize, claimTimeoutMs });
    let processed = 0;
    for (const id of due) {
      if ((await processDelivery(id)) !== "skipped") processed++;
    }
    return { processed };
  }

  return {
    processDelivery,
    processDue,
    /** Attempts delivery soon after the HTTP response (never awaited by the request). */
    schedule(deliveryId: string) {
      setTimeout(() => {
        processDelivery(deliveryId).catch((error: unknown) =>
          logger.error("email.attempt_crashed", { deliveryId, error: sanitizeEmailError(error).code }),
        );
      }, 0);
    },
  };
}

export type EmailOutbox = ReturnType<typeof createEmailOutbox>;
