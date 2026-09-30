import { describe, expect, it } from "vitest";
import { visibleContent } from "@/domain/content";
import { recommend } from "@/domain/recommendations/engine";
import { RecommendationReadiness } from "@/domain/recommendations/recommendation-readiness";
import { recommendationEvidence } from "@/domain/recommendations/recommendation-stability";
import {
  INITIAL_KIOSK_STATE,
  kioskReducer,
  type KioskAction,
  type KioskState,
} from "@/features/kiosk/state/kiosk-state";
import { loadSeedBundle } from "../../helpers/schema";

/**
 * Repeating an interaction must never count twice: a visitor who taps the same hotspot five times, or
 * toggles a challenge off and on, gets exactly the same score, readiness and ranking as one who did it once.
 */
const demo = visibleContent(loadSeedBundle(), "demo");
const run = (actions: KioskAction[]): KioskState => actions.reduce(kioskReducer, INITIAL_KIOSK_STATE);
const START: KioskAction = {
  type: "START_SESSION",
  id: "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  startedAt: "2026-10-20T14:00:00.000Z",
};
const signalsOf = (state: KioskState) => state.session!.signals;
const resultFor = (state: KioskState) =>
  recommend(recommendationEvidence(signalsOf(state), demo.scenes), demo);

const once: KioskAction[] = [
  START,
  { type: "CHOOSE_PATH", path: "explore" },
  { type: "VISIT_SCENE", sceneId: "campus" },
  { type: "OPEN_HOTSPOT", hotspotId: "campus-expansion" },
  { type: "VISIT_SCENE", sceneId: "gas-plant" },
  { type: "OPEN_HOTSPOT", hotspotId: "gas-plant-bulk-tank" },
  { type: "TOGGLE_CHALLENGE", challengeId: "supply-continuity", max: 3 },
];
const repeated: KioskAction[] = [
  START,
  { type: "CHOOSE_PATH", path: "explore" },
  { type: "VISIT_SCENE", sceneId: "campus" },
  { type: "OPEN_HOTSPOT", hotspotId: "campus-expansion" },
  { type: "OPEN_HOTSPOT", hotspotId: "campus-expansion" },
  { type: "OPEN_HOTSPOT", hotspotId: "campus-expansion" },
  { type: "VISIT_SCENE", sceneId: "gas-plant" },
  { type: "VISIT_SCENE", sceneId: "campus" },
  { type: "VISIT_SCENE", sceneId: "gas-plant" },
  { type: "OPEN_HOTSPOT", hotspotId: "gas-plant-bulk-tank" },
  { type: "OPEN_HOTSPOT", hotspotId: "gas-plant-bulk-tank" },
  // Toggled on, off and on again: selected once.
  { type: "TOGGLE_CHALLENGE", challengeId: "supply-continuity", max: 3 },
  { type: "TOGGLE_CHALLENGE", challengeId: "supply-continuity", max: 3 },
  { type: "TOGGLE_CHALLENGE", challengeId: "supply-continuity", max: 3 },
];

describe("duplicate interactions", () => {
  it("store each hotspot, scene and challenge once", () => {
    const s = signalsOf(run(repeated));
    expect(s.openedHotspotIds).toEqual(["campus-expansion", "gas-plant-bulk-tank"]);
    expect(s.visitedSceneIds).toEqual(["campus", "gas-plant"]);
    expect(s.challengeIds).toEqual(["supply-continuity"]);
  });

  it("give the same readiness as doing each thing once", () => {
    const a = RecommendationReadiness.assess(signalsOf(run(once)), demo);
    const b = RecommendationReadiness.assess(signalsOf(run(repeated)), demo);
    expect(b).toEqual(a);
    expect(b.progress).toMatchObject({ meaningfulHotspots: 2, meaningfulScenes: 2, challenges: 1 });
  });

  it("give the same scores and ranking as doing each thing once", () => {
    const a = resultFor(run(once));
    const b = resultFor(run(repeated));
    expect(a).not.toBeNull();
    expect(b!.items.map((i) => [i.solutionId, i.score])).toEqual(
      a!.items.map((i) => [i.solutionId, i.score]),
    );
  });

  it("do not inflate readiness when the same hotspot is counted many times in raw signals", () => {
    const r = RecommendationReadiness.assess(
      { ...signalsOf(run([START])), openedHotspotIds: Array(10).fill("utilities-manifold-room") },
      demo,
    );
    expect(r.progress.meaningfulHotspots).toBe(1);
    expect(r.ready).toBe(false);
  });

  it("an interest marked twice is one interest, and unmarking it removes it", () => {
    const toggle: KioskAction = { type: "TOGGLE_INTEREST", solutionId: "bulk-centralized-supply" };
    expect(signalsOf(run([START, toggle])).explicitInterestIds).toEqual(["bulk-centralized-supply"]);
    expect(signalsOf(run([START, toggle, toggle])).explicitInterestIds).toEqual([]);
  });
});
