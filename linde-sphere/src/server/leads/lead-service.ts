import "server-only";
import { createHash, randomUUID } from "node:crypto";
import type { PublicContentBundle } from "@/domain/content/visibility";
import type { EmailProviderName } from "@/domain/email/email-delivery-event";
import {
  LeadSubmissionSchema,
  StatusTokenSchema,
  type LeadCreatedResponse,
  type LeadSubmission,
  type SubmissionStatusResponse,
} from "@/domain/leads/lead-submission";
import { recommend } from "@/domain/recommendations/engine";
import { recommendationEvidence } from "@/domain/recommendations/recommendation-stability";
import type { SessionSignals } from "@/domain/session/visitor-session";
import type { Logger } from "@/server/logging/logger";
import { buildReportPayload } from "@/server/report/build-report-payload";
import { RecommendationReadiness } from "@/domain/recommendations/recommendation-readiness";
import { scoreLead } from "./lead-scoring";
import {
  FOLLOW_UP_PENDING,
  usesEmailOutbox,
  visitorFollowUp,
  type FollowUpMode,
} from "@/domain/follow-up/follow-up-mode";
import { renderReport } from "@/server/report/render-report";
import { sanitizeEmailError } from "./email-error";
import {
  DuplicateRequestError,
  type LeadRepository,
  type NewLeadInterest,
  type NewSessionItem,
  type NewSubmission,
} from "./lead-repository";
import { deriveStatusToken, hashStatusToken } from "./status-token";

/**
 * Lead capture use case (ADR-052). Validates with Zod on the server, checks the payload against the
 * content the kiosk is serving, recomputes recommendations (ADR-025), and stores everything in one
 * transaction. Idempotent per request token. Never logs contact data: only ids and outcomes.
 */

export type FieldIssue = { field: string; code: string; message: string };

export type SubmitLeadResult =
  | { outcome: "created" | "replayed"; response: LeadCreatedResponse }
  | { outcome: "invalid"; issues: FieldIssue[] }
  | { outcome: "conflict" };

export type LeadServiceDeps = {
  leads: LeadRepository;
  content: () => PublicContentBundle;
  /** Follow-up strategy (FOLLOW_UP_MODE, ADR-062). Only email modes queue an email delivery. */
  followUpMode: FollowUpMode;
  /** Email transport for the email follow-up modes (EMAIL_PROVIDER). */
  emailProvider: EmailProviderName;
  /** Wakes the email outbox after commit. Failures are logged and never affect the stored lead. */
  onDeliveryQueued?: (deliveryId: string) => void | Promise<void>;
  logger: Logger;
  now?: () => Date;
  newId?: () => string;
};

/** Allowed clock difference between the kiosk and the server for `sessionStartedAt`. */
const MAX_CLOCK_SKEW_MS = 5 * 60_000;

