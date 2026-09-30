import { describe, expect, it } from "vitest";
import { visibleContent } from "@/domain/content";
import { recommend } from "@/domain/recommendations/engine";
import type {
  RecommendationItem,
  RecommendationResult,
} from "@/domain/recommendations/recommendation-result";
import {
  evidenceKey,
  recommendationChanges,
  recommendationEvidence,
  stabilizeRecommendations,
} from "@/domain/recommendations/recommendation-stability";
import { EMPTY_SIGNALS, type SessionSignals } from "@/domain/session/visitor-session";
import { loadSeedBundle } from "../../helpers/schema";

const demo = visibleContent(loadSeedBundle(), "demo");
const s = (signals: Partial<SessionSignals>): SessionSignals => ({ ...EMPTY_SIGNALS, ...signals });

describe("recommendation evidence", () => {
  it("keeps choices and content the visitor looked at", () => {
    const evidence = recommendationEvidence(
      s({
        personaId: "procurement-supply",
        challengeIds: ["cylinder-inventory"],
        explicitInterestIds: ["bulk-centralized-supply"],
        openedHotspotIds: ["gas-plant-bulk-tank"],
        engagedHotspotIds: ["gas-plant-bulk-tank"],
        visitedSceneIds: ["campus", "gas-plant"],
      }),
      demo.scenes,
    );
    expect(evidence).toEqual({
      personaId: "procurement-supply",
      challengeIds: ["cylinder-inventory"],
      facilityTypeId: null,
      visitedSceneIds: ["gas-plant"],
      openedHotspotIds: ["gas-plant-bulk-tank"],
      engagedHotspotIds: ["gas-plant-bulk-tank"],
      explicitInterestIds: ["bulk-centralized-supply"],
    });
  });

  it("ignores walking between scenes: navigation clicks and scenes merely passed through", () => {
    const base = s({ openedHotspotIds: ["gas-plant-bulk-tank"], visitedSceneIds: ["campus", "gas-plant"] });
    const walked = s({
      openedHotspotIds: ["gas-plant-bulk-tank", "campus-to-icu", "icu-to-operating-room"],
      visitedSceneIds: ["campus", "gas-plant", "icu", "operating-room", "laboratory"],
    });
    expect(evidenceKey(recommendationEvidence(walked, demo.scenes))).toBe(
      evidenceKey(recommendationEvidence(base, demo.scenes)),
    );
  });

  it("has an order-independent key that changes with meaningful evidence", () => {
    const a = recommendationEvidence(s({ challengeIds: ["a-1", "b-2"] }), demo.scenes);
    const b = recommendationEvidence(s({ challengeIds: ["b-2", "a-1"] }), demo.scenes);
    expect(evidenceKey(a)).toBe(evidenceKey(b));
    const more = recommendationEvidence(
      s({ challengeIds: ["a-1", "b-2"], openedHotspotIds: ["icu-monitoring"] }),
      demo.scenes,
    );
    expect(evidenceKey(more)).not.toBe(evidenceKey(a));
  });
});

const item = (
  solutionId: string,
  score: number,
  tier: RecommendationItem["tier"] = "primary",
): RecommendationItem => ({
  solutionId,
  ruleId: `rule-${solutionId}`,
  rank: 1,
  tier,
  score,
  relevanceLevel: "medium",
  matchedSignals: [{ signalType: "personas", signalId: "finance", kind: "direct", weight: score }],
  whyThisAppeared: { es: "x", en: "x" },
  relevance: { es: "x", en: "x" },
  sceneId: null,
  relatedSceneIds: [],
  digitalAssetIds: [],
  nextStep: { es: "x", en: "x" },
  validationStatus: "assumed",
  pendingValidation: true,
  isFallback: false,
});
const result = (...items: RecommendationItem[]): RecommendationResult => ({
  engineVersion: "2.0.0",
  contentVersion: "0.4.0",
  contentMode: "demo",
  items: items.map((i, k) => ({ ...i, rank: k + 1 })),
});
const order = (r: RecommendationResult | null) => r!.items.map((i) => `${i.rank}:${i.solutionId}`);

