import "server-only";
import type { EmailDeliveryStatus } from "@/generated/prisma/enums";
import type { Database } from "@/server/db/client";
import type { SanitizedEmailError } from "./email-error";

/**
 * Email delivery bookkeeping. Updates only the EmailDelivery row, never the lead: a failed email can never
 * remove or roll back a stored lead (ADR-011). Stores a sanitized code, never raw provider output.
 */
export type DeliveryAttemptResult =
  { ok: true; providerMessageId: string | null } | { ok: false; error: SanitizedEmailError };

export type DeliveryUpdate = { status: EmailDeliveryStatus; attempts: number; nextAttemptAt: Date | null };

export interface EmailDeliveryRepository {
  recordAttempt(
    deliveryId: string,
    result: DeliveryAttemptResult,
    options: { at: Date; maxAttempts: number; retryDelayMs: (attempt: number) => number },
  ): Promise<DeliveryUpdate>;
}

/** Exponential backoff: 1 min, 2 min, 4 min … capped at 1 hour. */
export const defaultRetryDelayMs = (attempt: number) => Math.min(60_000 * 2 ** (attempt - 1), 3_600_000);

export function createPrismaEmailDeliveryRepository(db: Database): EmailDeliveryRepository {
  return {
    async recordAttempt(deliveryId, result, { at, maxAttempts, retryDelayMs }) {
      return db.$transaction(async (tx) => {
        const current = await tx.emailDelivery.findUniqueOrThrow({
          where: { id: deliveryId },
          select: { attempts: true },
        });
        const attempts = current.attempts + 1;
        const update: DeliveryUpdate = result.ok
          ? { status: "sent", attempts, nextAttemptAt: null }
          : result.error.retryable && attempts < maxAttempts
            ? { status: "retrying", attempts, nextAttemptAt: new Date(at.getTime() + retryDelayMs(attempts)) }
            : { status: "failed", attempts, nextAttemptAt: null };
        await tx.emailDelivery.update({
          where: { id: deliveryId },
          data: {
            ...update,
            lastAttemptAt: at,
            providerMessageId: result.ok ? result.providerMessageId : null,
            errorCode: result.ok ? null : result.error.code,
          },
        });
        return update;
      });
    },
  };
}