export function createLeadService({
  leads,
  content,
  followUpMode,
  emailProvider,
  onDeliveryQueued,
  logger,
  now = () => new Date(),
  newId = randomUUID,
}: LeadServiceDeps) {
  // A replay answers with the follow-up kind of the original lead, whatever the mode is now.
  const replay = (idempotencyKey: string, leadId: string, mode: FollowUpMode): SubmitLeadResult => ({
    outcome: "replayed",
    response: {
      statusToken: deriveStatusToken(idempotencyKey, leadId),
      emailQueued: usesEmailOutbox(mode),
      followUp: visitorFollowUp(mode),
      replayed: true,
    },
  });

  const resolveExisting = async (submission: LeadSubmission, fingerprint: string) => {
    const existing = await leads.findByIdempotencyKey(submission.idempotencyKey);
    if (!existing) return null;
    if (existing.requestFingerprint !== fingerprint) {
      logger.warn("lead.idempotency_conflict", { leadId: existing.leadId });
      return { outcome: "conflict" } as const;
    }
    logger.info("lead.replayed", { leadId: existing.leadId });
    return replay(submission.idempotencyKey, existing.leadId, existing.followUpMode);
  };

  return {
    async submitLead(input: unknown): Promise<SubmitLeadResult> {
      const parsed = LeadSubmissionSchema.safeParse(input);
      if (!parsed.success) {
        const issues = parsed.error.issues.map((i) => ({
          field: i.path.join(".") || "(body)",
          code: i.code,
          message: i.message,
        }));
        logger.info("lead.rejected", { reason: "validation", fields: issues.map((i) => i.field) });
        return { outcome: "invalid", issues };
      }
      const submission = parsed.data;
      const bundle = content();
      const receivedAt = now();

      const issues = checkAgainstContent(submission, bundle, receivedAt);
      if (issues.length > 0) {
        logger.info("lead.rejected", { reason: "content", fields: issues.map((i) => i.field) });
        return { outcome: "invalid", issues };
      }

      const fingerprint = fingerprintOf(submission);
      const existing = await resolveExisting(submission, fingerprint);
      if (existing) return existing;

      const leadId = newId();
      const record = buildSubmission(submission, bundle, {
        leadId,
        fingerprint,
        receivedAt,
        followUpMode,
        provider: emailProvider,
      });
      if (!record.report) logger.error("report.unavailable", { leadId });

      let deliveryId: string | null;
      let reportStored: boolean;
      try {
        ({ deliveryId, reportStored } = await leads.createSubmission(record));
      } catch (error) {
        // Two taps raced past the lookup: the other request committed first, so answer as a replay.
        if (error instanceof DuplicateRequestError) {
          const raced = await resolveExisting(submission, fingerprint);
          if (raced) return raced;
        }
        throw error;
      }
      logger.info("lead.stored", {
        leadId,
        deliveryId,
        interests: record.interests.length,
        followUpConsent: record.lead.followUpConsent,
        followUpMode,
      });

      try {
        // Email modes only: LOCAL_PACKAGE stores no delivery, so there is nothing to send (ADR-062).
        if (deliveryId && reportStored) await onDeliveryQueued?.(deliveryId);
      } catch (error) {
        logger.warn("email.dispatch_failed", { leadId, deliveryId, error: sanitizeEmailError(error).code });
      }

      return {
        outcome: "created",
        response: {
          statusToken: deriveStatusToken(submission.idempotencyKey, leadId),
          emailQueued: deliveryId !== null && reportStored,
          followUp: visitorFollowUp(followUpMode),
          replayed: false,
        },
      };
    },

    async getSubmissionStatus(token: unknown): Promise<SubmissionStatusResponse | null> {
      const parsed = StatusTokenSchema.safeParse(token);
      if (!parsed.success) return null;
      const result = await leads.findDeliveryStatusByTokenHash(hashStatusToken(parsed.data));
      if (!result.found) return null;
      // No delivery row: the lead was stored in a follow-up mode without automatic email (ADR-062).
      return { submission: "stored", report: result.delivery ?? "packaged" };
    },
  };
}

export type LeadService = ReturnType<typeof createLeadService>;

function checkAgainstContent(s: LeadSubmission, bundle: PublicContentBundle, receivedAt: Date): FieldIssue[] {
  const issues: FieldIssue[] = [];
  const issue = (field: string, code: string, message: string) => issues.push({ field, code, message });
  if (!bundle.consent || !bundle.report) {
    // Production without approved consent text or report copy (ADR-060): no lead may be collected.
    issue("consentVersion", "lead_capture_unavailable", "Lead capture is not available");
  } else if (s.consentVersion !== bundle.consent.version) {
    issue(
      "consentVersion",
      "consent_version_mismatch",
      "The consent text has changed; please review it again",
    );
  }
  if (!bundle.personas.some((p) => p.id === s.jobFunctionId)) {
    issue("jobFunctionId", "unknown_option", "Choose one of the listed roles");
  }
  const interestIds = new Set([...bundle.challenges, ...bundle.solutions].map((x) => x.id));
  s.selectedInterestIds.forEach((id, i) => {
    if (!interestIds.has(id)) issue(`selectedInterestIds.${i}`, "unknown_option", "Unknown interest");
  });
  if (Date.parse(s.sessionStartedAt) > receivedAt.getTime() + MAX_CLOCK_SKEW_MS) {
    issue("sessionStartedAt", "in_future", "The session start time is in the future");
  }
  return issues;
}

