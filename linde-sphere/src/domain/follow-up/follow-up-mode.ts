/**
 * Follow-up strategies (ADR-062): what happens after a visitor asks for their personalized summary.
 * Zod-free on purpose: the kiosk client reads these values to adapt its copy (ADR-058).
 *
 * - LOCAL_PACKAGE (default, the convention workflow): the lead and the rendered report (HTML, text, JSON)
 *   are stored locally and marked follow_up_pending; no email is attempted. The Convention Export
 *   Package (reports + leads.csv) is the output handed to the sales team.
 * - SMTP_EMAIL: the existing email outbox delivers the report automatically through the configured
 *   EMAIL_PROVIDER (smtp for real delivery; preview is a dry run that never sends).
 * - MICROSOFT_GRAPH: email through Microsoft Graph. The provider exists as a placeholder only.
 * - OUTLOOK_DRAFT: prepare Outlook drafts for a representative to review and send. Placeholder only.
 * - FUTURE_CRM: reserved for a CRM hand-off; not configurable yet.
 *
 * Switching from LOCAL_PACKAGE to SMTP_EMAIL needs configuration only (FOLLOW_UP_MODE, EMAIL_PROVIDER and
 * the SMTP_* settings), no code change.
 */
export const FOLLOW_UP_MODES = [
  "LOCAL_PACKAGE",
  "SMTP_EMAIL",
  "MICROSOFT_GRAPH",
  "OUTLOOK_DRAFT",
  "FUTURE_CRM",
] as const;
export type FollowUpMode = (typeof FOLLOW_UP_MODES)[number];

/** Values FOLLOW_UP_MODE accepts (FUTURE_CRM is reserved and refused). */
export const CONFIGURABLE_FOLLOW_UP_MODES = [
  "LOCAL_PACKAGE",
  "SMTP_EMAIL",
  "MICROSOFT_GRAPH",
  "OUTLOOK_DRAFT",
] as const satisfies readonly FollowUpMode[];

export const DEFAULT_FOLLOW_UP_MODE: FollowUpMode = "LOCAL_PACKAGE";

/** Modes that work today. The others are recognized, documented and refused at start-up with a reason. */
export const IMPLEMENTED_FOLLOW_UP_MODES: readonly FollowUpMode[] = ["LOCAL_PACKAGE", "SMTP_EMAIL"];

/** Modes whose follow-up is an automatic email through the outbox (provider chosen by configuration). */
export function usesEmailOutbox(mode: FollowUpMode): boolean {
  return mode === "SMTP_EMAIL" || mode === "MICROSOFT_GRAPH";
}

/** Follow-up status of a lead (stored on Lead). */
export const FOLLOW_UP_STATUSES = ["follow_up_pending", "exported"] as const;
export type FollowUpStatus = (typeof FOLLOW_UP_STATUSES)[number];
/** "FollowUpPending": stored and packaged; a representative still has to follow up. */
export const FOLLOW_UP_PENDING: FollowUpStatus = "follow_up_pending";

/** What the kiosk needs to know to choose its wording: an automatic email, or a prepared package. */
export type VisitorFollowUp = "email" | "package";
export const visitorFollowUp = (mode: FollowUpMode): VisitorFollowUp =>
  usesEmailOutbox(mode) ? "email" : "package";
