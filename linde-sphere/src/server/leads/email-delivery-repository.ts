import "server-only";
import type { EmailDeliveryStatus } from "@/generated/prisma/enums";
import type { Database } from "@/server/db/client";
import type { SanitizedEmailError } from "./email-error";

/**
 * Email delivery bookkeeping (ADR-011, ADR-054). Updates only EmailDelivery rows and their append-only
 * EmailDeliveryEvent history, never the lead: a failed email can never remove or roll back a stored lead.
 * Stores sanitized codes only, never raw provider output, addresses or message bodies.
 */
export type DeliveryAttemptResult =
  { ok: true; providerMessageId: string | null } | { ok: false; error: SanitizedEmailError };

export type DeliveryUpdate = {
  status: Exclude<EmailDeliveryStatus, "pending">;
  attempts: number;
  nextAttemptAt: Date | null;
};

export type DeliveryMessage = { to: string; subject: string; html: string; text: string };

export type DeliveryOverview = {
  counts: Record<EmailDeliveryStatus, number>;
  /** Deliveries that need attention (failed or retrying): ids, counters and codes — no contact data. */
  attention: {
    id: string;
    status: EmailDeliveryStatus;
    attempts: number;
    errorCode: string | null;
    lastAttemptAt: Date | null;
    nextAttemptAt: Date | null;
  }[];
};

export interface EmailDeliveryRepository {
  /**
   * Atomically claims a delivery for one sending attempt. Automatic attempts require the delivery to be
   * pending/retrying and due; manual retries may also claim failed deliveries. Returns null when another
   * worker holds it or it is not eligible.
   */
  claim(
    deliveryId: string,
    options: { now: Date; claimTimeoutMs: number; manual?: boolean },
  ): Promise<boolean>;
  loadMessage(deliveryId: string): Promise<DeliveryMessage | null>;
  recordAttempt(
    deliveryId: string,
    result: DeliveryAttemptResult,
    options: { at: Date; maxAttempts: number; retryDelayMs: (attempt: number) => number; manual?: boolean },
  ): Promise<DeliveryUpdate>;
  /** Due deliveries, oldest first, at most `limit` (bounded work per tick). */
  findDue(options: { now: Date; limit: number; claimTimeoutMs: number }): Promise<string[]>;
  findIdsByStatus(status: EmailDeliveryStatus): Promise<string[]>;
  overview(): Promise<DeliveryOverview>;
}

/** Exponential backoff: 1 min, 2 min, 4 min … capped at 1 hour. */
export const defaultRetryDelayMs = (attempt: number) => Math.min(60_000 * 2 ** (attempt - 1), 3_600_000);

export function createPrismaEmailDeliveryRepository(db: Database): EmailDeliveryRepository {
  return {
    async claim(deliveryId, { now, claimTimeoutMs, manual = false }) {
      const staleBefore = new Date(now.getTime() - claimTimeoutMs);
      const claimed = await db.emailDelivery.updateMany({
        where: {
          id: deliveryId,
          status: { in: manual ? ["pending", "retrying", "failed"] : ["pending", "retrying"] },
          AND: [
            { OR: [{ claimedAt: null }, { claimedAt: { lt: staleBefore } }] },
            ...(manual ? [] : [{ OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }] }]),
          ],
        },
        data: { claimedAt: now },
      });
      return claimed.count === 1;
    },

    async loadMessage(deliveryId) {
      const delivery = await db.emailDelivery.findUnique({
        where: { id: deliveryId },
        select: {
          lead: {
            select: { businessEmail: true, report: { select: { subject: true, html: true, text: true } } },
          },
        },
      });
      const report = delivery?.lead.report;
      return delivery && report ? { to: delivery.lead.businessEmail, ...report } : null;
    },

    async recordAttempt(deliveryId, result, { at, maxAttempts, retryDelayMs, manual = false }) {
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
            claimedAt: null,
            providerMessageId: result.ok ? result.providerMessageId : null,
            errorCode: result.ok ? null : result.error.code,
          },
        });
        const event = (
          eventType:
            "manual_retry" | "attempt_started" | "sent" | "attempt_failed" | "retry_scheduled" | "gave_up",
          attempt: number,
          extra: { errorCode?: string; providerMessageId?: string | null } = {},
        ) => ({
          deliveryId,
          eventType,
          attempt,
          occurredAt: at,
          errorCode: extra.errorCode ?? null,
          providerMessageId: extra.providerMessageId ?? null,
        });
        const events = [
          ...(manual ? [event("manual_retry", 0)] : []),
          event("attempt_started", attempts),
          ...(result.ok
            ? [event("sent", attempts, { providerMessageId: result.providerMessageId })]
            : [
                event("attempt_failed", attempts, { errorCode: result.error.code }),
                update.status === "retrying"
                  ? event("retry_scheduled", attempts)
                  : event("gave_up", attempts, { errorCode: result.error.code }),
              ]),
        ];
        await tx.emailDeliveryEvent.createMany({ data: events });
        return update;
      });
    },

    async findDue({ now, limit, claimTimeoutMs }) {
      const rows = await db.emailDelivery.findMany({
        where: {
          status: { in: ["pending", "retrying"] },
          AND: [
            { OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }] },
            { OR: [{ claimedAt: null }, { claimedAt: { lt: new Date(now.getTime() - claimTimeoutMs) } }] },
          ],
        },
        orderBy: { createdAt: "asc" },
        take: limit,
        select: { id: true },
      });
      return rows.map((r) => r.id);
    },

    async findIdsByStatus(status) {
      const rows = await db.emailDelivery.findMany({
        where: { status },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      });
      return rows.map((r) => r.id);
    },

    async overview() {
      const grouped = await db.emailDelivery.groupBy({ by: ["status"], _count: { _all: true } });
      const counts: DeliveryOverview["counts"] = { pending: 0, sent: 0, failed: 0, retrying: 0 };
      for (const g of grouped) counts[g.status] = g._count._all;
      const attention = await db.emailDelivery.findMany({
        where: { status: { in: ["failed", "retrying"] } },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          status: true,
          attempts: true,
          errorCode: true,
          lastAttemptAt: true,
          nextAttemptAt: true,
        },
      });
      return { counts, attention };
    },
  };
}
