import "server-only";
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

/** RFC 4180 quoting plus spreadsheet formula-injection protection (cells starting with = + - @ tab CR). */
export function toCsv(header: readonly string[], rows: string[][]): string {
  const cell = (value: string) => {
    const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
    return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  return [header, ...rows].map((row) => row.map(cell).join(",")).join("\r\n") + "\r\n";
}
