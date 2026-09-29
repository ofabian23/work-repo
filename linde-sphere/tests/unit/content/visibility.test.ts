import { describe, expect, it } from "vitest";
import { isVisibleStatus, visibleContent, type ContentBundle } from "@/domain/content";
import { clone, loadSeedBundle } from "../../helpers/schema";

const validate = <T extends { validationStatus: string }>(record: T) => {
  const r = record as Record<string, unknown>;
  r.validationStatus = "validated";
  if ("market" in r) {
    Object.assign(r, {
      market: "puerto-rico",
      reviewedBy: "Sales PR",
      lastReviewedAt: "2026-10-15",
      requiresSalesValidation: false,
    });
  }
};

describe("isVisibleStatus (CONTENT_VALIDATION.md §3)", () => {
  it.each([
    ["validated", "production", false, true],
    ["assumed", "production", false, false],
    ["placeholder", "production", false, false],
    ["unavailable", "production", false, false],
    ["validated", "demo", false, true],
    ["assumed", "demo", false, true],
    ["placeholder", "demo", false, false],
    ["unavailable", "demo", false, false],
    ["placeholder", "demo", true, true],
    ["placeholder", "production", true, false],
    ["unavailable", "demo", true, false],
  ] as const)("%s in %s (preview=%s) → %s", (status, mode, preview, expected) => {
    expect(isVisibleStatus(status, mode, { previewPlaceholders: preview })).toBe(expected);
  });
});

describe("visibleContent", () => {
  const seed = loadSeedBundle();

  it("shows nothing unvalidated in production mode", () => {
    const pub = visibleContent(seed, "production");
    expect(pub.personas).toHaveLength(0);
    expect(pub.solutions).toHaveLength(0);
    expect(pub.scenes).toHaveLength(0);
    expect(pub.recommendationRules).toHaveLength(0);
  });

  it("shows assumed content in demo mode but hides placeholder assets", () => {
    const pub = visibleContent(seed, "demo");
    expect(pub.solutions).toHaveLength(seed.solutions.length);
    expect(pub.scenes).toHaveLength(8);
    expect(pub.digitalAssets).toHaveLength(0);
    expect(pub.solutions.every((s) => s.digitalAssetIds.length === 0)).toBe(true);
  });

  it("strips internal governance fields before content reaches the client", () => {
    const pub = visibleContent(seed, "demo");
    const serialized = JSON.stringify(pub);
    for (const field of [
      "internalNotes",
      "reviewedBy",
      "sourceLabel",
      "lastReviewedAt",
      "requiresSalesValidation",
    ]) {
      expect(serialized).not.toContain(`"${field}"`);
    }
    expect(serialized).not.toContain("DEMONSTRATIVE ASSUMPTION");
    expect(pub.recommendationRules.every((r) => r.exclusions.every((e) => !("reason" in e)))).toBe(true);
  });

  it("keeps validation status so the UI can show the pending indicator", () => {
    const pub = visibleContent(seed, "demo");
    expect(pub.solutions.every((s) => s.validationStatus === "assumed")).toBe(true);
  });

  it("never shows unavailable content and prunes references to it", () => {
    const b: ContentBundle = clone(seed);
    const hidden = b.solutions.find((s) => s.id === "cryogenic-storage")!;
    Object.assign(hidden, {
      validationStatus: "unavailable",
      reviewedBy: "Sales PR",
      lastReviewedAt: "2026-10-15",
    });
    const pub = visibleContent(b, "demo");
    expect(pub.solutions.map((s) => s.id)).not.toContain("cryogenic-storage");
    expect(pub.recommendationRules.map((r) => r.solutionId)).not.toContain("cryogenic-storage");
    const lab = pub.scenes.find((s) => s.id === "laboratory")!;
    expect(lab.hotspots.map((h) => h.id)).not.toContain("lab-sample-storage");
    for (const r of pub.recommendationRules)
      expect(Object.keys(r.weights.explicitInterests)).not.toContain("cryogenic-storage");
  });

  it("in production shows only validated items and prunes hidden references", () => {
    const b: ContentBundle = clone(seed);
    validate(b.personas.find((p) => p.id === "executive")!);
    validate(b.challenges.find((c) => c.id === "supply-continuity")!);
    validate(b.scenes.find((s) => s.id === "campus")!);
    validate(b.scenes.find((s) => s.id === "gas-plant")!);
    validate(b.solutions.find((s) => s.id === "medical-gas-supply-continuity")!);
    validate(b.recommendationRules.find((r) => r.solutionId === "medical-gas-supply-continuity")!);
    const gasPlant = b.scenes.find((s) => s.id === "gas-plant")!;
    validate(gasPlant.hotspots.find((h) => h.id === "gas-plant-bulk-tank")!);

    const pub = visibleContent(b, "production");
    expect(pub.personas.map((p) => p.id)).toEqual(["executive"]);
    expect(pub.personas[0]!.suggestedChallengeIds).toEqual(["supply-continuity"]);
    expect(pub.scenes.map((s) => s.id).sort()).toEqual(["campus", "gas-plant"]);
    // Campus navigation hotspots are still assumed, so none are visible.
    expect(pub.scenes.find((s) => s.id === "campus")!.hotspots).toEqual([]);
    const tank = pub.scenes.find((s) => s.id === "gas-plant")!.hotspots;
    expect(tank.map((h) => h.id)).toEqual(["gas-plant-bulk-tank"]);
    const bulkTank = tank[0]!;
    expect(bulkTank.type === "solution" && bulkTank.targetSolutionIds).toEqual([
      "medical-gas-supply-continuity",
    ]);
    const [onlyRule] = pub.recommendationRules;
    expect(pub.recommendationRules).toHaveLength(1);
    expect(onlyRule!.weights.personas).toEqual({ executive: 2 });
    expect(onlyRule!.weights.challenges).toEqual({ "supply-continuity": 5 });
    expect(onlyRule!.weights.hotspots).toEqual({ "gas-plant-bulk-tank": 3 });
    expect(pub.solutions[0]!.relatedSceneIds).toEqual(["gas-plant", "campus"]);
  });

  it("hides a scene whose parent is hidden", () => {
    const b: ContentBundle = clone(seed);
    validate(b.scenes.find((s) => s.id === "icu")!);
    const pub = visibleContent(b, "production");
    expect(pub.scenes).toHaveLength(0);
  });
});
