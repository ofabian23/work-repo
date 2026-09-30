import type { ContentBundle } from "./bundle";
import type { EngineSettings } from "./engine-settings";
import type { DigitalAsset, Solution } from "./offering";
import type { ContentMode, ValidationStatus } from "./primitives";
import { SIGNAL_TYPES, type RecommendationRule, type SignalWeights } from "./recommendation-rule";
import type { Hotspot, Scene } from "./scene";
import type { ConsentTextSet } from "./settings";

/**
 * Single source of truth for what a visitor may see (CONTENT_VALIDATION.md §3).
 * The same filter feeds the kiosk UI, server-side recomputation and the emailed report.
 */

export type VisibilityOptions = {
  /** Development-only: also show `placeholder` items. Callers must force false in production builds. */
  previewPlaceholders?: boolean;
};

export function isVisibleStatus(
  status: ValidationStatus,
  mode: ContentMode,
  { previewPlaceholders = false }: VisibilityOptions = {},
): boolean {
  switch (status) {
    case "validated":
      return true;
    case "assumed":
      return mode === "demo";
    case "placeholder":
      return mode === "demo" && previewPlaceholders;
    case "unavailable":
      return false;
  }
}

/** Offering content shown in demo mode that still needs the "pending local validation" indicator. */
export function needsPendingIndicator(status: ValidationStatus): boolean {
  return status !== "validated";
}

type StripGovernance<T> = Omit<
  T,
  "internalNotes" | "reviewedBy" | "sourceLabel" | "lastReviewedAt" | "requiresSalesValidation" | "market"
>;
export type PublicSolution = Omit<StripGovernance<Solution>, "salesReview">;
export type PublicDigitalAsset = StripGovernance<DigitalAsset>;
export type PublicRecommendationRule = Omit<RecommendationRule, "internalNotes" | "exclusions"> & {
  exclusions: Omit<RecommendationRule["exclusions"][number], "reason">[];
};
export type PublicConsentTextSet = Omit<ConsentTextSet, "internalNotes">;

/** Content safe to send to the kiosk client: filtered by mode, internal fields removed. */
export type PublicContentBundle = {
  mode: ContentMode;
  manifest: ContentBundle["manifest"];
  personas: ContentBundle["personas"];
  challenges: ContentBundle["challenges"];
  facilityTypes: ContentBundle["facilityTypes"];
  scenes: Scene[];
  solutions: PublicSolution[];
  digitalAssets: PublicDigitalAsset[];
  recommendationRules: PublicRecommendationRule[];
  consent: PublicConsentTextSet;
  /** Engine and readiness settings (configuration, passed through unchanged). */
  settings: EngineSettings;
};

function stripSolution(solution: Solution): PublicSolution {
  const { salesReview: _salesReview, ...rest } = solution;
  return stripGovernance(rest);
}

function stripGovernance<T extends Omit<Solution, "salesReview"> | DigitalAsset>(
  record: T,
): StripGovernance<T> {
  const {
    internalNotes: _internalNotes,
    reviewedBy: _reviewedBy,
    sourceLabel: _sourceLabel,
    lastReviewedAt: _lastReviewedAt,
    requiresSalesValidation: _requiresSalesValidation,
    market: _market,
    ...rest
  } = record;
  return rest;
}