/** Keeps only ids that exist in the served content, so stored summaries never contain arbitrary strings. */
function knownSignals(signals: SessionSignals, bundle: PublicContentBundle): SessionSignals {
  const has = (ids: Iterable<string>) => {
    const set = new Set(ids);
    return (id: string) => set.has(id);
  };
  const persona = has(bundle.personas.map((p) => p.id));
  const facility = has(bundle.facilityTypes.map((f) => f.id));
  const opened = signals.openedHotspotIds.filter(
    has(bundle.scenes.flatMap((s) => s.hotspots.map((h) => h.id))),
  );
  return {
    personaId: signals.personaId && persona(signals.personaId) ? signals.personaId : null,
    challengeIds: signals.challengeIds.filter(has(bundle.challenges.map((c) => c.id))),
    facilityTypeId:
      signals.facilityTypeId && facility(signals.facilityTypeId) ? signals.facilityTypeId : null,
    visitedSceneIds: signals.visitedSceneIds.filter(has(bundle.scenes.map((s) => s.id))),
    openedHotspotIds: opened,
    engagedHotspotIds: signals.engagedHotspotIds.filter(has(opened)),
    explicitInterestIds: signals.explicitInterestIds.filter(has(bundle.solutions.map((s) => s.id))),
  };
}

function buildSubmission(
  s: LeadSubmission,
  bundle: PublicContentBundle,
  ctx: {
    leadId: string;
    fingerprint: string;
    receivedAt: Date;
    followUpMode: FollowUpMode;
    provider: EmailProviderName;
  },
): NewSubmission {
  const signals = knownSignals(s.signals, bundle);
  // Same evidence rule as the kiosk (ADR-051): only choices and content actually opened count.
  const evidence = recommendationEvidence(signals, bundle.scenes);
  const result = recommend(evidence, bundle);
  const challengeIds = new Set(bundle.challenges.map((c) => c.id));
  const persona = bundle.personas.find((p) => p.id === s.jobFunctionId);

  const interests = new Map<string, NewLeadInterest>();
  const add = (interest: NewLeadInterest) =>
    interests.set(`${interest.category}:${interest.value}:${interest.sourceType}`, interest);
  add({ category: "role", value: s.jobFunctionId, relevance: null, sourceType: "form_selection" });
  if (signals.personaId) {
    add({ category: "role", value: signals.personaId, relevance: null, sourceType: "session_selection" });
  }
  signals.challengeIds.forEach((value) =>
    add({ category: "challenge", value, relevance: null, sourceType: "session_selection" }),
  );
  signals.explicitInterestIds.forEach((value) =>
    add({ category: "solution", value, relevance: null, sourceType: "explicit_interest" }),
  );
  s.selectedInterestIds.forEach((value) =>
    add({
      category: challengeIds.has(value) ? "challenge" : "solution",
      value,
      relevance: null,
      sourceType: "form_selection",
    }),
  );
  (result?.items ?? []).forEach((item) =>
    add({
      category: "solution",
      value: item.solutionId,
      relevance: item.relevanceLevel,
      sourceType: "recommendation",
    }),
  );

  // Internal commercial score (server-only): from the same known signals and the form answers.
  const formChallenges = s.selectedInterestIds.filter((id) => challengeIds.has(id));
  const formSolutions = s.selectedInterestIds.filter((id) => !challengeIds.has(id));
  const score = scoreLead({
    roleId: s.jobFunctionId,
    challengeCount: new Set([...signals.challengeIds, ...formChallenges]).size,
    explicitInterestCount: new Set([...signals.explicitInterestIds, ...formSolutions]).size,
    meaningfulHotspots: RecommendationReadiness.meaningfulInteractions(signals, bundle.scenes).hotspotIds
      .length,
    facilityTypeKnown: signals.facilityTypeId !== null,
    followUpConsent: s.consents.salesFollowUp,
    email: s.email,
  });

  const items = (kind: NewSessionItem["kind"], values: string[]) =>
    values.map((value, position) => ({ kind, value, position }));

  return {
    lead: {
      id: ctx.leadId,
      firstName: s.firstName,
      lastName: s.lastName,
      organization: s.organization,
      // Stored in Spanish (the source language) so exports read the same whatever language the visitor used.
      roleLabel: persona?.label.es ?? s.jobFunctionId,
      businessEmail: s.email,
      optionalPhone: s.phone === null ? null : s.phone.replace(/\s+/g, " "),
      preferredLanguage: s.preferredLanguage,
      sessionId: s.sessionId,
      reportConsent: s.consents.reportDelivery,
      followUpConsent: s.consents.salesFollowUp,
      consentTextVersion: s.consentVersion,
      idempotencyKey: s.idempotencyKey,
      requestFingerprint: ctx.fingerprint,
      statusTokenHash: hashStatusToken(deriveStatusToken(s.idempotencyKey, ctx.leadId)),
      contentVersion: bundle.manifest.contentVersion,
      leadScore: score.score,
      leadTier: score.tier,
      leadScoreFactors: JSON.stringify(score.factors),
      leadScoringVersion: score.version,
      followUpMode: ctx.followUpMode,
      followUpStatus: FOLLOW_UP_PENDING,
    },
    interests: [...interests.values()],
    session: {
      sessionId: s.sessionId,
      startedAt: new Date(s.sessionStartedAt),
      completedAt: ctx.receivedAt,
      selectedPersona: signals.personaId,
      contentVersion: bundle.manifest.contentVersion,
      items: [
        ...items("challenge", signals.challengeIds),
        ...items("scene", signals.visitedSceneIds),
        ...items("hotspot", signals.openedHotspotIds),
        ...items(
          "recommendation",
          (result?.items ?? []).map((i) => i.solutionId),
        ),
      ],
    },
    report: renderStoredReport(s, bundle, {
      leadId: ctx.leadId,
      generatedAt: ctx.receivedAt,
      priorityIds: [...signals.challengeIds, ...s.selectedInterestIds.filter((id) => challengeIds.has(id))],
      exploredSceneIds: evidence.visitedSceneIds,
      result,
    }),
    delivery: usesEmailOutbox(ctx.followUpMode) ? { provider: ctx.provider } : null,
  };
}

