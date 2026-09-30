/**
 * Recommendation engine tuning constants (ADR-041). Rule weights live in content; these constants
 * define how exploration signals are combined so that exploring can refine but never dominate the
 * visitor's explicit choices. Changing them requires re-running `npm run content:export` (coverage).
 */
export const ENGINE_VERSION = "1.0.0";

/** Results shown by default (the schema allows up to 5). */
export const DEFAULT_MAX_RESULTS = 3;

/** Maximum total contribution of visited scenes to one solution. */
export const SCENE_CAP = 3;

/** Maximum total contribution of opened/engaged hotspots (direct + affinity) to one solution. */
export const HOTSPOT_CAP = 8;

/** Bonus per engaged hotspot (panel kept open past the engagement threshold) that already contributes. */
export const ENGAGED_HOTSPOT_BONUS = 1;

/**
 * Weight added when an opened hotspot lists the solution in `recommendationSignals.solutionIds`
 * but the rule does not weight that hotspot directly.
 */
export const HOTSPOT_SOLUTION_AFFINITY = 2;

/**
 * Challenges implied by opened hotspots (`recommendationSignals.challengeIds`) count at this fraction
 * of the rule's challenge weight, only when the visitor did not select that challenge explicitly.
 */
export const IMPLIED_CHALLENGE_FACTOR = 0.5;
export const IMPLIED_CHALLENGE_CAP = 3;

/** Reason groups rendered in the "Why this appeared" sentence, and labels per group. */
export const MAX_REASON_GROUPS = 3;
export const MAX_LABELS_PER_REASON = 2;

/**
 * When "View my recommendations" becomes available (PROJECT_BRIEF §7 rule 3, ADR-049). Any one condition is
 * enough. A role alone counts because the role journey already shows preliminary recommendations (ADR-048).
 */
export type RecommendationThreshold = {
  personaSuffices: boolean;
  minChallenges: number;
  minOpenedHotspots: number;
  minExplicitInterests: number;
};
export const RECOMMENDATION_THRESHOLD: RecommendationThreshold = {
  personaSuffices: true,
  minChallenges: 1,
  minOpenedHotspots: 3,
  minExplicitInterests: 1,
};
