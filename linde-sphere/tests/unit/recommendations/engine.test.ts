import { describe, expect, it } from "vitest";
import { visibleContent, type PublicContentBundle } from "@/domain/content";
import { recommend } from "@/domain/recommendations/engine";
import {
  RecommendationResultSchema,
  type RecommendationResult,
} from "@/domain/recommendations/recommendation-result";
import { EMPTY_SIGNALS, type SessionSignals } from "@/domain/session/visitor-session";
import { clone, loadSeedBundle } from "../../helpers/schema";

const seed = loadSeedBundle();
const demo = visibleContent(seed, "demo");

function run(signals: Partial<SessionSignals>, content: PublicContentBundle = demo, maxResults?: number) {
  const result = recommend({ ...EMPTY_SIGNALS, ...signals }, content, { maxResults });
  expect(result).not.toBeNull();
  // Every engine output must satisfy the runtime contract.
  RecommendationResultSchema.parse(result);
  return result as RecommendationResult;
}
const ids = (r: RecommendationResult) => r.items.map((i) => i.solutionId);

describe("recommendation journeys (seed content, demo mode)", () => {
  it("persona only: procurement sees supply planning, cylinders and bulk supply", () => {
    const r = run({ personaId: "procurement-supply" });
    expect(ids(r)).toEqual([
      "medical-gas-supply-planning",
      "cylinder-inventory-management",
      "bulk-centralized-supply",
    ]);
    expect(r.items[0]!.whyThisAppeared).toEqual({
      es: "Aparece porque seleccionó «Compras y cadena de suministro» como su área.",
      en: "This appeared because you selected “Procurement and supply chain” as your area.",
    });
  });

  it("challenge only: preparing for emergencies leads with backup and emergency supply", () => {
    const r = run({ challengeIds: ["emergency-preparedness"] });
    expect(ids(r)[0]).toBe("backup-emergency-supply");
    expect(r.items[0]!.whyThisAppeared.en).toBe("This appeared because you chose “Prepare for emergencies”.");
  });

  it("persona plus challenge: clinical care + care outside the hospital", () => {
    const r = run({ personaId: "clinical-respiratory", challengeIds: ["care-outside-hospital"] });
    expect(ids(r).slice(0, 2)).toEqual(["ambulatory-homecare-support", "clinical-oxygen-support"]);
    const why = r.items[0]!.whyThisAppeared.es;
    expect(why).toContain("eligió «Apoyar el cuidado fuera del hospital»");
    expect(why).toContain("seleccionó «Clínica y terapia respiratoria» como su área");
  });

  it("exploration only: opening the storage tank surfaces bulk supply and monitoring", () => {
    const r = run({
      visitedSceneIds: ["campus", "gas-plant"],
      openedHotspotIds: ["gas-plant-bulk-tank"],
      engagedHotspotIds: ["gas-plant-bulk-tank"],
    });
    expect(ids(r).slice(0, 2)).toEqual(["bulk-centralized-supply", "monitoring-telemetry"]);
    const why = r.items[0]!.whyThisAppeared.en;
    expect(why).toContain("you opened “Storage tank”");
    expect(why).toContain("you explored “Medical-gas plant”");
  });

  it("exploration only: an information hotspot is enough to recommend its related category", () => {
    const r = run({ visitedSceneIds: ["campus", "utilities"], openedHotspotIds: ["utilities-alarm-panel"] });
    expect(ids(r)[0]).toBe("monitoring-telemetry");
    // Implied challenges are phrased as related to exploration, never as the visitor's choice.
    expect(r.items[0]!.whyThisAppeared.en).toContain(
      "what you explored relates to “Improve visibility and monitoring”",
    );
    expect(r.items[0]!.whyThisAppeared.en).not.toContain("you chose");
  });

  it("blended journey: persona, challenges, facility, exploration and an explicit interest", () => {
    const r = run({
      personaId: "operations-facilities",
      challengeIds: ["aging-infrastructure", "emergency-preparedness"],
      facilityTypeId: "acute-hospital",
      visitedSceneIds: ["campus", "utilities", "operating-room"],
      openedHotspotIds: ["utilities-manifold-room", "or-infrastructure"],
      engagedHotspotIds: ["or-infrastructure"],
      explicitInterestIds: ["preventive-service-maintenance"],
    });
    expect(ids(r)).toEqual([
      "infrastructure-assessment",
      "preventive-service-maintenance",
      "backup-emergency-supply",
    ]);
    expect(r.items[1]!.whyThisAppeared.es).toContain("lo marcó como interés");
    expect(r.items[0]!.matchedSignals.map((m) => m.kind)).toEqual(
      expect.arrayContaining(["direct", "engaged-bonus"]),
    );
  });
});

