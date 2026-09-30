import "server-only";
import type {
  EmailDeliveryStatus,
  EmailProvider,
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
  delivery: { provider: EmailProvider };
};

export type ExistingSubmission = { leadId: string; requestFingerprint: string };

/** Thrown when another request with the same idempotency key committed first (double tap race). */
export class DuplicateRequestError extends Error {
  constructor() {
    super("A submission with this request token already exists");
    this.name = "DuplicateRequestError";
  }
}

export interface LeadRepository {
  findByIdempotencyKey(idempotencyKey: string): Promise<ExistingSubmission | null>;
  /** Stores lead, interests, session summary and a pending email delivery atomically. */
  createSubmission(submission: NewSubmission): Promise<{ leadId: string; deliveryId: string }>;
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
        select: { id: true, requestFingerprint: true },
      });
      return lead ? { leadId: lead.id, requestFingerprint: lead.requestFingerprint } : null;
    },

    async createSubmission({ lead, interests, session, delivery }) {
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
          const created = await tx.emailDelivery.create({
            data: { leadId: lead.id, provider: delivery.provider, status: "pending" },
            select: { id: true },
          });
          return { leadId: lead.id, deliveryId: created.id };
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
