import "server-only";
import type {
  EmailDeliveryStatus,
  EmailProvider,
  FollowUpMode,
  FollowUpStatus,
  InterestCategory,
  InterestSourceType,
  Language,
  Relevance,
  SessionItemKind,
} from "@/generated/prisma/enums";
import type { Database } from "@/server/db/client";

/**
 * Lead persistence. The service layer depends on the `LeadRepository` interface; this file holds the only
 * Prisma implementation. There is intentionally no "list leads" method: exports run from the CLI (ADR-024).
 */

export type NewLeadInterest = {
  category: InterestCategory;
  value: string;
  relevance: Relevance | null;
  sourceType: InterestSourceType;
};

export type NewSessionItem = { kind: SessionItemKind; value: string; position: number };

export type NewSubmission = {
  lead: {
    id: string;
    firstName: string;
    lastName: string;
    organization: string;
    roleLabel: string;
    businessEmail: string;
    optionalPhone: string | null;
    preferredLanguage: Language;
    sessionId: string;
    reportConsent: true;
    followUpConsent: boolean;
    consentTextVersion: string;
    idempotencyKey: string;
    requestFingerprint: string;
    statusTokenHash: string;
    contentVersion: string;
    /** Internal commercial score (server-only; admin and CSV export only). */
    leadScore: number;
    leadTier: "A" | "B" | "C";
    /** JSON array of { code, points }. */
    leadScoreFactors: string;
    leadScoringVersion: string;
    followUpMode: FollowUpMode;
    followUpStatus: FollowUpStatus;
  };
  interests: NewLeadInterest[];
  session: {
    sessionId: string;
    startedAt: Date;
    completedAt: Date;
    selectedPersona: string | null;
    contentVersion: string;
    items: NewSessionItem[];
  };
  /** Rendered report (ADR-013); null when it could not be built — the lead is stored anyway. */
  report: {
    language: Language;
    subject: string;
    html: string;
    text: string;
    contentVersion: string;
    copyVersion: string;
    /** ReportPayload as JSON, for the follow-up package. */
    payloadJson: string;
  } | null;
  /** Email delivery to queue; null in follow-up modes without automatic email (LOCAL_PACKAGE, ADR-062). */
  delivery: { provider: EmailProvider } | null;
};

export type ExistingSubmission = { leadId: string; requestFingerprint: string; followUpMode: FollowUpMode };

/** Thrown when another request with the same idempotency key committed first (double tap race). */
export class DuplicateRequestError extends Error {
  constructor() {
    super("A submission with this request token already exists");
    this.name = "DuplicateRequestError";
  }
}

export interface LeadRepository {
  findByIdempotencyKey(idempotencyKey: string): Promise<ExistingSubmission | null>;
  /**
   * Stores lead, interests, session summary, report and (in email follow-up modes) a pending email delivery
   * atomically. `deliveryId` is null when no email is queued (LOCAL_PACKAGE).
   */
  createSubmission(
    submission: NewSubmission,
  ): Promise<{ leadId: string; deliveryId: string | null; reportStored: boolean }>;
  /** Latest report-delivery state for a status-token hash, or null if unknown. No personal data. */
  findDeliveryStatusByTokenHash(
    statusTokenHash: string,
  ): Promise<{ found: false } | { found: true; delivery: EmailDeliveryStatus | null }>;
}

const isUniqueViolationOn = (error: unknown, field: string) => {
  const e = error as { code?: unknown; meta?: unknown; message?: unknown };
  if (e?.code !== "P2002") return false;
  // Driver adapters report the target in different shapes; search the metadata and message for the column.
  return JSON.stringify(e.meta ?? {}).includes(field) || String(e.message ?? "").includes(field);
};

export function createPrismaLeadRepository(db: Database): LeadRepository {
  return {
    async findByIdempotencyKey(idempotencyKey) {
      const lead = await db.lead.findUnique({
        where: { idempotencyKey },
        select: { id: true, requestFingerprint: true, followUpMode: true },
      });
      return lead
        ? { leadId: lead.id, requestFingerprint: lead.requestFingerprint, followUpMode: lead.followUpMode }
        : null;
    },

    async createSubmission({ lead, interests, session, report, delivery }) {
      try {
        return await db.$transaction(async (tx) => {
          // One summary per kiosk session: a second lead from the same session refreshes it.
          const summary = await tx.visitorSessionSummary.upsert({
            where: { sessionId: session.sessionId },
            create: {
              sessionId: session.sessionId,
              startedAt: session.startedAt,
              completedAt: session.completedAt,
              selectedPersona: session.selectedPersona,
              contentVersion: session.contentVersion,
            },
            update: {
              completedAt: session.completedAt,
              selectedPersona: session.selectedPersona,
              contentVersion: session.contentVersion,
            },
          });
          await tx.sessionSummaryItem.deleteMany({ where: { summaryId: summary.id } });
          if (session.items.length > 0) {
            await tx.sessionSummaryItem.createMany({
              data: session.items.map((item) => ({ ...item, summaryId: summary.id })),
            });
          }

          await tx.lead.create({ data: lead });
          if (interests.length > 0) {
            await tx.leadInterest.createMany({
              data: interests.map((interest) => ({ ...interest, leadId: lead.id })),
            });
          }
          if (report) await tx.report.create({ data: { ...report, leadId: lead.id } });
          // LOCAL_PACKAGE and other modes without automatic email: no delivery row, no email attempt.
          if (!delivery) return { leadId: lead.id, deliveryId: null, reportStored: report !== null };
          // Without a report there is nothing to send: the delivery is recorded as failed (visible to the
          // operator) instead of retrying forever.
          const created = await tx.emailDelivery.create({
            data: report
              ? { leadId: lead.id, provider: delivery.provider, status: "pending" }
              : {
                  leadId: lead.id,
                  provider: delivery.provider,
                  status: "failed",
                  errorCode: "REPORT_UNAVAILABLE",
                },
            select: { id: true },
          });
          await tx.emailDeliveryEvent.createMany({
            data: report
              ? [{ deliveryId: created.id, eventType: "queued", attempt: 0 }]
              : [
                  { deliveryId: created.id, eventType: "queued", attempt: 0 },
                  {
                    deliveryId: created.id,
                    eventType: "gave_up",
                    attempt: 0,
                    errorCode: "REPORT_UNAVAILABLE",
                  },
                ],
          });
          return { leadId: lead.id, deliveryId: created.id, reportStored: report !== null };
        });
      } catch (error) {
        if (isUniqueViolationOn(error, "idempotencyKey")) throw new DuplicateRequestError();
        throw error;
      }
    },

    async findDeliveryStatusByTokenHash(statusTokenHash) {
      const lead = await db.lead.findUnique({
        where: { statusTokenHash },
        select: {
          emailDeliveries: { select: { status: true }, orderBy: { createdAt: "desc" }, take: 1 },
        },
      });
      if (!lead) return { found: false };
      return { found: true, delivery: lead.emailDeliveries[0]?.status ?? null };
    },
  };
}
