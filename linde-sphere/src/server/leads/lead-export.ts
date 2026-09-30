import "server-only";
import { toCsv as sharedToCsv } from "@/lib/csv";
import type { Database } from "@/server/db/client";

/**
 * CLI-only lead export (ADR-024: exports run on the laptop, never through a web route). Produces CSV rows
 * for sales follow-up, including consent flags so follow-up respects what each visitor agreed to.
 */
export const LEAD_EXPORT_COLUMNS = [
  "createdAt",
  "firstName",
  "lastName",
  "organization",
  "roleLabel",
  "businessEmail",
  "optionalPhone",
  "preferredLanguage",
  "reportConsent",
  "followUpConsent",
  "consentTextVersion",
  "status",
  "reportDelivery",
  "selectedChallenges",
  "recommendedSolutions",
] as const;

export async function exportLeadRows(db: Database): Promise<string[][]> {
  const leads = await db.lead.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      interests: true,
      emailDeliveries: { select: { status: true }, orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  return leads.map((lead) => {
    const values = (category: string, source: string[]) =>
      [
        ...new Set(
          lead.interests
            .filter((i) => i.category === category && source.includes(i.sourceType))
            .map((i) => i.value),
        ),
      ].join("; ");
    return [
      lead.createdAt.toISOString(),
      lead.firstName,
      lead.lastName,
      lead.organization,
      lead.roleLabel,
      lead.businessEmail,
      lead.optionalPhone ?? "",
      lead.preferredLanguage,
      String(lead.reportConsent),
      String(lead.followUpConsent),
      lead.consentTextVersion,
      lead.status,
      lead.emailDeliveries[0]?.status ?? "",
      values("challenge", ["session_selection", "form_selection"]),
      values("solution", ["recommendation"]),
    ];
  });
}

/** Lead export CSV: header + rows, escaped by the shared writer (formula-injection safe, UTF-8 BOM). */
export function toCsv(header: readonly string[], rows: string[][]): string {
  return sharedToCsv([[...header], ...rows], { bom: false });
}
