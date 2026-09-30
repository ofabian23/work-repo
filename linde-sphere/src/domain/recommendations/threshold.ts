import type { SessionSignals } from "../session/visitor-session";
import { RECOMMENDATION_THRESHOLD, type RecommendationThreshold } from "./engine-config";

export type ThresholdProgress = {
  met: boolean;
  /** Hotspots opened so far and how many are needed when nothing else meets the threshold. */
  openedHotspots: number;
  requiredHotspots: number;
};

/** Pure: has the visitor shared enough for meaningful recommendations? */
export function recommendationThreshold(
  signals: SessionSignals,
  threshold: RecommendationThreshold = RECOMMENDATION_THRESHOLD,
): ThresholdProgress {
  const openedHotspots = signals.openedHotspotIds.length;
  const met =
    (threshold.personaSuffices && signals.personaId !== null) ||
    signals.challengeIds.length >= threshold.minChallenges ||
    openedHotspots >= threshold.minOpenedHotspots ||
    signals.explicitInterestIds.length >= threshold.minExplicitInterests;
  return { met, openedHotspots, requiredHotspots: threshold.minOpenedHotspots };
}

export const hasMinimumInfo = (signals: SessionSignals, threshold?: RecommendationThreshold) =>
  recommendationThreshold(signals, threshold).met;