describe("coverage", () => {
  const singleAreaPersonas = seed.personas.filter((p) => p.scope === "single");
  it.each(singleAreaPersonas.map((p) => [p.id]))(
    "persona %s alone yields rule-based recommendations",
    (personaId) => {
      const r = run({ personaId });
      expect(r.items[0]!.isFallback).toBe(false);
    },
  );

  it("the several-areas persona names no area: alone it yields the fallback, with challenges it follows them", () => {
    expect(run({ personaId: "multiple-areas" }).items[0]!.isFallback).toBe(true);
    const r = run({ personaId: "multiple-areas", challengeIds: ["supply-continuity"] });
    expect(r.items[0]!.isFallback).toBe(false);
    for (const item of r.items) {
      expect(item.matchedSignals.some((m) => m.signalType === "personas")).toBe(false);
      expect(item.whyThisAppeared.es).not.toMatch(/varias áreas/);
    }
  });

  it.each(seed.challenges.map((c) => [c.id]))(
    "challenge %s alone yields rule-based recommendations",
    (challengeId) => {
      const r = run({ challengeIds: [challengeId] });
      expect(r.items[0]!.isFallback).toBe(false);
    },
  );

  const solutionHotspots = seed.scenes.flatMap((s) =>
    s.hotspots.flatMap((h) =>
      h.type === "solution" ? [{ scene: s.id, hotspot: h.id, targets: h.targetSolutionIds }] : [],
    ),
  );
  it.each(solutionHotspots.map((h) => [h.hotspot, h]))(
    "opening solution hotspot %s recommends at least one of its targets",
    (_id, h) => {
      const r = run({ visitedSceneIds: ["campus", h.scene], openedHotspotIds: [h.hotspot] });
      expect(ids(r).some((id) => h.targets.includes(id))).toBe(true);
    },
  );

  it("every solution can be recommended by at least one single persona, challenge or hotspot", () => {
    const reached = new Set<string>();
    for (const p of seed.personas) ids(run({ personaId: p.id })).forEach((id) => reached.add(id));
    for (const c of seed.challenges) ids(run({ challengeIds: [c.id] })).forEach((id) => reached.add(id));
    for (const h of solutionHotspots)
      ids(run({ openedHotspotIds: [h.hotspot] })).forEach((id) => reached.add(id));
    const expected = seed.solutions.filter((s) => !s.isFallback).map((s) => s.id);
    expect([...reached].filter((id) => expected.includes(id)).sort()).toEqual(expected.sort());
  });

  it("every rule-based recommendation carries bilingual why and relevance text", () => {
    for (const p of seed.personas) {
      for (const item of run({ personaId: p.id, challengeIds: [seed.challenges[0]!.id] }).items) {
        expect(item.whyThisAppeared.es).toMatch(/^Aparece porque/);
        expect(item.whyThisAppeared.en).toMatch(/^This appeared because/);
        expect(item.relevance.es.length).toBeGreaterThan(10);
        expect(item.relevance.en.length).toBeGreaterThan(10);
      }
    }
  });
});

