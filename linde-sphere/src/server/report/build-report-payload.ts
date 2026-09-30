import "server-only";
import type { Language, LocalizedText } from "@/domain/content/primitives";
import type { PublicContentBundle } from "@/domain/content/visibility";
import { ENGINE_VERSION } from "@/domain/recommendations/engine-config";
import { primaryItems, type RecommendationResult } from "@/domain/recommendations/recommendation-result";
import { ReportPayloadSchema, type ReportPayload } from "@/domain/report/report-payload";

/**
 * Builds the personalized report from the lead, the server-recomputed recommendations and the content
 * visible in the active mode (ADR-054). Only public, visible content goes in: no scores, no internal notes
 * or sales-review data (already stripped by visibleContent), no session events or hotspot ids, and only
 * validated resources with public https links. The strict schema rejects anything else.
 */
export class ReportUnavailableError extends Error {
  constructor() {
    super("No recommendation is available to build a report");
    this.name = "ReportUnavailableError";
  }
}

export type ReportInput = {
  leadId: string;
  generatedAt: Date;
  language: Language;
  visitor: { firstName: string; lastName: string; organization: string };
  roleId: string;
  /** Challenges chosen during the visit or confirmed on the form. */
  priorityIds: string[];
  /** Scenes where the visitor looked at content (same evidence rule as the kiosk, ADR-051). */
  exploredSceneIds: string[];
  result: RecommendationResult | null;
  content: PublicContentBundle;
};

const MAX_PRIMARY = 3;

export function buildReportPayload(input: ReportInput): ReportPayload {
  const { content, language } = input;
  const l = (text: LocalizedText) => text[language];
  const personas = new Map(content.personas.map((p) => [p.id, p]));
  const challenges = new Map(content.challenges.map((c) => [c.id, c]));
  const scenes = new Map(content.scenes.map((s) => [s.id, s]));
  const solutions = new Map(content.solutions.map((s) => [s.id, s]));
  const assets = new Map(content.digitalAssets.map((a) => [a.id, a]));
  const copy = content.report;

  const items = primaryItems(input.result)
    .filter((item) => solutions.has(item.solutionId))
    .slice(0, MAX_PRIMARY);
  if (items.length === 0) throw new ReportUnavailableError();

  const recommendations = items.map((item) => {
    const solution = solutions.get(item.solutionId)!;
    return {
      solutionId: solution.id,
      title: l(solution.title),
      summary: l(solution.summary),
      reasons: [l(item.whyThisAppeared)],
      relatedAreas: item.relatedSceneIds.flatMap((id) => {
        const scene = scenes.get(id);
        return scene ? [l(scene.title)] : [];
      }),
      nextStep: l(item.nextStep),
      // "Approved links only": validated assets with a public https URL, whatever the content mode.
      resources: item.digitalAssetIds.flatMap((id) => {
        const asset = assets.get(id);
        return asset && asset.validationStatus === "validated" && asset.access.kind === "url"
          ? [{ title: l(asset.title), url: asset.access.url }]
          : [];
      }),
      pendingValidation: item.pendingValidation,
    };
  });

  const unique = (ids: string[]) => [...new Set(ids)];
  const role = personas.get(input.roleId);
  const contact = copy.salesContact;
  const subject = l(copy.subject);

  return ReportPayloadSchema.parse({
    leadId: input.leadId,
    language,
    contentMode: content.mode,
    contentVersion: content.manifest.contentVersion,
    copyVersion: copy.version,
    engineVersion: ENGINE_VERSION,
    generatedAt: input.generatedAt.toISOString(),
    subject,
    title: l(copy.title),
    intro: l(copy.intro),
    visitor: input.visitor,
    role: { id: input.roleId, label: role ? l(role.label) : input.roleId },
    priorities: unique(input.priorityIds).flatMap((id) => {
      const challenge = challenges.get(id);
      return challenge ? [{ id, label: l(challenge.label) }] : [];
    }),
    areasExplored: unique(input.exploredSceneIds).flatMap((id) => {
      const scene = scenes.get(id);
      return scene ? [{ id, title: l(scene.title) }] : [];
    }),
    recommendations,
    callToAction: {
      heading: l(copy.callToAction.heading),
      body: l(copy.callToAction.body),
      buttonLabel: l(copy.callToAction.buttonLabel),
      // The link carries no visitor data: only the report subject.
      href: contact ? `mailto:${contact.email}?subject=${encodeURIComponent(subject)}` : null,
    },
    salesContact: contact ? { name: l(contact.name), email: contact.email, phone: contact.phone } : null,
    disclaimer: l(copy.disclaimer),
    privacyFooter: l(copy.privacyFooter),
    pendingValidationNotice: recommendations.some((r) => r.pendingValidation)
      ? l(copy.pendingValidationNotice)
      : null,
  });
}
