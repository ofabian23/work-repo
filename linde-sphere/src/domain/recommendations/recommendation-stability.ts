import type { Scene } from "../content/scene";
import type { SessionSignals } from "../session/visitor-session";
import { meaningfulInteractions } from "./recommendation-readiness";
import type { RecommendationItem, RecommendationResult } from "./recommendation-result";

/**
 * Keeping recommendations meaningful and calm (ADR-051):
 * - they are recalculated only from **evidence**, i.e. what the visitor chose or looked at, not from
 *   walking through scenes;
 * - cards the visitor has already seen keep their order unless the set changes or a clear score gap
 *   justifies moving them.
 */

/**
 * The signals that count as evidence: role, challenges, organization type, explicit interests, opened
 * information/solution hotspots (and engagement with them), and the scenes where such content was opened.
 * Navigation clicks and scenes merely passed through are left out, so they never change recommendations.
 */
export function recommendationEvidence(
  signals: SessionSignals,
  scenes: Pick<Scene, "id" | "hotspots">[],
): SessionSignals {
  const { hotspotIds, sceneIds } = meaningfulInteractions(signals, scenes);
  const meaningful = new Set(hotspotIds);
  return {
    personaId: signals.personaId,
    challengeIds: [...new Set(signals.challengeIds)],
    facilityTypeId: signals.facilityTypeId,
    visitedSceneIds: signals.visitedSceneIds.filter((id) => sceneIds.includes(id)),
    openedHotspotIds: hotspotIds,
    engagedHotspotIds: [...new Set(signals.engagedHotspotIds)].filter((id) => meaningful.has(id)),
    explicitInterestIds: [...new Set(signals.explicitInterestIds)],
  };
}

/** Order-independent key of the evidence: recommendations are recalculated only when it changes. */
export function evidenceKey(evidence: SessionSignals): string {
  const sorted = (ids: string[]) => [...ids].sort();
  return JSON.stringify([
    evidence.personaId,
    sorted(evidence.challengeIds),
    evidence.facilityTypeId,
    sorted(evidence.visitedSceneIds),
    sorted(evidence.openedHotspotIds),
    sorted(evidence.engagedHotspotIds),
    sorted(evidence.explicitInterestIds),
  ]);
}

const renumber = (items: RecommendationItem[]) => items.map((item, i) => ({ ...item, rank: i + 1 }));

/**
 * Applies the previously shown order to a new result when nothing important changed: within each tier,
 * if the same recommendations are present and every pair the previous order would swap differs by less
 * than `margin` points, the previous order is kept. Otherwise the new ranking is used as is.
 * Deterministic and idempotent: stabilizing a result against itself returns it unchanged.
 */
export function stabilizeRecommendations(
  previous: RecommendationResult | null,
  next: RecommendationResult | null,
  margin: number,
): RecommendationResult | null {
  if (!previous || !next) return next;
  if (previous.items.some((i) => i.isFallback) || next.items.some((i) => i.isFallback)) return next;

  const stabilizeTier = (tier: RecommendationItem["tier"]) => {
    const prevIds = previous.items.filter((i) => i.tier === tier).map((i) => i.solutionId);
    const items = next.items.filter((i) => i.tier === tier);
    const sameSet = prevIds.length === items.length && items.every((i) => prevIds.includes(i.solutionId));
    if (!sameSet) return items;
    const inPreviousOrder = [...items].sort(
      (a, b) => prevIds.indexOf(a.solutionId) - prevIds.indexOf(b.solutionId),
    );
    for (let i = 0; i < inPreviousOrder.length; i++) {
      for (let j = i + 1; j < inPreviousOrder.length; j++) {
        const earlier = inPreviousOrder[i]!;
        const later = inPreviousOrder[j]!;
        // The previous order puts `earlier` first; only keep it if `later` is not clearly stronger now.
        if (later.score - earlier.score >= margin) return items;
      }
    }
    return inPreviousOrder;
  };

  const items = renumber([...stabilizeTier("primary"), ...stabilizeTier("secondary")]);
  // Nothing changed: keep the previous object so the session does not record the same result twice.
  if (
    previous.contentVersion === next.contentVersion &&
    previous.contentMode === next.contentMode &&
    JSON.stringify(previous.items) === JSON.stringify(items)
  ) {
    return previous;
  }
  return { ...next, items };
}

export type RecommendationChanges = {
  /** Solutions shown now that were not in the previously seen result. */
  newIds: string[];
  /** Membership, order, relevance or reasons differ from what the visitor last saw. */
  changed: boolean;
};

export function recommendationChanges(
  seen: RecommendationResult | null,
  current: RecommendationResult | null,
): RecommendationChanges {
  if (!seen || !current) return { newIds: [], changed: false };
  const seenIds = seen.items.map((i) => i.solutionId);
  const currentIds = current.items.map((i) => i.solutionId);
  const visible = (r: RecommendationResult) =>
    JSON.stringify(r.items.map((i) => [i.solutionId, i.relevanceLevel, i.whyThisAppeared]));
  return {
    newIds: currentIds.filter((id) => !seenIds.includes(id)),
    changed: visible(seen) !== visible(current),
  };
}