describe("determinism and rules", () => {
  const blended: Partial<SessionSignals> = {
    personaId: "executive",
    challengeIds: ["supply-continuity", "facility-expansion", "lifecycle-costs"],
    visitedSceneIds: ["campus", "gas-plant", "laboratory"],
    openedHotspotIds: ["gas-plant-backup", "lab-gas-supply"],
  };

  it("returns identical output for identical input", () => {
    expect(run(blended)).toEqual(run(blended));
  });

  it("ranking does not depend on the order signals were collected", () => {
    const reversed = {
      ...blended,
      challengeIds: [...blended.challengeIds!].reverse(),
      visitedSceneIds: [...blended.visitedSceneIds!].reverse(),
      openedHotspotIds: [...blended.openedHotspotIds!].reverse(),
    };
    expect(ids(run(reversed))).toEqual(ids(run(blended)));
    expect(run(reversed).items.map((i) => i.score)).toEqual(run(blended).items.map((i) => i.score));
  });

  it("applies exclusion rules (homecare organizations do not see bulk or infrastructure categories)", () => {
    const r = run(
      {
        challengeIds: ["supply-continuity", "aging-infrastructure", "facility-expansion"],
        facilityTypeId: "homecare-organization",
      },
      demo,
      5,
    );
    expect(ids(r)).not.toContain("bulk-centralized-supply");
    expect(ids(r)).not.toContain("infrastructure-assessment");
    const withoutFacility = run(
      { challengeIds: ["supply-continuity", "aging-infrastructure", "facility-expansion"] },
      demo,
      5,
    );
    expect(ids(withoutFacility)).toContain("infrastructure-assessment");
  });

  it("does not recommend below the minimum threshold (a secondary persona alone is not enough)", () => {
    // Executive weights bulk supply at 2, below its threshold of 3.
    expect(ids(run({ personaId: "executive" }, demo, 5))).not.toContain("bulk-centralized-supply");
  });

  it("breaks ties by explicit score, then rule priority, then id", () => {
    // Procurement weights supply planning and cylinders equally (4); supply planning has higher priority.
    const r = run({ personaId: "procurement-supply" });
    expect(r.items[0]!.score).toBe(r.items[1]!.score);
    expect(ids(r).slice(0, 2)).toEqual(["medical-gas-supply-planning", "cylinder-inventory-management"]);
  });

  it("caps scene contributions so browsing cannot dominate explicit choices", () => {
    const r = run({ visitedSceneIds: seed.scenes.map((s) => s.id), challengeIds: ["care-outside-hospital"] });
    for (const item of r.items) {
      const sceneTotal = item.matchedSignals
        .filter((m) => m.signalType === "scenes")
        .reduce((a, m) => a + m.weight, 0);
      expect(sceneTotal).toBeLessThanOrEqual(3);
    }
    expect(ids(r)[0]).toBe("ambulatory-homecare-support");
  });

  it("respects maxResults and the schema limit of five", () => {
    expect(run(blended, demo, 1).items).toHaveLength(1);
    expect(run(blended, demo, 99).items.length).toBeLessThanOrEqual(5);
  });

  it("ignores unknown or hidden ids", () => {
    const r = run({ personaId: "not-a-persona", challengeIds: ["emergency-preparedness", "ghost"] });
    expect(ids(r)[0]).toBe("backup-emergency-supply");
    expect(r.items[0]!.matchedSignals.map((m) => m.signalId)).not.toContain("ghost");
  });

  it("falls back to 'talk with a specialist' when nothing qualifies", () => {
    const r = run({});
    expect(r.items).toHaveLength(1);
    expect(r.items[0]).toMatchObject({ solutionId: "talk-to-specialist", isFallback: true, ruleId: null });
    expect(r.items[0]!.whyThisAppeared.en).toMatch(/specialist can help/);
  });

  it("marks every demo recommendation as pending validation", () => {
    expect(run(blended).items.every((i) => i.pendingValidation)).toBe(true);
  });

  it("returns null in production mode while nothing is validated", () => {
    const production = visibleContent(seed, "production");
    expect(recommend({ ...EMPTY_SIGNALS, personaId: "executive" }, production)).toBeNull();
  });

  it("renders relevance placeholders from matched labels, or the fallback when unmatched", () => {
    const content = clone(demo);
    const rule = content.recommendationRules.find((r) => r.solutionId === "backup-emergency-supply")!;
    rule.explanationTemplate = { es: "Relacionado con {challenges}.", en: "Related to {challenges}." };
    rule.fallbackExplanation = { es: "Relacionado con su recorrido.", en: "Related to your journey." };
    const withChallenge = recommend({ ...EMPTY_SIGNALS, challengeIds: ["emergency-preparedness"] }, content)!;
    expect(withChallenge.items[0]!.relevance.en).toBe("Related to Prepare for emergencies.");
    const personaOnly = recommend({ ...EMPTY_SIGNALS, personaId: "government-system" }, content)!;
    expect(personaOnly.items.find((i) => i.solutionId === "backup-emergency-supply")!.relevance.en).toBe(
      "Related to your journey.",
    );
  });
});
