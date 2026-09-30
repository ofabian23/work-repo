import "server-only";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import type { ContentBundle } from "@/domain/content";
import { buildReviewRows, reviewRowsAsTable, type ReviewRow } from "@/domain/review/content-review";
import { toCsv } from "@/lib/csv";
import type { EmailOutbox } from "@/server/email/email-outbox";
import type { Logger } from "@/server/logging/logger";
import type { AdminFilters } from "./admin-filters";
import type { AdminRepository } from "./admin-repository";

/**
 * Local administration use cases (ADR-056). Exports are built in memory and returned to the handler — never
 * written under public/ and never logged (logs carry counts and filters only). There is no delete.
 */
export const LEAD_CSV_COLUMNS = [
  "lead_id",
  "created_at",
  "first_name",
  "last_name",
  "organization",
  "role",
  "business_email",
  "phone",
  "preferred_language",
  "report_consent",
  "follow_up_consent",
  "consent_text_version",
  "lead_status",
  "report_delivery",
  "delivery_attempts",
  "previously_exported_at",
  "selected_challenges",
  "explicit_interests",
  "form_interests",
  "recommended_solutions",
] as const;

export const INTEREST_CSV_COLUMNS = [
  "lead_id",
  "created_at",
  "organization",
  "business_email",
  "follow_up_consent",
  "category",
  "value",
  "relevance",
  "source_type",
] as const;

export type ExportKind = "leads" | "interests";
export type RetryOutcome = "sent" | "retrying" | "failed" | "skipped" | "not-retryable" | "not-found";

const stamp = (d: Date) => d.toISOString().slice(0, 19).replace(/[:T]/g, "-");

export function createAdminService({
  repo,
  outbox,
  loadContent,
  databaseFile,
  logger,
  now = () => new Date(),
}: {
  repo: AdminRepository;
  outbox: Pick<EmailOutbox, "processDelivery">;
  /** Full content bundle (admin sees internal governance fields). */
  loadContent: () => ContentBundle;
  databaseFile: string;
  logger: Logger;
  now?: () => Date;
}) {
  const auditFilters = (f: AdminFilters) => ({
    from: f.from ?? null,
    to: f.to ?? null,
    status: f.status ?? null,
    delivery: f.delivery ?? null,
    exported: f.exported ?? null,
  });

  return {
    overview: repo.overview,
    listLeads: repo.listLeads,
    leadDetail: repo.leadDetail,

    async retryDelivery(deliveryId: string): Promise<RetryOutcome> {
      const status = await repo.deliveryStatus(deliveryId);
      if (status === null) return "not-found";
      if (status !== "failed" && status !== "retrying") return "not-retryable";
      const outcome = await outbox.processDelivery(deliveryId, { manual: true });
      logger.info("admin.retry", { deliveryId, outcome });
      return outcome;
    },

    async markExported(leadId: string): Promise<boolean> {
      const changed = await repo.markExported([leadId], now());
      logger.info("admin.mark_exported", { leadId, changed });
      return changed > 0;
    },

    async exportCsv(kind: ExportKind, filters: AdminFilters, { markExported = false } = {}) {
      const leads = await repo.exportLeads(filters);
      const values = (lead: (typeof leads)[number], sources: string[], category?: string) =>
        [
          ...new Set(
            lead.interests
              .filter((i) => sources.includes(i.sourceType) && (!category || i.category === category))
              .map((i) => i.value),
          ),
        ].join("; ");
      const rows =
        kind === "leads"
          ? leads.map((lead) => [
              lead.id,
              lead.createdAt.toISOString(),
              lead.firstName,
              lead.lastName,
              lead.organization,
              lead.roleLabel,
              lead.businessEmail,
              lead.optionalPhone ?? "",
              lead.preferredLanguage,
              lead.reportConsent,
              lead.followUpConsent,
              lead.consentTextVersion,
              lead.status,
              lead.emailDeliveries[0]?.status ?? "",
              lead.emailDeliveries[0]?.attempts ?? 0,
              lead.exportedAt?.toISOString() ?? "",
              values(lead, ["session_selection", "form_selection"], "challenge"),
              values(lead, ["explicit_interest"]),
              values(lead, ["form_selection"]),
              values(lead, ["recommendation"]),
            ])
          : leads.flatMap((lead) =>
              lead.interests.map((i) => [
                lead.id,
                lead.createdAt.toISOString(),
                lead.organization,
                lead.businessEmail,
                lead.followUpConsent,
                i.category,
                i.value,
                i.relevance ?? "",
                i.sourceType,
              ]),
            );
      const header = kind === "leads" ? LEAD_CSV_COLUMNS : INTEREST_CSV_COLUMNS;
      const csv = toCsv([[...header], ...rows]);
      const marked = markExported
        ? await repo.markExported(
            leads.map((l) => l.id),
            now(),
          )
        : 0;
      // Counts and filters only: exported data never reaches the logs.
      logger.info("admin.export", {
        kind,
        leads: leads.length,
        rows: rows.length,
        marked,
        ...auditFilters(filters),
      });
      return { filename: `linde-sphere-${kind}-${stamp(now())}.csv`, csv, leads: leads.length, marked };
    },

    contentValidationCsv() {
      const csv = toCsv(reviewRowsAsTable(buildReviewRows(loadContent())));
      logger.info("admin.export", { kind: "content-validation" });
      return { filename: `linde-sphere-content-validation-${stamp(now())}.csv`, csv };
    },

    /** Content items still pending validation (Puerto Rico sales, legal or marketing). */
    pendingValidation(): ReviewRow[] {
      return buildReviewRows(loadContent()).filter(
        (row) => row.validation_status !== "validated" || row.requires_sales_validation === "yes",
      );
    },

    /**
     * Consistent online backup (SQLite backup API) into a private temp folder; the caller streams the
     * bytes and the temp copy is deleted immediately.
     */
    async createBackup(): Promise<{ filename: string; bytes: Buffer }> {
      const dir = mkdtempSync(path.join(os.tmpdir(), "linde-backup-"));
      const file = path.join(dir, "backup.db");
      const source = new Database(databaseFile, { readonly: true, fileMustExist: true });
      try {
        await source.backup(file);
        const bytes = readFileSync(file);
        logger.info("admin.backup", { bytes: bytes.length });
        return { filename: `linde-sphere-backup-${stamp(now())}.db`, bytes };
      } finally {
        source.close();
        rmSync(dir, { recursive: true, force: true });
      }
    },
  };
}

export type AdminService = ReturnType<typeof createAdminService>;
