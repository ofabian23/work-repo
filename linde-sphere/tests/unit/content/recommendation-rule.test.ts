import { describe, expect, it } from "vitest";
import { RecommendationRuleSchema, maxAchievableScore } from "@/domain/content";
import { emptyWeights, localized, rule } from "../../helpers/fixtures";
import { expectInvalid, expectValid } from "../../helpers/schema";

describe("RecommendationRuleSchema", () => {
  it("accepts a valid rule", () => {
    expectValid(RecommendationRuleSchema, rule());
  });

  it("supports weights for every signal type", () => {
    expectValid(RecommendationRuleSchema, {
      ...rule(),
      weights: {
        personas: { executive: 2 },
        challenges: { "supply-continuity": 5 },
        facilityTypes: { "acute-hospital": 1 },
        scenes: { icu: 2 },
        hotspots: { "icu-gases": 3 },
        explicitInterests: { "clinical-gases": 6 },
      },
    });
  });

  it("requires at least one weighted signal", () => {
    expectInvalid(
      RecommendationRuleSchema,
      { ...rule(), weights: emptyWeights() },
      "weights",
      "at least one",
    );
  });

  it("rejects zero, negative or excessive weights", () => {
    for (const w of [0, -2, 11]) {
      expectInvalid(
        RecommendationRuleSchema,
        { ...rule(), weights: { ...emptyWeights(), challenges: { "supply-continuity": w } } },
        "weights.challenges.supply-continuity",
      );
    }
  });

  it("rejects weight keys that are not valid ids", () => {
    expectInvalid(
      RecommendationRuleSchema,
      { ...rule(), weights: { ...emptyWeights(), scenes: { "ICU Room": 2 } } },
      "weights.scenes.ICU Room",
    );
  });

  it("rejects an unknown signal type", () => {
    expectInvalid(
      RecommendationRuleSchema,
      { ...rule(), weights: { ...rule().weights, badges: {} } },
      "weights",
      "Unrecognized",
    );
  });

  it("requires a positive minimum threshold", () => {
    expectInvalid(RecommendationRuleSchema, { ...rule(), minimumScore: 0 }, "minimumScore");
  });

  it("requires an integer priority between 1 and 100", () => {
    expectInvalid(RecommendationRuleSchema, { ...rule(), priority: 0 }, "priority");
    expectInvalid(RecommendationRuleSchema, { ...rule(), priority: 7.5 }, "priority");
  });

  it("accepts exclusion rules and rejects excluding a weighted signal", () => {
    expectValid(RecommendationRuleSchema, {
      ...rule(),
      exclusions: [{ signalType: "facilityTypes", ids: ["homecare-organization"], reason: "Not relevant" }],
    });
    expectInvalid(
      RecommendationRuleSchema,
      { ...rule(), exclusions: [{ signalType: "personas", ids: ["executive"], reason: "Conflicting" }] },
      "exclusions[0].ids",
      "both weighted and excluded",
    );
  });

  it("requires exclusion ids and an internal reason", () => {
    expectInvalid(
      RecommendationRuleSchema,
      { ...rule(), exclusions: [{ signalType: "scenes", ids: [], reason: "x" }] },
      "exclusions[0].ids",
    );
    expectInvalid(
      RecommendationRuleSchema,
      { ...rule(), exclusions: [{ signalType: "scenes", ids: ["icu"] }] },
      "exclusions[0].reason",
    );
  });

  it("rejects unknown placeholders in the explanation template", () => {
    expectInvalid(
      RecommendationRuleSchema,
      { ...rule(), explanationTemplate: localized("Hola {nombre}", "Hello {nombre}") },
      "explanationTemplate.es",
      "Unknown placeholder",
    );
  });

  it("requires Spanish and English templates to use the same placeholders", () => {
    expectInvalid(
      RecommendationRuleSchema,
      {
        ...rule(),
        explanationTemplate: localized("Porque eligió {challenges}.", "Because you visited {scenes}."),
      },
      "explanationTemplate",
      "same placeholders",
    );
  });

  it("forbids placeholders in the fallback explanation", () => {
    expectInvalid(
      RecommendationRuleSchema,
      { ...rule(), fallbackExplanation: localized("Por {challenges}", "For {challenges}") },
      "fallbackExplanation.es",
      "not allowed",
    );
  });

  it("requires a validation status", () => {
    const { validationStatus: _v, ...noStatus } = rule();
    expectInvalid(RecommendationRuleSchema, noStatus, "validationStatus");
  });
});

describe("maxAchievableScore", () => {
  it("counts single-choice signals once and caps challenges at the selection limit", () => {
    const parsed = expectValid(RecommendationRuleSchema, {
      ...rule(),
      weights: {
        personas: { executive: 3, finance: 2 },
        facilityTypes: { "acute-hospital": 1, "academic-medical-center": 2 },
        challenges: { a1: 5, b1: 4, c1: 3, d1: 2 },
        scenes: { icu: 1, lab: 1 },
        hotspots: { h1: 2 },
        explicitInterests: { s1: 6 },
      },
    });
    // persona max 3 + facility max 2 + top-3 challenges 12 + scenes 2 + hotspots 2 + interests 6
    expect(maxAchievableScore(parsed)).toBe(27);
  });
});
