import { describe, expect, it } from "vitest";
import {
  visibleContent,
  type ContentBundle,
  type PublicContentBundle,
  type PublicRecommendationRule,
  type SignalWeights,
} from "@/domain/content";
import { recommend, relevanceLevel } from "@/domain/recommendations/engine";
import {
  RecommendationResultSchema,
  primaryItems,
  type RecommendationResult,
} from "@/domain/recommendations/recommendation-result";
import { EMPTY_SIGNALS, type SessionSignals } from "@/domain/session/visitor-session";
import { INITIAL_KIOSK_STATE, kioskReducer, type KioskAction } from "@/features/kiosk/state/kiosk-state";
import { emptyWeights } from "../../helpers/fixtures";
import { clone, loadSeedBundle } from "../../helpers/schema";

/**
 * Engine properties tested on small synthetic rule sets over the seed solutions, so each property
 * (arithmetic, caps, duplicates, exclusions, tie-breaking, filtering) is isolated from seed tuning.
 */

const seed = loadSeedBundle();
const demo = visibleContent(seed, "demo");

const rule = (
  solutionId: string,
  weights: Partial<SignalWeights>,
  extra: Partial<PublicRecommendationRule> = {},
): PublicRecommendationRule => ({
  id: `rule-${solutionId}`,
  solutionId,
  weights: { ...emptyWeights(), ...weights },
  minimumScore: 1,
  exclusions: [],
  explanationTemplate: { es: "Relevante.", en: "Relevant." },
  priority: 50,
  validationStatus: "validated",
  ...extra,
});

function withRules(rules: PublicRecommendationRule[], base: PublicContentBundle = demo): PublicContentBundle {
  return { ...clone(base), recommendationRules: rules };
}

function run(signals: Partial<SessionSignals>, content: PublicContentBundle): RecommendationResult {
  const result = recommend({ ...EMPTY_SIGNALS, ...signals }, content);
  expect(result).not.toBeNull();
  return RecommendationResultSchema.parse(result);
}
const ids = (r: RecommendationResult) => r.items.map((i) => i.solutionId);
const scoreOf = (r: RecommendationResult, solutionId: string) =>
  r.items.find((i) => i.solutionId === solutionId)?.score;

describe("deterministic scoring", () => {
  const content = withRules([
    rule("medical-gas-supply-planning", {
      personas: { executive: 3 },
      challenges: { "supply-continuity": 5 },
      facilityTypes: { "acute-hospital": 1 },
      explicitInterests: { "medical-gas-supply-planning": 6 },
    }),
  ]);

  it("adds the whole-number weights of every matched signal", () => {
    const r = run(
      {
        personaId: "executive",
        challengeIds: ["supply-continuity"],
        facilityTypeId: "acute-hospital",
        explicitInterestIds: ["medical-gas-supply-planning"],
      },
      content,
    );
    expect(r.items[0]!.score).toBe(3 + 5 + 1 + 6);
    expect(r.items[0]!.matchedSignals.map((m) => [m.signalType, m.weight])).toEqual([
      ["personas", 3],
      ["challenges", 5],
      ["facilityTypes", 1],
      ["explicitInterests", 6],
    ]);
    expect(r.items.every((i) => Number.isInteger(i.score))).toBe(true);
  });

  it("counts implied challenges as a whole-number share of the rule's weight (never a fraction)", () => {
    // "utilities-alarm-panel" suggests visibility-monitoring; weight 5 ÷ divisor 2 → 2.
    const implied = withRules([
      rule("monitoring-telemetry", { challenges: { "visibility-monitoring": 5 } }),
      rule("infrastructure-assessment", { challenges: { "aging-infrastructure": 1 } }),
    ]);
    const r = run({ openedHotspotIds: ["utilities-alarm-panel"] }, implied);
    const item = r.items.find((i) => i.solutionId === "monitoring-telemetry")!;
    expect(item.matchedSignals).toContainEqual({
      signalType: "challenges",
      signalId: "visibility-monitoring",
      kind: "implied-challenge",
      weight: 2,
    });
  });

  it("returns exactly the same result on every run and for any order of the visitor's signals", () => {
    const signals: Partial<SessionSignals> = {
      personaId: "operations-facilities",
      challengeIds: ["aging-infrastructure", "emergency-preparedness", "supply-continuity"],
      visitedSceneIds: ["campus", "utilities", "gas-plant", "icu"],
      openedHotspotIds: ["utilities-manifold-room", "gas-plant-backup", "icu-monitoring"],
      engagedHotspotIds: ["gas-plant-backup"],
    };
    const first = run(signals, demo);
    for (let i = 0; i < 20; i++) expect(run(signals, demo)).toEqual(first);
    const rotations = (list: string[]) => list.map((_, k) => [...list.slice(k), ...list.slice(0, k)]);
    for (const challengeIds of rotations(signals.challengeIds!)) {
      for (const openedHotspotIds of rotations(signals.openedHotspotIds!)) {
        const r = run(
          {
            ...signals,
            challengeIds,
            openedHotspotIds,
            visitedSceneIds: [...signals.visitedSceneIds!].reverse(),
          },
          demo,
        );
        expect(ids(r)).toEqual(ids(first));
        expect(r.items.map((x) => x.score)).toEqual(first.items.map((x) => x.score));
      }
    }
  });

  it("drops a rule whose score stays below its minimum", () => {
    const strict = withRules([
      rule("backup-emergency-supply", { personas: { executive: 3 } }, { minimumScore: 4 }),
    ]);
    expect(ids(run({ personaId: "executive" }, strict))).toEqual(["talk-to-specialist"]);
  });
});

