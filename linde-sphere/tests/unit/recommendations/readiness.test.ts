import { describe, expect, it } from "vitest";
import { visibleContent } from "@/domain/content";
import { RecommendationReadiness } from "@/domain/recommendations/recommendation-readiness";
import { EMPTY_SIGNALS, type SessionSignals } from "@/domain/session/visitor-session";
import { loadSeedBundle } from "../../helpers/schema";

const demo = visibleContent(loadSeedBundle(), "demo");
const assess = (signals: Partial<SessionSignals>, settings = demo.settings.readiness) =>
  RecommendationReadiness.assess({ ...EMPTY_SIGNALS, ...signals }, demo, settings);

describe("RecommendationReadiness", () => {
  it("is not ready with nothing, a role alone or a single challenge", () => {
    expect(assess({}).ready).toBe(false);
    expect(assess({ personaId: "finance" }).ready).toBe(false);
    expect(assess({ challengeIds: ["supply-continuity"] }).ready).toBe(false);
  });

  it("is ready with a role plus one challenge", () => {
    expect(assess({ personaId: "finance", challengeIds: ["lifecycle-costs"] })).toMatchObject({
      ready: true,
      conditionsMet: ["persona-and-challenges"],
    });
  });

  it("is ready with two challenges", () => {
    expect(assess({ challengeIds: ["supply-continuity", "lifecycle-costs"] }).conditionsMet).toEqual([
      "challenges",
    ]);
  });

  it("is ready after meaningful interaction in two distinct scenes", () => {
    const r = assess({ openedHotspotIds: ["campus-expansion", "gas-plant-bulk-tank"] });
    expect(r.conditionsMet).toEqual(["distinct-scenes"]);
    expect(r.progress).toMatchObject({ meaningfulHotspots: 2, meaningfulScenes: 2 });
  });

  it("is ready after the configured number of unique hotspots, even in one scene", () => {
    const r = assess({
      openedHotspotIds: ["utilities-manifold-room", "utilities-alarm-panel", "utilities-maintenance"],
    });
    expect(r.conditionsMet).toEqual(["unique-hotspots"]);
    expect(r.progress.meaningfulScenes).toBe(1);
  });

  it("does not count navigation hotspots or repeated opens as meaningful", () => {
    const passingThrough = assess({
      openedHotspotIds: [
        "campus-to-icu",
        "icu-to-operating-room",
        "operating-room-to-icu",
        "campus-to-laboratory",
      ],
      visitedSceneIds: ["campus", "icu", "operating-room", "laboratory"],
    });
    expect(passingThrough.ready).toBe(false);
    expect(passingThrough.progress.meaningfulHotspots).toBe(0);
    const repeated = assess({ openedHotspotIds: ["icu-monitoring", "icu-monitoring", "icu-monitoring"] });
    expect(repeated.ready).toBe(false);
    expect(repeated.progress.meaningfulHotspots).toBe(1);
  });

  it("reports how many hotspots are still needed", () => {
    expect(assess({}).hotspotsRemaining).toBe(3);
    expect(assess({ openedHotspotIds: ["icu-monitoring"] }).hotspotsRemaining).toBe(2);
    expect(assess({ personaId: "finance", challengeIds: ["lifecycle-costs"] }).hotspotsRemaining).toBe(0);
  });

  it("lists every condition met, and follows the configured thresholds", () => {
    const all = assess({
      personaId: "finance",
      challengeIds: ["lifecycle-costs", "supply-continuity"],
      openedHotspotIds: ["campus-expansion", "gas-plant-bulk-tank", "icu-monitoring"],
    });
    expect(all.conditionsMet).toEqual([
      "persona-and-challenges",
      "challenges",
      "distinct-scenes",
      "unique-hotspots",
    ]);
    const strict = { personaPlusChallenges: 2, challengesAlone: 3, distinctScenes: 3, uniqueHotspots: 5 };
    expect(assess({ personaId: "finance", challengeIds: ["lifecycle-costs"] }, strict).ready).toBe(false);
    expect(assess({ openedHotspotIds: ["campus-expansion", "gas-plant-bulk-tank"] }, strict).ready).toBe(
      false,
    );
  });
});