describe("stabilizeRecommendations", () => {
  const seen = result(item("a1", 6), item("b1", 5), item("c1", 4));

  it("keeps the order the visitor saw when the same cards differ by less than the margin", () => {
    const next = result(item("b1", 7), item("a1", 6), item("c1", 4)); // b1 now leads by 1
    expect(order(stabilizeRecommendations(seen, next, 2))).toEqual(["1:a1", "2:b1", "3:c1"]);
  });

  it("follows the new ranking when a card is now clearly stronger (≥ margin)", () => {
    const next = result(item("c1", 9), item("a1", 6), item("b1", 5)); // c1 leads by 3
    expect(order(stabilizeRecommendations(seen, next, 2))).toEqual(["1:c1", "2:a1", "3:b1"]);
  });

  it("follows the new ranking when the set of recommendations changed", () => {
    const next = result(item("d1", 5), item("a1", 6), item("b1", 5));
    expect(order(stabilizeRecommendations(seen, next, 10))).toEqual(["1:d1", "2:a1", "3:b1"]);
  });

  it("stabilizes primary and secondary tiers separately", () => {
    const previous = result(
      item("a1", 6),
      item("b1", 5),
      item("c1", 4),
      item("d1", 3, "secondary"),
      item("e1", 3, "secondary"),
    );
    const next = result(
      item("a1", 6),
      item("b1", 5),
      item("c1", 4),
      item("e1", 4, "secondary"),
      item("d1", 3, "secondary"),
    );
    expect(order(stabilizeRecommendations(previous, next, 2))).toEqual([
      "1:a1",
      "2:b1",
      "3:c1",
      "4:d1",
      "5:e1",
    ]);
  });

  it("returns the previous object when nothing changed, and is idempotent", () => {
    expect(stabilizeRecommendations(seen, result(item("a1", 6), item("b1", 5), item("c1", 4)), 2)).toBe(seen);
    const next = result(item("b1", 7), item("a1", 6), item("c1", 4));
    const once = stabilizeRecommendations(seen, next, 2);
    expect(stabilizeRecommendations(once, next, 2)).toBe(once);
  });

  it("uses the new result as is when there is nothing to compare with, or a fallback is involved", () => {
    const next = result(item("b1", 7), item("a1", 6));
    expect(stabilizeRecommendations(null, next, 2)).toBe(next);
    const fallback = result({
      ...item("talk-to-specialist", 0),
      ruleId: null,
      matchedSignals: [],
      isFallback: true,
    });
    expect(stabilizeRecommendations(fallback, next, 2)).toBe(next);
  });

  it("with a margin of 0 always follows the engine's ranking", () => {
    const next = result(item("b1", 6), item("a1", 6), item("c1", 4));
    expect(order(stabilizeRecommendations(seen, next, 0))).toEqual(["1:b1", "2:a1", "3:c1"]);
  });

  it("works with real engine output: a small new signal does not reorder seen cards", () => {
    const before = recommend(
      recommendationEvidence(
        s({ openedHotspotIds: ["campus-expansion", "gas-plant-bulk-tank"] }),
        demo.scenes,
      ),
      demo,
    );
    const after = recommend(
      recommendationEvidence(
        s({
          openedHotspotIds: ["campus-expansion", "gas-plant-bulk-tank"],
          engagedHotspotIds: ["campus-expansion"],
        }),
        demo.scenes,
      ),
      demo,
    );
    const stable = stabilizeRecommendations(before, after, demo.settings.results.reorderMargin);
    expect(stable!.items.map((i) => i.solutionId)).toEqual(before!.items.map((i) => i.solutionId));
  });
});

describe("recommendationChanges", () => {
  it("reports new cards and whether anything changed", () => {
    const seen = result(item("a1", 6), item("b1", 5));
    expect(recommendationChanges(seen, result(item("c1", 8), item("a1", 6)))).toEqual({
      newIds: ["c1"],
      changed: true,
    });
    expect(recommendationChanges(seen, result(item("b1", 6), item("a1", 6)))).toEqual({
      newIds: [],
      changed: true,
    });
    expect(recommendationChanges(seen, seen)).toEqual({ newIds: [], changed: false });
    expect(recommendationChanges(null, seen)).toEqual({ newIds: [], changed: false });
    // Same cards, but a card is now more relevant for a new reason.
    const moreRelevant = result(
      { ...item("a1", 9), relevanceLevel: "high", whyThisAppeared: { es: "y", en: "y" } },
      item("b1", 5),
    );
    expect(recommendationChanges(seen, moreRelevant)).toEqual({ newIds: [], changed: true });
  });
});
