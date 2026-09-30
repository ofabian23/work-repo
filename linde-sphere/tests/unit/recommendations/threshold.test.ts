import { describe, expect, it } from "vitest";
import { RECOMMENDATION_THRESHOLD } from "@/domain/recommendations/engine-config";
import { hasMinimumInfo, recommendationThreshold } from "@/domain/recommendations/threshold";
import { EMPTY_SIGNALS, type SessionSignals } from "@/domain/session/visitor-session";

const s = (signals: Partial<SessionSignals>) => ({ ...EMPTY_SIGNALS, ...signals });

describe("recommendation threshold", () => {
  it("is not met with no information", () => {
    expect(recommendationThreshold(EMPTY_SIGNALS)).toEqual({
      met: false,
      openedHotspots: 0,
      requiredHotspots: 3,
    });
  });

  it.each([
    ["a role", s({ personaId: "finance" })],
    ["one challenge", s({ challengeIds: ["supply-continuity"] })],
    ["three opened hotspots", s({ openedHotspotIds: ["a-1", "b-2", "c-3"] })],
    ["one explicit interest", s({ explicitInterestIds: ["backup-emergency-supply"] })],
  ])("is met with %s", (_label, signals) => {
    expect(hasMinimumInfo(signals)).toBe(true);
  });

  it("counts opened hotspots towards the explorer threshold", () => {
    expect(recommendationThreshold(s({ openedHotspotIds: ["a-1", "b-2"] }))).toEqual({
      met: false,
      openedHotspots: 2,
      requiredHotspots: 3,
    });
  });

  it("is configurable", () => {
    const strict = { ...RECOMMENDATION_THRESHOLD, personaSuffices: false, minOpenedHotspots: 5 };
    expect(hasMinimumInfo(s({ personaId: "finance" }), strict)).toBe(false);
    expect(hasMinimumInfo(s({ openedHotspotIds: ["a-1", "b-2", "c-3"] }), strict)).toBe(false);
  });
});
