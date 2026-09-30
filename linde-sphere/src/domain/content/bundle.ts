import { z } from "zod";
import { DigitalAssetSchema, SolutionSchema } from "./offering";
import {
  SIGNAL_TYPES,
  RecommendationRuleSchema,
  maxAchievableScore,
  type SignalType,
} from "./recommendation-rule";
import { SceneSchema } from "./scene";
import { ConsentTextSetSchema, ContentManifestSchema } from "./settings";
import { ChallengeSchema, FacilityTypeSchema, PersonaSchema } from "./taxonomy";
import type { LocalizedText } from "./primitives";

/** The complete, individually validated content set. */
export const ContentBundleSchema = z.strictObject({
  manifest: ContentManifestSchema,
  personas: z.array(PersonaSchema).min(1),
  challenges: z.array(ChallengeSchema).min(1),
  facilityTypes: z.array(FacilityTypeSchema).min(1),
  scenes: z.array(SceneSchema).min(1),
  solutions: z.array(SolutionSchema).min(1),
  digitalAssets: z.array(DigitalAssetSchema),
  recommendationRules: z.array(RecommendationRuleSchema),
  consent: ConsentTextSetSchema,
});
export type ContentBundle = z.infer<typeof ContentBundleSchema>;
export type ContentCollection = Exclude<keyof ContentBundle, "manifest" | "consent">;

export type IssueSeverity = "error" | "warning";
export type ContentIssue = {
  severity: IssueSeverity;
  /** Collection the issue belongs to, used by the loader to point at the right file. */
  collection: keyof ContentBundle;
  /** Id of the offending record, when applicable. */
  recordId?: string;
  path: string;
  message: string;
};

/**
 * Markers of claims that content must never make without explicit review (CONTENT_VALIDATION.md §7):
 * metrics, prices, savings, guarantees, certification/compliance claims, testimonials.
 */
export const PROHIBITED_CLAIM_PATTERNS: readonly { pattern: RegExp; label: string }[] = [
  { pattern: /\d\s*%|%\s*\d/, label: "percentage figure" },
  { pattern: /[$€£]\s*\d/, label: "price or monetary figure" },
  { pattern: /\bgarantiz\w*|\bguarant\w*/i, label: "guarantee" },
  { pattern: /\bcertificad[oa]s?\b|\bcertified\b/i, label: "certification claim" },
  { pattern: /\bcumple con\b|\bcompliant\b/i, label: "compliance claim" },
  { pattern: /\bahorr\w*|\bsavings?\b|\bsave[sd]?\b/i, label: "savings claim" },
  { pattern: /\bROI\b/, label: "ROI claim" },
  { pattern: /\btestimoni\w*/i, label: "testimonial" },
  // Local availability is decided by the Puerto Rico sales team, never asserted in content.
  {
    pattern: /\b(disponibles?|available|ofrecid[oa]s?|offered)\s+(en|in)\s+puerto\s+rico\b/i,
    label: "local availability claim",
  },
  {
    pattern: /\b(NFPA|FDA|OSHA|CMS|USP|Joint Commission|ISO\s?\d{3,5})\b/,
    label: "regulatory or standards reference",
  },
  {
    pattern:
      /\breduc\w*\s+(los\s+|el\s+|sus\s+)?(costos?|gastos?)\b|\b(reduces?|reduced|reducing|lowers?)\s+(your\s+)?costs?\b|\bcost\s+reduction\b/i,
    label: "cost-reduction claim",
  },
  {
    pattern: /\b24\/7\b|\buptime\b|\btiempo de actividad\b|\bsin interrupciones\b/i,
    label: "performance claim",
  },
  { pattern: /[™®©]/, label: "product or trademark marking" },
  {
    pattern: /\b(l[ií]der(es)?|leading|best-in-class|world-class|de clase mundial|n[uú]mero uno)\b|#1\b/i,
    label: "superlative claim",
  },
];

