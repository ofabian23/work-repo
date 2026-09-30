import { z } from "zod";

const whole = (min: number, max: number) => z.number().int().min(min).max(max);

/**
 * Recommendation engine and readiness settings (`content/engine-settings.json`, ADR-050). Whole numbers
 * only, like the rule weights, so every score is an exact integer and results never depend on rounding.
 * The file is configuration approved by the project owner; it makes no claim, so it has no validation status.
 */
export const EngineSettingsSchema = z.strictObject({
  scoring: z.strictObject({
    /** Most points that visited scenes can add to one recommendation. */
    sceneCap: whole(0, 20),
    /** Most points that opened hotspots (and their engagement bonus) can add to one recommendation. */
    hotspotCap: whole(0, 30),
    /** Extra point(s) for a contributing hotspot whose panel stayed open (engaged). */
    engagedHotspotBonus: whole(0, 5),
    /** Points when an opened hotspot lists the solution but the rule does not weight that hotspot. */
    hotspotAffinityWeight: whole(0, 10),
    /** Challenges suggested by opened hotspots count as the rule's weight ÷ this (rounded down, min 1). */
    impliedChallengeDivisor: whole(1, 10),
    /** Most points that implied challenges can add to one recommendation. */
    impliedChallengeCap: whole(0, 20),
  }),
  results: z.strictObject({
    /** Top recommendations shown first. */
    primary: whole(1, 3),
    /** Further recommendations shown as "you may also be interested in". */
    secondary: whole(0, 3),
    /**
     * Cards the visitor has already seen keep their order unless a reordering is backed by at least this
     * many points (avoids cards jumping around after small changes).
     */
    reorderMargin: whole(0, 10),
  }),
  /** Score thresholds for the relevance label (shown in words, never as a number or percentage). */
  relevance: z
    .strictObject({ high: whole(1, 100), medium: whole(1, 100) })
    .refine((r) => r.high > r.medium, { error: "relevance.high must be greater than relevance.medium" }),
  /** When recommendations are "ready" (any one condition is enough). */
  readiness: z.strictObject({
    /** Role plus at least this many challenges. */
    personaPlusChallenges: whole(1, 3),
    /** At least this many challenges without a role. */
    challengesAlone: whole(1, 3),
    /** Meaningful interaction (an information or solution panel opened) in this many distinct scenes. */
    distinctScenes: whole(1, 8),
    /** This many unique information or solution hotspots opened. */
    uniqueHotspots: whole(1, 20),
  }),
});
export type EngineSettings = z.infer<typeof EngineSettingsSchema>;
export type ScoringSettings = EngineSettings["scoring"];
export type ReadinessSettings = EngineSettings["readiness"];