describe("duplicate and repeated interactions", () => {
  const content = withRules([
    rule("bulk-centralized-supply", {
      hotspots: { "gas-plant-bulk-tank": 4, "campus-supply-network": 4, "gas-plant-backup": 4 },
      scenes: { campus: 2, "gas-plant": 2, laboratory: 2 },
    }),
  ]);

  it("counts a hotspot opened many times, or listed twice, only once", () => {
    const once = run({ openedHotspotIds: ["gas-plant-bulk-tank"] }, content);
    const repeated = run({ openedHotspotIds: Array(25).fill("gas-plant-bulk-tank") }, content);
    expect(repeated).toEqual(once);
    expect(scoreOf(once, "bulk-centralized-supply")).toBe(4);
  });

  it("repeated taps through the session store never inflate a recommendation", () => {
    const tap = (times: number) => {
      const actions: KioskAction[] = [
        {
          type: "START_SESSION",
          id: "7c9e6679-7425-40de-944b-e07fc1f90ae7",
          startedAt: "2026-10-20T14:00:00.000Z",
        },
      ];
      for (let i = 0; i < times; i++) {
        actions.push({ type: "OPEN_HOTSPOT", hotspotId: "gas-plant-bulk-tank" });
        actions.push({ type: "ENGAGE_HOTSPOT", hotspotId: "gas-plant-bulk-tank" });
        actions.push({ type: "VISIT_SCENE", sceneId: i % 2 ? "campus" : "gas-plant" });
      }
      const state = actions.reduce(kioskReducer, INITIAL_KIOSK_STATE);
      return run(state.session!.signals, content);
    };
    expect(tap(50)).toEqual(tap(2));
  });

  it("toggling an interest on and off leaves no trace in the score", () => {
    const actions: KioskAction[] = [
      {
        type: "START_SESSION",
        id: "7c9e6679-7425-40de-944b-e07fc1f90ae7",
        startedAt: "2026-10-20T14:00:00.000Z",
      },
      ...Array.from({ length: 10 }, (): KioskAction => ({
        type: "TOGGLE_INTEREST",
        solutionId: "bulk-centralized-supply",
      })),
    ];
    const state = actions.reduce(kioskReducer, INITIAL_KIOSK_STATE);
    expect(state.session!.signals.explicitInterestIds).toEqual([]);
  });

  it("caps hotspots, the engagement bonus and scenes per recommendation", () => {
    const r = run(
      {
        visitedSceneIds: ["campus", "gas-plant", "laboratory"],
        openedHotspotIds: ["gas-plant-bulk-tank", "campus-supply-network", "gas-plant-backup"],
        engagedHotspotIds: ["gas-plant-bulk-tank", "campus-supply-network", "gas-plant-backup"],
      },
      content,
    );
    const matches = r.items[0]!.matchedSignals;
    const total = (type: string) =>
      matches.filter((m) => m.signalType === type).reduce((a, m) => a + m.weight, 0);
    expect(total("hotspots")).toBe(demo.settings.scoring.hotspotCap);
    expect(total("scenes")).toBe(demo.settings.scoring.sceneCap);
    expect(r.items[0]!.score).toBe(demo.settings.scoring.hotspotCap + demo.settings.scoring.sceneCap);
  });

  it("caps implied challenges", () => {
    const implied = withRules([
      rule("training-operational-readiness", {
        challenges: {
          "patient-staff-safety": 6,
          "compliance-readiness": 6,
          "emergency-preparedness": 6,
          "supply-continuity": 6,
        },
      }),
    ]);
    const r = run(
      { openedHotspotIds: ["gas-plant-perimeter", "emergency-surge-readiness", "lab-safe-handling"] },
      implied,
    );
    const impliedTotal = r.items[0]!.matchedSignals.filter((m) => m.kind === "implied-challenge").reduce(
      (a, m) => a + m.weight,
      0,
    );
    expect(impliedTotal).toBe(demo.settings.scoring.impliedChallengeCap);
  });

  it("an engagement without opening the hotspot is ignored", () => {
    expect(run({ engagedHotspotIds: ["gas-plant-bulk-tank"] }, content).items[0]!.isFallback).toBe(true);
  });
});

