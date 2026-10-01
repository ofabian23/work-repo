import "server-only";
import type { AdminRepository } from "./admin-repository";

/** CSV layouts shared by the admin exports and the Convention Export Package (ADR-056, ADR-062). */
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
  // Follow-up strategy in force when the lead was stored, and whether it was exported (ADR-062).
  "follow_up_mode",
  "follow_up_status",
  "report_delivery",
  "delivery_attempts",
  "previously_exported_at",
  "selected_challenges",
  "explicit_interests",
  "form_interests",
  "recommended_solutions",
  // Internal commercial score (PROJECT_BRIEF M12, AC-34): weights are assumptions pending sales validation.
  "internal_score",
  "internal_tier",
  "score_factors",
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

export type ExportedLead = Awaited<ReturnType<AdminRepository["exportLeads"]>>[number];

const interestValues = (lead: ExportedLead, sources: string[], category?: string) =>
  [
    ...new Set(
      lead.interests
        .filter((i) => sources.includes(i.sourceType) && (!category || i.category === category))
        .map((i) => i.value),
    ),
  ].join("; ");

/** One row of the lead CSV, in LEAD_CSV_COLUMNS order. */
export function leadCsvRow(lead: ExportedLead): (string | number | boolean)[] {
  return [
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
    lead.followUpMode,
    lead.followUpStatus,
    lead.emailDeliveries[0]?.status ?? "",
    lead.emailDeliveries[0]?.attempts ?? 0,
    lead.exportedAt?.toISOString() ?? "",
    interestValues(lead, ["session_selection", "form_selection"], "challenge"),
    interestValues(lead, ["explicit_interest"]),
    interestValues(lead, ["form_selection"]),
    interestValues(lead, ["recommendation"]),
    lead.leadScore,
    lead.leadTier,
    lead.leadScoreFactors,
  ];
}
