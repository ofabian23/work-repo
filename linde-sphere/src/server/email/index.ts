import "server-only";
import { getDatabase } from "@/server/db/client";
import { getServerEnv } from "@/server/env";
import {
  createPrismaEmailDeliveryRepository,
  defaultRetryDelayMs,
} from "@/server/leads/email-delivery-repository";
import { logger } from "@/server/logging/logger";
import { createEmailOutbox, type EmailOutbox } from "./email-outbox";
import { createEmailProvider, senderFor } from "./select-provider";

/** Process-wide email outbox and its periodic worker (ADR-054). */
const globalForEmail = globalThis as unknown as {
  lindeSphereOutbox?: EmailOutbox;
  lindeSphereWorker?: NodeJS.Timeout;
};

export function getEmailOutbox(): EmailOutbox {
  if (globalForEmail.lindeSphereOutbox) return globalForEmail.lindeSphereOutbox;
  const env = getServerEnv();
  globalForEmail.lindeSphereOutbox = createEmailOutbox({
    deliveries: createPrismaEmailDeliveryRepository(getDatabase()),
    provider: createEmailProvider(env),
    sender: senderFor(env),
    maxAttempts: env.EMAIL_MAX_ATTEMPTS,
    retryDelayMs: defaultRetryDelayMs,
    logger,
  });
  return globalForEmail.lindeSphereOutbox;
}

/**
 * Starts the retry worker once per process: every EMAIL_WORKER_INTERVAL_MS it processes at most one batch
 * of due deliveries. A tick never overlaps the previous one, and the timer does not keep the process alive.
 */
export function startEmailWorker(): void {
  if (globalForEmail.lindeSphereWorker) return;
  const env = getServerEnv();
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await getEmailOutbox().processDue();
    } catch (error) {
      const e = error as { name?: unknown; code?: unknown };
      logger.error("email.worker_tick_failed", {
        errorName: String(e?.name ?? "Error"),
        errorCode: e?.code ?? null,
      });
    } finally {
      running = false;
    }
  };
  globalForEmail.lindeSphereWorker = setInterval(tick, env.EMAIL_WORKER_INTERVAL_MS);
  globalForEmail.lindeSphereWorker.unref();
  void tick();
}