/** Builds and renders the report in the visitor's language; null (never a thrown error) if impossible. */
function renderStoredReport(
  s: LeadSubmission,
  bundle: PublicContentBundle,
  ctx: Pick<
    Parameters<typeof buildReportPayload>[0],
    "leadId" | "generatedAt" | "priorityIds" | "exploredSceneIds" | "result"
  >,
): NewSubmission["report"] {
  try {
    const payload = buildReportPayload({
      ...ctx,
      language: s.preferredLanguage,
      visitor: { firstName: s.firstName, lastName: s.lastName, organization: s.organization },
      roleId: s.jobFunctionId,
      content: bundle,
    });
    const rendered = renderReport(payload);
    return {
      language: s.preferredLanguage,
      ...rendered,
      // The report data as JSON, for the Convention Export Package (ADR-062). Same visitor-safe payload the
      // HTML and text are rendered from: no score, internal notes or other visitors' data.
      payloadJson: JSON.stringify(payload),
      contentVersion: payload.contentVersion,
      copyVersion: payload.copyVersion,
    };
  } catch {
    return null;
  }
}

/** SHA-256 over the normalized submission (keys sorted), excluding the client clock. */
export function fingerprintOf(submission: LeadSubmission): string {
  const { submittedAt: _submittedAt, ...rest } = submission;
  return createHash("sha256").update(canonicalJson(rest)).digest("hex");
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