export function visibleContent(
  bundle: ContentBundle,
  mode: ContentMode,
  options: VisibilityOptions = {},
): PublicContentBundle {
  const visible = <T extends { validationStatus: ValidationStatus }>(items: T[]) =>
    items.filter((i) => isVisibleStatus(i.validationStatus, mode, options));

  const personasRaw = visible(bundle.personas);
  const challenges = visible(bundle.challenges);
  const facilityTypes = visible(bundle.facilityTypes);
  const challengeIds = new Set(challenges.map((c) => c.id));

  // A scene is visible only if it and every ancestor are visible.
  const sceneById = new Map(bundle.scenes.map((s) => [s.id, s]));
  const sceneVisible = (scene: Scene): boolean => {
    const seen = new Set<string>();
    let cursor: Scene | undefined = scene;
    while (cursor) {
      if (seen.has(cursor.id) || !isVisibleStatus(cursor.validationStatus, mode, options)) return false;
      seen.add(cursor.id);
      if (cursor.parentSceneId === null) return true;
      cursor = sceneById.get(cursor.parentSceneId);
    }
    return false; // dangling parent reference
  };
  const sceneIds = new Set(bundle.scenes.filter(sceneVisible).map((s) => s.id));

  const assets = visible(bundle.digitalAssets);
  const assetIds = new Set(assets.map((a) => a.id));
  const solutionsRaw = visible(bundle.solutions);
  const solutionIds = new Set(solutionsRaw.map((s) => s.id));

  const pruneHotspot = (h: Hotspot): Hotspot | null => {
    if (!isVisibleStatus(h.validationStatus, mode, options)) return null;
    const recommendationSignals = {
      challengeIds: h.recommendationSignals.challengeIds.filter((id) => challengeIds.has(id)),
      solutionIds: h.recommendationSignals.solutionIds.filter((id) => solutionIds.has(id)),
    };
    if (h.type === "navigation") {
      return sceneIds.has(h.targetSceneId) ? { ...h, recommendationSignals } : null;
    }
    if (h.type === "solution") {
      const targetSolutionIds = h.targetSolutionIds.filter((id) => solutionIds.has(id));
      return targetSolutionIds.length > 0 ? { ...h, targetSolutionIds, recommendationSignals } : null;
    }
    return { ...h, recommendationSignals };
  };

  const scenes = bundle.scenes
    .filter((s) => sceneIds.has(s.id))
    .map((s) => ({
      ...s,
      hotspots: s.hotspots.map(pruneHotspot).filter((h): h is Hotspot => h !== null),
    }));
  const hotspotIds = new Set(scenes.flatMap((s) => s.hotspots.map((h) => h.id)));

  const personas = personasRaw.map((p) => ({
    ...p,
    suggestedChallengeIds: p.suggestedChallengeIds.filter((id) => challengeIds.has(id)),
  }));

  const solutions = solutionsRaw.map((s) =>
    stripSolution({
      ...s,
      relatedChallengeIds: s.relatedChallengeIds.filter((id) => challengeIds.has(id)),
      relatedSceneIds: s.relatedSceneIds.filter((id) => sceneIds.has(id)),
      digitalAssetIds: s.digitalAssetIds.filter((id) => assetIds.has(id)),
    }),
  );

  const known: Record<(typeof SIGNAL_TYPES)[number], Set<string>> = {
    personas: new Set(personas.map((p) => p.id)),
    challenges: challengeIds,
    facilityTypes: new Set(facilityTypes.map((f) => f.id)),
    scenes: sceneIds,
    hotspots: hotspotIds,
    explicitInterests: solutionIds,
  };
  const recommendationRules: PublicRecommendationRule[] = visible(bundle.recommendationRules)
    .filter((r) => solutionIds.has(r.solutionId))
    .map(({ internalNotes: _internalNotes, exclusions, weights, ...rest }) => ({
      ...rest,
      weights: Object.fromEntries(
        SIGNAL_TYPES.map((t) => [
          t,
          Object.fromEntries(Object.entries(weights[t]).filter(([id]) => known[t].has(id))),
        ]),
      ) as SignalWeights,
      exclusions: exclusions.map(({ signalType, ids }) => ({ signalType, ids })),
    }));

  const { internalNotes: _consentNotes, ...consent } = bundle.consent;

  return {
    mode,
    manifest: bundle.manifest,
    personas,
    challenges,
    facilityTypes,
    scenes,
    solutions,
    digitalAssets: assets.map(stripGovernance),
    recommendationRules,
    consent,
    settings: bundle.settings,
  };
}
