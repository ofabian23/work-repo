import type { ContentBundle } from "../content/bundle";
import type { DigitalAsset, Solution } from "../content/offering";
import { APPROVAL_STATUSES, type ApprovalStatus, type SalesReview } from "../content/sales-review";
import type { Challenge, Persona } from "../content/taxonomy";
import { solutionMissingAsset } from "./content-review";

/**
 * Sales-validation worksheet (ADR-060, SALES_VALIDATION_GUIDE.md): one row per persona, challenge,
 * solution and digital asset with the answers the Puerto Rico sales team must give. Pure: no I/O.
 * Intended personas, challenges and healthcare areas are derived from the content relations and the
 * recommendation rules, so reviewers see exactly what drives each recommendation today.
 */

export const SALES_RECORD_TYPES = ["persona", "challenge", "solution", "digital-asset"] as const;
export type SalesRecordType = (typeof SALES_RECORD_TYPES)[number];

export const SALES_VALIDATION_COLUMNS = [
  "record_type",
  "id",
  "current_name",
  "spanish_name",
  "english_name",
  "current_description",
  "market_status",
  "validation_status",
  "intended_personas",
  "intended_challenges",
  "intended_healthcare_areas",
  "recommendation_priority",
  "available_in_puerto_rico (yes/no/unknown)",
  "decision (keep/remove/rename)",
  "required_correction",
  "missing_digital_material",
  "sales_owner",
  "approval_status",
] as const;

export type SalesValidationColumn = (typeof SALES_VALIDATION_COLUMNS)[number];

export type SalesValidationRow = {
  recordType: SalesRecordType;
  id: string;
  currentName: { es: string; en: string };
  /** The name to use locally: the proposed rename if there is one, otherwise the current name. */
  spanishName: string;
  englishName: string;
  currentDescription: { es: string; en: string };
  marketStatus: string;
  validationStatus: string;
  intendedPersonas: string[];
  intendedChallenges: string[];
  intendedHealthcareAreas: string[];
  recommendationPriority: string;
  availableInPuertoRico: SalesReview["availableInPuertoRico"];
  decision: SalesReview["decision"];
  requiredCorrection: string;
  missingDigitalMaterial: string;
  salesOwner: string;
  approvalStatus: ApprovalStatus;
  /** True only when the item may appear in production mode (validated and approved). */
  productionReady: boolean;
};

const unique = (values: string[]) => [...new Set(values)];