describe("exclusions", () => {
  const content = withRules([
    rule(
      "bulk-centralized-supply",
      { challenges: { "supply-continuity": 10 } },
      { exclusions: [{ signalType: "facilityTypes", ids: ["homecare-organization"] }] },
    ),
    rule("medical-gas-supply-planning", { challenges: { "supply-continuity": 5 } }),
    rule("backup-emergency-supply", { challenges: { "supply-continuity": 4 } }),
    rule("cylinder-inventory-management", { challenges: { "supply-continuity": 3 } }),
    rule(
      "monitoring-telemetry",
      { challenges: { "supply-continuity": 2 } },
      { exclusions: [{ signalType: "hotspots", ids: ["icu-monitoring"] }] },
    ),
  ]);

  it("removes an excluded solution even when it would score highest", () => {
    const without = run({ challengeIds: ["supply-continuity"] }, content);
    expect(ids(without)[0]).toBe("bulk-centralized-supply");
    const excluded = run(
      { challengeIds: ["supply-continuity"], facilityTypeId: "homecare-organization" },
      content,
    );
    expect(ids(excluded)).not.toContain("bulk-centralized-supply");
  });

  it("applies before ranking, so the excluded solution frees its place", () => {
    const excluded = run(
      { challengeIds: ["supply-continuity"], facilityTypeId: "homecare-organization" },
      content,
    );
    expect(primaryItems(excluded).map((i) => i.solutionId)).toEqual([
      "medical-gas-supply-planning",
      "backup-emergency-supply",
      "cylinder-inventory-management",
    ]);
    expect(excluded.items.map((i) => i.rank)).toEqual(excluded.items.map((_, i) => i + 1));
  });

  it("works for any signal type (here: an opened hotspot)", () => {
    expect(ids(run({ challengeIds: ["supply-continuity"] }, content))).toContain("monitoring-telemetry");
    expect(
      ids(run({ challengeIds: ["supply-continuity"], openedHotspotIds: ["icu-monitoring"] }, content)),
    ).not.toContain("monitoring-telemetry");
  });
});

describe("tie-breaking", () => {
  it("equal scores: the recommendation driven by explicit choices wins", () => {
    const content = withRules([
      rule("medical-gas-supply-planning", { personas: { executive: 4 } }, { priority: 99 }),
      rule("backup-emergency-supply", { challenges: { "supply-continuity": 4 } }, { priority: 1 }),
    ]);
    const r = run({ personaId: "executive", challengeIds: ["supply-continuity"] }, content);
    expect(r.items[0]!.score).toBe(r.items[1]!.score);
    expect(ids(r)).toEqual(["backup-emergency-supply", "medical-gas-supply-planning"]);
  });

  it("then the higher rule priority", () => {
    const content = withRules([
      rule("medical-gas-supply-planning", { personas: { executive: 4 } }, { priority: 10 }),
      rule("backup-emergency-supply", { personas: { executive: 4 } }, { priority: 90 }),
    ]);
    expect(ids(run({ personaId: "executive" }, content))).toEqual([
      "backup-emergency-supply",
      "medical-gas-supply-planning",
    ]);
  });

  it("then the solution id, alphabetically — regardless of the order of the rules", () => {
    const rules = [
      rule("monitoring-telemetry", { personas: { executive: 4 } }),
      rule("backup-emergency-supply", { personas: { executive: 4 } }),
      rule("medical-gas-supply-planning", { personas: { executive: 4 } }),
    ];
    const expected = ["backup-emergency-supply", "medical-gas-supply-planning", "monitoring-telemetry"];
    expect(ids(run({ personaId: "executive" }, withRules(rules)))).toEqual(expected);
    expect(ids(run({ personaId: "executive" }, withRules([...rules].reverse())))).toEqual(expected);
  });
});

