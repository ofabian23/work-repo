import "server-only";

/**
 * OUTLOOK_DRAFT follow-up mode: ARCHITECTURE PLACEHOLDER ONLY (ADR-062). Not implemented and not
 * reachable: `FOLLOW_UP_MODE=OUTLOOK_DRAFT` is refused at start-up with a clear message.
 *
 * Intent: instead of sending automatically, prepare one Outlook draft per lead (report attached or inline)
 * so a Linde representative reviews, personalizes and sends it from their own mailbox. The interfaces
 * below are the contract a future implementation fills; ARCHITECTURE.md §"Follow-up strategies" lists the
 * steps. Two candidate implementations, both needing Linde IT/security approval:
 *
 * 1. Local draft files (no Microsoft 365 integration): write `reports/<leadId>/draft.eml` into the
 *    Convention Export Package with the `X-Unsent: 1` header, which Outlook opens as an editable draft.
 * 2. Microsoft Graph drafts: `POST /users/{mailbox}/messages` creates a draft in a representative's
 *    mailbox. Needs an Entra ID app registration with the Mail.ReadWrite permission and admin consent;
 *    credentials would come from the environment, never from the repository.
 *
 * Constraints any implementation must keep: drafts contain only the visitor-safe report (never the
 * internal score or notes), nothing is sent without a person, no personal data in file names or logs.
 */
export type FollowUpDraft = {
  /** Opaque lead id (file and log key; never a name or email). */
  leadId: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  language: "es" | "en";
};

export type DraftResult = { kind: "file"; path: string } | { kind: "mailbox"; draftId: string };

export interface FollowUpDraftProvider {
  readonly name: "eml-file" | "graph-draft";
  createDraft(draft: FollowUpDraft): Promise<DraftResult>;
}

export class FollowUpModeNotImplementedError extends Error {
  constructor(readonly mode: string) {
    super(`Follow-up mode ${mode} is not implemented`);
    this.name = "FollowUpModeNotImplementedError";
  }
}

/** Always throws: the mode is a documented placeholder. Kept so the wiring point exists. */
export function createOutlookDraftProvider(): FollowUpDraftProvider {
  throw new FollowUpModeNotImplementedError("OUTLOOK_DRAFT");
}