export function buildSalesValidationRows(bundle: ContentBundle): SalesValidationRow[] {
  const personaLabel = new Map(bundle.personas.map((p) => [p.id, p.label.es]));
  const challengeLabel = new Map(bundle.challenges.map((c) => [c.id, c.label.es]));
  const sceneLabel = new Map(bundle.scenes.map((s) => [s.id, s.title.es]));
  const facilityLabel = new Map(bundle.facilityTypes.map((f) => [f.id, f.label.es]));
  const labels = (ids: string[], map: Map<string, string>) => unique(ids).map((id) => map.get(id) ?? id);

  const rulesFor = (solutionId: string) =>
    bundle.recommendationRules.filter((r) => r.solutionId === solutionId);
  const hotspots = bundle.scenes.flatMap((scene) => scene.hotspots.map((h) => ({ scene, h })));

  /** Personas, challenges and areas (scenes + facility types) behind one solution. */
  const solutionTargets = (s: Solution) => {
    const rules = rulesFor(s.id);
    const weighted = (key: "personas" | "challenges" | "scenes" | "facilityTypes") =>
      rules.flatMap((r) => Object.keys(r.weights[key]));
    const hotspotScenes = hotspots
      .filter(({ h }) => h.type === "solution" && h.targetSolutionIds.includes(s.id))
      .map(({ scene }) => scene.id);
    return {
      personas: unique(weighted("personas")),
      challenges: unique([...s.relatedChallengeIds, ...weighted("challenges")]),
      scenes: unique([...s.relatedSceneIds, ...weighted("scenes"), ...hotspotScenes]),
      facilities: unique(weighted("facilityTypes")),
    };
  };
  const targets = new Map(bundle.solutions.map((s) => [s.id, solutionTargets(s)]));
  const solutionsWhere = (test: (t: ReturnType<typeof solutionTargets>, s: Solution) => boolean) =>
    bundle.solutions.filter((s) => test(targets.get(s.id)!, s));
  const areasOf = (solutions: Solution[], extraScenes: string[] = []) => [
    ...labels([...extraScenes, ...solutions.flatMap((s) => targets.get(s.id)!.scenes)], sceneLabel),
    ...labels(
      solutions.flatMap((s) => targets.get(s.id)!.facilities),
      facilityLabel,
    ),
  ];

  const priority = (review: SalesReview, ruleNote = "") =>
    review.conventionPriority === "unset"
      ? `unset${ruleNote}`
      : `${review.conventionPriority} (${review.priorityConfirmedBySales ? "confirmed by sales" : "proposed"})${ruleNote}`;

  const base = (
    recordType: SalesRecordType,
    item: { id: string; validationStatus: string; salesReview: SalesReview },
    name: { es: string; en: string },
    description: { es: string; en: string },
  ) => {
    const r = item.salesReview;
    return {
      recordType,
      id: item.id,
      currentName: name,
      spanishName: r.proposedName?.es ?? name.es,
      englishName: r.proposedName?.en ?? name.en,
      currentDescription: description,
      validationStatus: item.validationStatus,
      availableInPuertoRico: r.availableInPuertoRico,
      decision: r.decision,
      requiredCorrection: r.requiredCorrection,
      salesOwner: r.salesOwner ?? "",
      approvalStatus: r.approvalStatus,
      productionReady:
        item.validationStatus === "validated" && r.approvalStatus === "approved" && r.decision !== "remove",
    };
  };
  const missing = (computed: string, review: SalesReview) =>
    [computed, review.missingDigitalMaterial].filter(Boolean).join(" | ");

  const persona = (p: Persona): SalesValidationRow => {
    const related = solutionsWhere((t) => t.personas.includes(p.id));
    return {
      ...base("persona", p, p.label, p.description),
      marketStatus: "n/a (customer role)",
      intendedPersonas: [],
      intendedChallenges: labels(p.suggestedChallengeIds, challengeLabel),
      intendedHealthcareAreas: areasOf(related),
      recommendationPriority: priority(p.salesReview),
      missingDigitalMaterial: missing("", p.salesReview),
    };
  };

  const challenge = (c: Challenge): SalesValidationRow => {
    const related = solutionsWhere((t) => t.challenges.includes(c.id));
    const signalScenes = hotspots
      .filter(({ h }) => h.recommendationSignals.challengeIds.includes(c.id))
      .map(({ scene }) => scene.id);
    return {
      ...base("challenge", c, c.label, c.description),
      marketStatus: "n/a (customer problem)",
      intendedPersonas: labels(
        bundle.personas.filter((p) => p.suggestedChallengeIds.includes(c.id)).map((p) => p.id),
        personaLabel,
      ),
      intendedChallenges: [],
      intendedHealthcareAreas: areasOf(related, signalScenes),
      recommendationPriority: priority(c.salesReview),
      missingDigitalMaterial: missing("", c.salesReview),
    };
  };

  const solution = (s: Solution): SalesValidationRow => {
    const t = targets.get(s.id)!;
    const rulePriorities = rulesFor(s.id).map((r) => r.priority);
    return {
      // The next step is what the visitor is told to expect after the convention (guide question 8).
      ...base("solution", s, s.title, {
        es: `${s.summary.es} Próximo paso: ${s.nextStep.es}`,
        en: `${s.summary.en} Next step: ${s.nextStep.en}`,
      }),
      marketStatus: s.market,
      intendedPersonas: labels(t.personas, personaLabel),
      intendedChallenges: labels(t.challenges, challengeLabel),
      intendedHealthcareAreas: areasOf([s]),
      recommendationPriority: priority(
        s.salesReview,
        rulePriorities.length > 0 ? `; rule tie-break ${rulePriorities.join("/")}` : "",
      ),
      missingDigitalMaterial: missing(
        solutionMissingAsset(s, bundle) ? "No approved brochure, video or sheet linked" : "",
        s.salesReview,
      ),
    };
  };

  const asset = (a: DigitalAsset): SalesValidationRow => {
    const users = bundle.solutions.filter((s) => s.digitalAssetIds.includes(a.id));
    return {
      ...base("digital-asset", a, a.title, a.description),
      marketStatus: a.market,
      intendedPersonas: labels(
        users.flatMap((s) => targets.get(s.id)!.personas),
        personaLabel,
      ),
      intendedChallenges: labels(
        users.flatMap((s) => targets.get(s.id)!.challenges),
        challengeLabel,
      ),
      intendedHealthcareAreas: areasOf(users),
      recommendationPriority: priority(a.salesReview),
      missingDigitalMaterial: missing(
        a.validationStatus === "validated" ? "" : `This ${a.type} is not approved yet`,
        a.salesReview,
      ),
    };
  };

  const bySort = <T extends { sortOrder: number }>(items: T[]) =>
    [...items].sort((x, y) => x.sortOrder - y.sortOrder);
  return [
    ...bySort(bundle.personas).map(persona),
    ...bySort(bundle.challenges).map(challenge),
    ...bundle.solutions.map(solution),
    ...bundle.digitalAssets.map(asset),
  ];
}

const list = (values: string[]) => (values.length > 0 ? values.join("; ") : "—");

export function salesValidationTable(rows: SalesValidationRow[]): string[][] {
  return [
    [...SALES_VALIDATION_COLUMNS],
    ...rows.map((r) => [
      r.recordType,
      r.id,
      r.currentName.es === r.currentName.en ? r.currentName.es : `${r.currentName.es} / ${r.currentName.en}`,
      r.spanishName,
      r.englishName,
      `ES: ${r.currentDescription.es} | EN: ${r.currentDescription.en}`,
      r.marketStatus,
      r.validationStatus,
      list(r.intendedPersonas),
      list(r.intendedChallenges),
      list(r.intendedHealthcareAreas),
      r.recommendationPriority,
      r.availableInPuertoRico,
      r.decision,
      r.requiredCorrection,
      r.missingDigitalMaterial,
      r.salesOwner,
      r.approvalStatus,
    ]),
  ];
}

export type SalesValidationSummary = {
  total: number;
  productionReady: number;
  byApproval: Record<ApprovalStatus, number>;
  byType: Record<SalesRecordType, { total: number; approved: number }>;
};

export function summarizeSalesValidation(rows: SalesValidationRow[]): SalesValidationSummary {
  const byApproval = Object.fromEntries(APPROVAL_STATUSES.map((s) => [s, 0])) as Record<
    ApprovalStatus,
    number
  >;
  const byType = Object.fromEntries(
    SALES_RECORD_TYPES.map((t) => [t, { total: 0, approved: 0 }]),
  ) as SalesValidationSummary["byType"];
  for (const r of rows) {
    byApproval[r.approvalStatus] += 1;
    byType[r.recordType].total += 1;
    if (r.approvalStatus === "approved") byType[r.recordType].approved += 1;
  }
  return {
    total: rows.length,
    productionReady: rows.filter((r) => r.productionReady).length,
    byApproval,
    byType,
  };
}