describe("demo versus production content filtering", () => {
  function validatedBundle(): ContentBundle {
    const bundle = clone(seed);
    for (const id of ["backup-emergency-supply", "talk-to-specialist"]) {
      bundle.solutions.find((s) => s.id === id)!.validationStatus = "validated";
    }
    bundle.recommendationRules.find((r) => r.solutionId === "backup-emergency-supply")!.validationStatus =
      "validated";
    bundle.personas.find((p) => p.id === "government-system")!.validationStatus = "validated";
    return bundle;
  }

  it("demo mode recommends assumed solutions and marks them pending validation", () => {
    const r = run({ personaId: "government-system" }, demo);
    expect(r.items.every((i) => i.validationStatus === "assumed" && i.pendingValidation)).toBe(true);
  });

  it("production mode recommends validated solutions only, without the pending indicator", () => {
    const production = visibleContent(validatedBundle(), "production");
    const r = run({ personaId: "government-system" }, production);
    expect(ids(r)).toEqual(["backup-emergency-supply"]);
    expect(r.items[0]).toMatchObject({ validationStatus: "validated", pendingValidation: false });
  });

  it("production mode with nothing validated returns no recommendation at all", () => {
    expect(
      recommend({ ...EMPTY_SIGNALS, personaId: "executive" }, visibleContent(seed, "production")),
    ).toBeNull();
  });

  it("never recommends unavailable or placeholder solutions, even in demo mode", () => {
    for (const status of ["unavailable", "placeholder"] as const) {
      const bundle = clone(seed);
      bundle.solutions.find((s) => s.id === "backup-emergency-supply")!.validationStatus = status;
      const r = run(
        { personaId: "government-system", challengeIds: ["emergency-preparedness"] },
        visibleContent(bundle, "demo"),
      );
      expect(ids(r)).not.toContain("backup-emergency-supply");
    }
  });

  it("is defensive when handed content that was not filtered for its mode", () => {
    // An assumed solution slipped into a production bundle is still not recommended.
    const unfiltered: PublicContentBundle = { ...clone(demo), mode: "production" };
    expect(recommend({ ...EMPTY_SIGNALS, personaId: "executive" }, unfiltered)).toBeNull();
  });

  it("offers approved (validated) assets only", () => {
    const placeholderOnly = run({ personaId: "government-system" }, demo);
    expect(placeholderOnly.items.flatMap((i) => i.digitalAssetIds)).toEqual([]);
    const bundle = clone(seed);
    bundle.digitalAssets.find((a) => a.id === "asset-emergency-planning-checklist")!.validationStatus =
      "validated";
    const r = run({ personaId: "government-system" }, visibleContent(bundle, "demo"));
    expect(r.items.find((i) => i.solutionId === "backup-emergency-supply")!.digitalAssetIds).toEqual([
      "asset-emergency-planning-checklist",
    ]);
  });
});

describe("outputs", () => {
  it("expresses relevance in words from the configured thresholds", () => {
    const thresholds = demo.settings.relevance;
    expect(relevanceLevel(thresholds.high, thresholds)).toBe("high");
    expect(relevanceLevel(thresholds.high - 1, thresholds)).toBe("medium");
    expect(relevanceLevel(thresholds.medium, thresholds)).toBe("medium");
    expect(relevanceLevel(thresholds.medium - 1, thresholds)).toBe("possible");
    const r = run({ personaId: "procurement-supply", challengeIds: ["cylinder-inventory"] }, demo);
    expect(r.items[0]!.relevanceLevel).toBe("high");
    expect(run({ personaId: "procurement-supply" }, demo).items[0]!.relevanceLevel).toBe("possible");
  });

  it("points to the scene where the visitor met the recommendation, else to its main area", () => {
    const content = withRules([
      rule("backup-emergency-supply", {
        hotspots: { "gas-plant-backup": 4 },
        scenes: { emergency: 1 },
        personas: { executive: 3 },
      }),
    ]);
    expect(run({ openedHotspotIds: ["gas-plant-backup"] }, content).items[0]!.sceneId).toBe("gas-plant");
    expect(run({ visitedSceneIds: ["emergency"], personaId: "executive" }, content).items[0]!.sceneId).toBe(
      "emergency",
    );
    // No exploration: the first related area that is not the campus.
    expect(run({ personaId: "executive" }, content).items[0]!.sceneId).toBe("gas-plant");
  });

  it("includes the next action and never exposes a lead score", () => {
    const r = run({ personaId: "executive", challengeIds: ["supply-continuity"] }, demo);
    for (const item of r.items) {
      expect(item.nextStep.es.length).toBeGreaterThan(5);
      expect(Object.keys(item)).not.toContain("leadScore");
    }
    const keys = (v: unknown): string[] =>
      Array.isArray(v)
        ? v.flatMap(keys)
        : v && typeof v === "object"
          ? Object.entries(v).flatMap(([k, x]) => [k, ...keys(x)])
          : [];
    expect(keys(r).filter((k) => /lead|qualif|priorityScore/i.test(k))).toEqual([]);
  });
});
