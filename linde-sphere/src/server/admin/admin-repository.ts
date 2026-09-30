import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { Database } from "@/server/db/client";
import { dateRange, DELIVERY_STATUSES, LEAD_STATUSES, type AdminFilters } from "./admin-filters";

/**
 * Read models and the few write actions of the local administration utility (ADR-056). No delete
 * operation exists. Lead ids are opaque UUIDs; nothing here puts personal data into URLs or logs.
 */
export type AdminLeadRow = {
  id: string;
  createdAt: Date;
  name: string;
  organization: string;
  roleLabel: string;
  status: string;
  followUpConsent: boolean;
  exportedAt: Date | null;
  delivery: { id: string; status: string; attempts: number; errorCode: string | null } | null;
};

export type AdminLeadDetail = AdminLeadRow & {
  firstName: string;
  lastName: string;
  businessEmail: string;
  optionalPhone: string | null;
  preferredLanguage: string;
  reportConsent: boolean;
  consentTextVersion: string;
  contentVersion: string;
  interests: { category: string; value: string; relevance: string | null; sourceType: string }[];
  deliveries: {
    id: string;
    provider: string;
    status: string;
    attempts: number;
    errorCode: string | null;
    lastAttemptAt: Date | null;
    nextAttemptAt: Date | null;
    events: { eventType: string; attempt: number; occurredAt: Date; errorCode: string | null }[];
  }[];
  report: { subject: string; language: string; createdAt: Date } | null;
};

export type AdminOverview = {
  total: number;
  byStatus: Record<(typeof LEAD_STATUSES)[number], number>;
  byDelivery: Record<(typeof DELIVERY_STATUSES)[number], number>;
  exported: number;
};

export function leadWhere(filters: AdminFilters): Prisma.LeadWhereInput {
  const range = dateRange(filters);
  return {
    ...(range.gte || range.lte ? { createdAt: range } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.delivery ? { emailDeliveries: { some: { status: filters.delivery } } } : {}),
    ...(filters.exported === "yes" ? { exportedAt: { not: null } } : {}),
    ...(filters.exported === "no" ? { exportedAt: null } : {}),
  };
}

const latestDelivery = {
  emailDeliveries: {
    select: { id: true, status: true, attempts: true, errorCode: true },
    orderBy: { createdAt: "desc" },
    take: 1,
  },
} as const;

export function createAdminRepository(db: Database) {
  return {
    async overview(filters: AdminFilters): Promise<AdminOverview> {
      const where = leadWhere(filters);
      const [total, statuses, deliveries, exported] = await Promise.all([
        db.lead.count({ where }),
        db.lead.groupBy({ by: ["status"], where, _count: { _all: true } }),
        db.emailDelivery.groupBy({ by: ["status"], where: { lead: where }, _count: { _all: true } }),
        db.lead.count({ where: { AND: [where, { exportedAt: { not: null } }] } }),
      ]);
      const byStatus = Object.fromEntries(LEAD_STATUSES.map((s) => [s, 0])) as AdminOverview["byStatus"];
      for (const g of statuses) byStatus[g.status] = g._count._all;
      const byDelivery = Object.fromEntries(
        DELIVERY_STATUSES.map((s) => [s, 0]),
      ) as AdminOverview["byDelivery"];
      for (const g of deliveries) byDelivery[g.status] = g._count._all;
      return { total, byStatus, byDelivery, exported };
    },

    async listLeads(filters: AdminFilters, pageSize = 50): Promise<{ rows: AdminLeadRow[]; total: number }> {
      const where = leadWhere(filters);
      const [total, leads] = await Promise.all([
        db.lead.count({ where }),
        db.lead.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: (filters.page - 1) * pageSize,
          take: pageSize,
          select: {
            id: true,
            createdAt: true,
            firstName: true,
            lastName: true,
            organization: true,
            roleLabel: true,
            status: true,
            followUpConsent: true,
            exportedAt: true,
            ...latestDelivery,
          },
        }),
      ]);
      return {
        total,
        rows: leads.map(({ firstName, lastName, emailDeliveries, ...lead }) => ({
          ...lead,
          name: `${firstName} ${lastName}`,
          delivery: emailDeliveries[0] ?? null,
        })),
      };
    },

    async leadDetail(id: string): Promise<AdminLeadDetail | null> {
      const lead = await db.lead.findUnique({
        where: { id },
        include: {
          interests: { orderBy: [{ sourceType: "asc" }, { category: "asc" }, { value: "asc" }] },
          emailDeliveries: {
            orderBy: { createdAt: "desc" },
            include: { events: { orderBy: [{ occurredAt: "asc" }, { attempt: "asc" }] } },
          },
          report: { select: { subject: true, language: true, createdAt: true } },
        },
      });
      if (!lead) return null;
      const latest = lead.emailDeliveries[0];
      return {
        id: lead.id,
        createdAt: lead.createdAt,
        name: `${lead.firstName} ${lead.lastName}`,
        firstName: lead.firstName,
        lastName: lead.lastName,
        organization: lead.organization,
        roleLabel: lead.roleLabel,
        businessEmail: lead.businessEmail,
        optionalPhone: lead.optionalPhone,
        preferredLanguage: lead.preferredLanguage,
        status: lead.status,
        reportConsent: lead.reportConsent,
        followUpConsent: lead.followUpConsent,
        consentTextVersion: lead.consentTextVersion,
        contentVersion: lead.contentVersion,
        exportedAt: lead.exportedAt,
        interests: lead.interests.map(({ category, value, relevance, sourceType }) => ({
          category,
          value,
          relevance,
          sourceType,
        })),
        delivery: latest
          ? { id: latest.id, status: latest.status, attempts: latest.attempts, errorCode: latest.errorCode }
          : null,
        deliveries: lead.emailDeliveries.map((d) => ({
          id: d.id,
          provider: d.provider,
          status: d.status,
          attempts: d.attempts,
          errorCode: d.errorCode,
          lastAttemptAt: d.lastAttemptAt,
          nextAttemptAt: d.nextAttemptAt,
          events: d.events.map(({ eventType, attempt, occurredAt, errorCode }) => ({
            eventType,
            attempt,
            occurredAt,
            errorCode,
          })),
        })),
        report: lead.report,
      };
    },

    /** Marks leads as exported (first export time is kept). Returns how many changed. */
    async markExported(ids: string[], at: Date): Promise<number> {
      if (ids.length === 0) return 0;
      const result = await db.lead.updateMany({
        where: { id: { in: ids }, exportedAt: null },
        data: { exportedAt: at },
      });
      return result.count;
    },

    async deliveryStatus(deliveryId: string): Promise<string | null> {
      const d = await db.emailDelivery.findUnique({ where: { id: deliveryId }, select: { status: true } });
      return d?.status ?? null;
    },

    /** Everything needed for the CSV exports, oldest first. */
    async exportLeads(filters: AdminFilters) {
      return db.lead.findMany({
        where: leadWhere(filters),
        orderBy: { createdAt: "asc" },
        include: {
          interests: { orderBy: [{ sourceType: "asc" }, { category: "asc" }, { value: "asc" }] },
          ...latestDelivery,
        },
      });
    },
  };
}

export type AdminRepository = ReturnType<typeof createAdminRepository>;