/** Cross-record checks that single-record schemas cannot express. Pure: no I/O. */
export function checkContentBundle(bundle: ContentBundle): ContentIssue[] {
  const issues: ContentIssue[] = [];
  const add = (issue: ContentIssue) => issues.push(issue);

  // ---- Unique ids per collection -----------------------------------------------------------
  const idSets = {} as Record<ContentCollection, Set<string>>;
  const collections: ContentCollection[] = [
    "personas",
    "challenges",
    "facilityTypes",
    "scenes",
    "solutions",
    "digitalAssets",
    "recommendationRules",
  ];
  for (const collection of collections) {
    const ids = new Set<string>();
    bundle[collection].forEach((record, i) => {
      if (ids.has(record.id)) {
        add({
          severity: "error",
          collection,
          recordId: record.id,
          path: `[${i}].id`,
          message: `Duplicate id '${record.id}'`,
        });
      }
      ids.add(record.id);
    });
    idSets[collection] = ids;
  }
  for (const [kind, records] of [
    ["scenes", bundle.scenes],
    ["solutions", bundle.solutions],
  ] as const) {
    const slugs = new Set<string>();
    for (const r of records) {
      if (slugs.has(r.slug)) {
        add({
          severity: "error",
          collection: kind,
          recordId: r.id,
          path: "slug",
          message: `Duplicate slug '${r.slug}'`,
        });
      }
      slugs.add(r.slug);
    }
  }

  const hotspotIds = new Map<string, string>(); // hotspot id → scene id
  for (const scene of bundle.scenes) {
    for (const h of scene.hotspots) {
      const owner = hotspotIds.get(h.id);
      if (owner !== undefined) {
        add({
          severity: "error",
          collection: "scenes",
          recordId: scene.id,
          path: `hotspots.${h.id}`,
          message: `Hotspot id '${h.id}' is already used in scene '${owner}' (hotspot ids must be globally unique)`,
        });
      } else {
        hotspotIds.set(h.id, scene.id);
      }
    }
  }

  const known: Record<SignalType, Set<string>> = {
    personas: idSets.personas,
    challenges: idSets.challenges,
    facilityTypes: idSets.facilityTypes,
    scenes: idSets.scenes,
    hotspots: new Set(hotspotIds.keys()),
    explicitInterests: idSets.solutions,
  };
  const ref = (
    collection: keyof ContentBundle,
    recordId: string,
    path: string,
    target: SignalType | "digitalAssets",
    id: string,
  ) => {
    const set = target === "digitalAssets" ? idSets.digitalAssets : known[target];
    if (!set.has(id)) {
      const label = target === "explicitInterests" ? "solution" : target;
      add({ severity: "error", collection, recordId, path, message: `Unknown ${label} id '${id}'` });
    }
  };

  // ---- Personas --------------------------------------------------------------------------
  for (const p of bundle.personas) {
    p.suggestedChallengeIds.forEach((id, i) =>
      ref("personas", p.id, `suggestedChallengeIds[${i}]`, "challenges", id),
    );
  }
  const multiple = bundle.personas.filter((p) => p.scope === "multiple");
  multiple.slice(1).forEach((p) =>
    add({
      severity: "error",
      collection: "personas",
      recordId: p.id,
      path: "scope",
      message: "Only one persona may use scope 'multiple' (the \"several areas\" option)",
    }),
  );
  const multipleIds = new Set(multiple.map((p) => p.id));
  for (const rule of bundle.recommendationRules) {
    for (const id of Object.keys(rule.weights.personas)) {
      if (multipleIds.has(id)) {
        add({
          severity: "error",
          collection: "recommendationRules",
          recordId: rule.id,
          path: `weights.personas.${id}`,
          message: `Persona '${id}' spans several areas and must not be weighted; use challenges instead`,
        });
      }
    }
  }

  // ---- Scene tree ------------------------------------------------------------------------
  const sceneById = new Map(bundle.scenes.map((s) => [s.id, s]));
  const roots = bundle.scenes.filter((s) => s.parentSceneId === null);
  if (roots.length !== 1) {
    add({
      severity: "error",
      collection: "scenes",
      path: "parentSceneId",
      message: `Exactly one root scene (parentSceneId: null) is required; found ${roots.length}`,
    });
  }
  for (const scene of bundle.scenes) {
    if (scene.parentSceneId !== null && !sceneById.has(scene.parentSceneId)) {
      add({
        severity: "error",
        collection: "scenes",
        recordId: scene.id,
        path: "parentSceneId",
        message: `Unknown parent scene '${scene.parentSceneId}'`,
      });
      continue;
    }
    // Walk to the root to compute the expected breadcrumb and detect cycles.
    const chain: string[] = [];
    let cursor: string | null = scene.id;
    let cyclic = false;
    while (cursor !== null) {
      if (chain.includes(cursor)) {
        cyclic = true;
        break;
      }
      chain.unshift(cursor);
      cursor = sceneById.get(cursor)?.parentSceneId ?? null;
    }
    if (cyclic) {
      add({
        severity: "error",
        collection: "scenes",
        recordId: scene.id,
        path: "parentSceneId",
        message: "Scene hierarchy contains a cycle",
      });
    } else if (chain.join(">") !== scene.breadcrumb.join(">")) {
      add({
        severity: "error",
        collection: "scenes",
        recordId: scene.id,
        path: "breadcrumb",
        message: `Breadcrumb [${scene.breadcrumb.join(", ")}] does not match the parent chain [${chain.join(", ")}]`,
      });
    }

    for (const h of scene.hotspots) {
      const base = `hotspots.${h.id}`;
      if (h.type === "navigation")
        ref("scenes", scene.id, `${base}.targetSceneId`, "scenes", h.targetSceneId);
      if (h.type === "solution") {
        h.targetSolutionIds.forEach((id, i) =>
          ref("scenes", scene.id, `${base}.targetSolutionIds[${i}]`, "explicitInterests", id),
        );
      }
      h.recommendationSignals.challengeIds.forEach((id, i) =>
        ref("scenes", scene.id, `${base}.recommendationSignals.challengeIds[${i}]`, "challenges", id),
      );
      h.recommendationSignals.solutionIds.forEach((id, i) =>
        ref("scenes", scene.id, `${base}.recommendationSignals.solutionIds[${i}]`, "explicitInterests", id),
      );
    }
  }
  const reachable = new Set<string>(roots.map((r) => r.id));
  for (const s of bundle.scenes) {
    for (const h of s.hotspots) if (h.type === "navigation") reachable.add(h.targetSceneId);
  }
  for (const s of bundle.scenes) {
    if (!reachable.has(s.id)) {
      add({
        severity: "warning",
        collection: "scenes",
        recordId: s.id,
        path: "id",
        message: "No navigation hotspot leads to this scene",
      });
    }
  }

  // ---- Solutions and assets --------------------------------------------------------------
  const fallbacks = bundle.solutions.filter((s) => s.isFallback);
  if (fallbacks.length !== 1) {
    add({
      severity: "error",
      collection: "solutions",
      path: "isFallback",
      message: `Exactly one fallback solution (isFallback: true) is required; found ${fallbacks.length}`,
    });
  }
  const assetById = new Map(bundle.digitalAssets.map((a) => [a.id, a]));
  for (const s of bundle.solutions) {
    s.relatedChallengeIds.forEach((id, i) =>
      ref("solutions", s.id, `relatedChallengeIds[${i}]`, "challenges", id),
    );
    s.relatedSceneIds.forEach((id, i) => ref("solutions", s.id, `relatedSceneIds[${i}]`, "scenes", id));
    s.digitalAssetIds.forEach((id, i) => {
      ref("solutions", s.id, `digitalAssetIds[${i}]`, "digitalAssets", id);
      const asset = assetById.get(id);
      if (s.validationStatus === "validated" && asset && asset.validationStatus !== "validated") {
        add({
          severity: "warning",
          collection: "solutions",
          recordId: s.id,
          path: `digitalAssetIds[${i}]`,
          message: `Validated solution links '${id}' (${asset.validationStatus}); it will be hidden in production`,
        });
      }
    });
  }
  const linkedAssets = new Set(bundle.solutions.flatMap((s) => s.digitalAssetIds));
  for (const a of bundle.digitalAssets) {
    if (!linkedAssets.has(a.id)) {
      add({
        severity: "warning",
        collection: "digitalAssets",
        recordId: a.id,
        path: "id",
        message: "Asset is not linked from any solution",
      });
    }
  }

  // ---- Recommendation rules --------------------------------------------------------------
  const solutionById = new Map(bundle.solutions.map((s) => [s.id, s]));
  const rulesPerSolution = new Map<string, string[]>();
  for (const rule of bundle.recommendationRules) {
    const solution = solutionById.get(rule.solutionId);
    if (!solution) {
      add({
        severity: "error",
        collection: "recommendationRules",
        recordId: rule.id,
        path: "solutionId",
        message: `Unknown solution id '${rule.solutionId}'`,
      });
    } else if (solution.isFallback) {
      add({
        severity: "error",
        collection: "recommendationRules",
        recordId: rule.id,
        path: "solutionId",
        message: "The fallback solution is used when no rule qualifies and must not have a rule",
      });
    }
    rulesPerSolution.set(rule.solutionId, [...(rulesPerSolution.get(rule.solutionId) ?? []), rule.id]);

    for (const type of SIGNAL_TYPES) {
      for (const id of Object.keys(rule.weights[type]))
        ref("recommendationRules", rule.id, `weights.${type}.${id}`, type, id);
    }
    rule.exclusions.forEach((ex, i) =>
      ex.ids.forEach((id, j) =>
        ref("recommendationRules", rule.id, `exclusions[${i}].ids[${j}]`, ex.signalType, id),
      ),
    );

    const max = maxAchievableScore(rule);
    if (max < rule.minimumScore) {
      add({
        severity: "error",
        collection: "recommendationRules",
        recordId: rule.id,
        path: "minimumScore",
        message: `minimumScore ${rule.minimumScore} is unreachable (maximum achievable score is ${max})`,
      });
    }
  }
  for (const [solutionId, ruleIds] of rulesPerSolution) {
    if (ruleIds.length > 1) {
      add({
        severity: "error",
        collection: "recommendationRules",
        path: "solutionId",
        message: `Solution '${solutionId}' has ${ruleIds.length} rules (${ruleIds.join(", ")}); exactly one is allowed`,
      });
    }
  }
  for (const s of bundle.solutions) {
    if (!s.isFallback && !rulesPerSolution.has(s.id)) {
      add({
        severity: "warning",
        collection: "solutions",
        recordId: s.id,
        path: "id",
        message: "No recommendation rule; this solution can never be recommended",
      });
    }
  }

  // ---- Prohibited claims and translation sanity ------------------------------------------
  const scanned: { collection: keyof ContentBundle; records: { id: string }[] }[] = [
    { collection: "solutions", records: bundle.solutions },
    { collection: "digitalAssets", records: bundle.digitalAssets },
    { collection: "recommendationRules", records: bundle.recommendationRules },
    { collection: "scenes", records: bundle.scenes },
    { collection: "personas", records: bundle.personas },
    { collection: "challenges", records: bundle.challenges },
  ];
  for (const { collection, records } of scanned) {
    for (const record of records) {
      for (const pair of localizedPairs(record)) {
        for (const lang of ["es", "en"] as const) {
          const text = pair.value[lang];
          for (const { pattern, label } of PROHIBITED_CLAIM_PATTERNS) {
            if (pattern.test(text)) {
              add({
                severity: "error",
                collection,
                recordId: record.id,
                path: `${pair.path}.${lang}`,
                message: `Possible prohibited claim (${label}): "${text.slice(0, 80)}"`,
              });
            }
          }
        }
      }
      for (const pair of localizedPairs(record)) {
        if (pair.value.es === pair.value.en && /[a-z]{4,}/i.test(pair.value.es)) {
          add({
            severity: "warning",
            collection,
            recordId: record.id,
            path: pair.path,
            message: "Spanish and English text are identical; translation may be missing",
          });
        }
      }
    }
  }

  return issues;
}

function localizedPairs(value: unknown, path = ""): { path: string; value: LocalizedText }[] {
  if (value === null || typeof value !== "object") return [];
  const obj = value as Record<string, unknown>;
  if (Object.keys(obj).length === 2 && typeof obj.es === "string" && typeof obj.en === "string") {
    return [{ path, value: obj as LocalizedText }];
  }
  return Object.keys(obj).flatMap((k) => localizedPairs(obj[k], path ? `${path}.${k}` : k));
}
