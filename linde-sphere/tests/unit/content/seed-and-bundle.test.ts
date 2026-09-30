import { mkdtempSync, rmSync, writeFileSync, cpSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { checkContentBundle, type ContentBundle, type ContentIssue } from "@/domain/content";
import { loadContentFromDirectory } from "@/server/content/load-content";
import { CONTENT_DIR, PROJECT_ROOT, clone, loadSeedBundle } from "../../helpers/schema";

const errorsOf = (issues: ContentIssue[]) => issues.filter((i) => i.severity === "error");
const hasError = (bundle: ContentBundle, fragment: string) =>
  errorsOf(checkContentBundle(bundle)).some((i) => i.message.includes(fragment));

describe("seed content", () => {
  const seed = loadSeedBundle();

  it("loads with no errors (warnings about missing placeholder art are allowed)", () => {
    const result = loadContentFromDirectory(CONTENT_DIR, {
      projectRoot: PROJECT_ROOT,
      publicDir: path.join(PROJECT_ROOT, "public"),
    });
    expect(result.issues.filter((i) => i.severity === "error")).toEqual([]);
    for (const w of result.issues) expect(w.message).toMatch(/Placeholder image not found/);
  });

  it("contains the ten initial personas plus the several-areas option", () => {
    expect(seed.personas.map((p) => p.id)).toEqual([
      "executive",
      "operations-facilities",
      "procurement-supply",
      "clinical-respiratory",
      "quality-compliance",
      "finance",
      "technology-biomed",
      "ambulatory-homecare",
      "academia-research",
      "government-system",
      "multiple-areas",
    ]);
    expect(seed.personas.filter((p) => p.scope === "multiple").map((p) => p.id)).toEqual(["multiple-areas"]);
  });

  it("contains the eight initial scenes with the campus as the single root", () => {
    expect(seed.scenes.map((s) => s.id).sort()).toEqual(
      [
        "campus",
        "emergency",
        "gas-plant",
        "icu",
        "laboratory",
        "operating-room",
        "patient-care",
        "utilities",
      ].sort(),
    );
    expect(seed.scenes.filter((s) => s.parentSceneId === null).map((s) => s.id)).toEqual(["campus"]);
  });

  it("includes all three hotspot types", () => {
    const types = new Set(seed.scenes.flatMap((s) => s.hotspots.map((h) => h.type)));
    expect([...types].sort()).toEqual(["information", "navigation", "solution"]);
  });

  it("marks every sample solution as an assumption requiring Puerto Rico sales validation", () => {
    for (const s of seed.solutions) {
      expect(s.validationStatus, s.id).toBe("assumed");
      expect(s.requiresSalesValidation, s.id).toBe(true);
      expect(s.market, s.id).not.toBe("puerto-rico");
      expect(s.internalNotes, s.id).toMatch(/^PENDING PUERTO RICO VALIDATION/);
      expect(s.internalNotes, s.id).toMatch(/requires puerto rico sales validation/i);
      expect(s.salesReview.puertoRicoAvailability, s.id).toBe("requires-verification");
      expect(s.salesReview.decision, s.id).toBe("pending");
      expect(s.salesReview.priorityConfirmedBySales, s.id).toBe(false);
    }
  });

  it("has no validated content yet", () => {
    const statuses = [
      ...seed.personas,
      ...seed.challenges,
      ...seed.scenes,
      ...seed.solutions,
      ...seed.digitalAssets,
      ...seed.recommendationRules,
    ].map((r) => r.validationStatus);
    expect(statuses).not.toContain("validated");
  });

  it("contains the twelve convention challenges in customer language", () => {
    expect(seed.challenges.map((c) => c.label.en)).toEqual([
      "Improve supply continuity",
      "Prepare for emergencies",
      "Modernize aging infrastructure",
      "Support facility expansion",
      "Improve visibility and monitoring",
      "Manage cylinders and inventory",
      "Reduce operational complexity",
      "Improve patient and staff safety",
      "Improve clinical workflow",
      "Strengthen compliance readiness",
      "Control lifecycle costs",
      "Support care outside the hospital",
    ]);
  });

  it("contains the ten assumed solution categories plus the fallback", () => {
    expect(seed.solutions.filter((s) => !s.isFallback).map((s) => s.title.en)).toEqual([
      "Medical gas supply planning",
      "Bulk or centralized supply",
      "Cylinder and inventory management",
      "Backup and emergency supply",
      "Monitoring and telemetry",
      "Medical gas infrastructure assessment",
      "Preventive service and maintenance",
      "Clinical oxygen support",
      "Ambulatory and homecare support",
      "Training and operational readiness",
    ]);
    expect(seed.solutions.filter((s) => s.isFallback).map((s) => s.id)).toEqual(["talk-to-specialist"]);
  });

  it("has exactly one rule for every non-fallback solution", () => {
    const ruled = seed.recommendationRules.map((r) => r.solutionId).sort();
    const expected = seed.solutions
      .filter((s) => !s.isFallback)
      .map((s) => s.id)
      .sort();
    expect(ruled).toEqual(expected);
  });
});

describe("checkContentBundle cross-record rules", () => {
  const seed = loadSeedBundle();

  it("reports no errors for the seed bundle", () => {
    expect(errorsOf(checkContentBundle(seed))).toEqual([]);
  });

  it("detects duplicate ids", () => {
    const b = clone(seed);
    b.challenges.push(clone(b.challenges[0]!));
    expect(hasError(b, "Duplicate id 'supply-continuity'")).toBe(true);
  });

  it("detects duplicate hotspot ids across scenes", () => {
    const b = clone(seed);
    const icu = b.scenes.find((s) => s.id === "icu")!;
    const lab = b.scenes.find((s) => s.id === "laboratory")!;
    lab.hotspots.push(clone(icu.hotspots[0]!));
    expect(hasError(b, "globally unique")).toBe(true);
  });

  it("detects dangling references from hotspots, personas, solutions and rules", () => {
    const b = clone(seed);
    const icu = b.scenes.find((s) => s.id === "icu")!;
    const solutionHotspot = icu.hotspots.find((h) => h.type === "solution");
    if (solutionHotspot?.type === "solution") solutionHotspot.targetSolutionIds = ["ghost-solution"];
    b.personas[0]!.suggestedChallengeIds.push("ghost-challenge");
    b.solutions[0]!.relatedSceneIds.push("ghost-scene");
    b.recommendationRules[0]!.weights.hotspots["ghost-hotspot"] = 2;
    const messages = errorsOf(checkContentBundle(b)).map((i) => i.message);
    expect(messages).toEqual(
      expect.arrayContaining([
        "Unknown solution id 'ghost-solution'",
        "Unknown challenges id 'ghost-challenge'",
        "Unknown scenes id 'ghost-scene'",
        "Unknown hotspots id 'ghost-hotspot'",
      ]),
    );
  });

  it("detects breadcrumb mismatches and cycles", () => {
    const b = clone(seed);
    b.scenes.find((s) => s.id === "icu")!.breadcrumb = ["campus", "laboratory", "icu"];
    expect(hasError(b, "does not match the parent chain")).toBe(true);

    const c = clone(seed);
    const icu = c.scenes.find((s) => s.id === "icu")!;
    const lab = c.scenes.find((s) => s.id === "laboratory")!;
    icu.parentSceneId = "laboratory";
    lab.parentSceneId = "icu";
    expect(hasError(c, "cycle")).toBe(true);
  });

  it("requires exactly one root scene and one fallback solution", () => {
    const b = clone(seed);
    b.scenes.find((s) => s.id === "icu")!.parentSceneId = null;
    b.scenes.find((s) => s.id === "icu")!.breadcrumb = ["icu"];
    expect(hasError(b, "Exactly one root scene")).toBe(true);

    const c = clone(seed);
    c.solutions.forEach((s) => (s.isFallback = false));
    expect(hasError(c, "Exactly one fallback")).toBe(true);
  });

  it("detects unreachable minimum thresholds", () => {
    const b = clone(seed);
    b.recommendationRules[0]!.minimumScore = 99;
    expect(hasError(b, "is unreachable")).toBe(true);
  });

  it("rejects multiple rules for one solution and a rule on the fallback", () => {
    const b = clone(seed);
    b.recommendationRules.push({ ...clone(b.recommendationRules[0]!), id: "rule-duplicate" });
    expect(hasError(b, "exactly one is allowed")).toBe(true);

    const c = clone(seed);
    c.recommendationRules[0]!.solutionId = "talk-to-specialist";
    expect(hasError(c, "must not have a rule")).toBe(true);
  });

  it("flags prohibited claims such as metrics, savings and guarantees", () => {
    const b = clone(seed);
    b.solutions[0]!.summary.en = "Guaranteed 30% savings on supply costs.";
    const messages = errorsOf(checkContentBundle(b)).map((i) => i.message);
    expect(messages.some((m) => m.includes("percentage figure"))).toBe(true);
    expect(messages.some((m) => m.includes("guarantee"))).toBe(true);
    expect(messages.some((m) => m.includes("savings claim"))).toBe(true);
  });

  it.each([
    ["Disponible en Puerto Rico desde 2026.", "local availability claim"],
    ["Designed to meet NFPA 99 requirements.", "regulatory or standards reference"],
    ["Reduce los costos de operación.", "cost-reduction claim"],
    ["Lowers costs across the campus.", "cost-reduction claim"],
    ["Monitoring 24/7 with full uptime.", "performance claim"],
    ["Sistema OxyMax™ incluido.", "product or trademark marking"],
    ["El proveedor líder del mercado.", "superlative claim"],
  ])("flags unsupported claims: %s", (text, label) => {
    const b = clone(seed);
    b.solutions[0]!.summary.es = text;
    const messages = errorsOf(checkContentBundle(b)).map((i) => i.message);
    expect(messages.some((m) => m.includes(label))).toBe(true);
  });

  it("does not flag the customer-language challenge list", () => {
    const flagged = errorsOf(checkContentBundle(seed)).filter((i) => i.collection === "challenges");
    expect(flagged).toEqual([]);
  });

  it("warns (not errors) when translations look missing", () => {
    const b = clone(seed);
    b.challenges[0]!.description = { es: "Same untranslated text", en: "Same untranslated text" };
    const issues = checkContentBundle(b).filter((i) => i.message.includes("identical"));
    expect(issues).toHaveLength(1);
    expect(issues[0]!.severity).toBe("warning");
  });
});

describe("loadContentFromDirectory", () => {
  let dir: string | undefined;
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
    dir = undefined;
  });

  const copySeed = () => {
    dir = mkdtempSync(path.join(os.tmpdir(), "linde-content-"));
    const contentDir = path.join(dir, "content");
    cpSync(CONTENT_DIR, contentDir, { recursive: true });
    return contentDir;
  };

  it("reports invalid JSON with the file name", () => {
    const contentDir = copySeed();
    writeFileSync(path.join(contentDir, "personas.json"), "{ not json");
    const result = loadContentFromDirectory(contentDir);
    expect(result.bundle).toBeNull();
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        severity: "error",
        file: "content/personas.json",
        message: expect.stringContaining("Invalid JSON"),
      }),
    );
  });

  it("reports a missing file", () => {
    const contentDir = copySeed();
    rmSync(path.join(contentDir, "solutions.json"));
    const result = loadContentFromDirectory(contentDir);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ file: "content/solutions.json", message: "File not found" }),
    );
  });

  it("points schema errors at the exact scene file and field", () => {
    const contentDir = copySeed();
    const file = path.join(contentDir, "scenes", "icu.json");
    const sceneJson = JSON.parse(JSON.stringify(loadSeedBundle().scenes.find((s) => s.id === "icu")));
    sceneJson.hotspots[0].x = 140;
    writeFileSync(file, JSON.stringify(sceneJson));
    const result = loadContentFromDirectory(contentDir);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ file: "content/scenes/icu.json", path: "hotspots[0].x" }),
    );
  });

  it("prefixes array-file errors with the record id", () => {
    const contentDir = copySeed();
    const solutions = loadSeedBundle().solutions.map((s) => ({ ...s }));
    solutions[1]!.market = "mars" as never;
    writeFileSync(path.join(contentDir, "solutions.json"), JSON.stringify(solutions));
    const result = loadContentFromDirectory(contentDir);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        path: "[1].market",
        message: expect.stringMatching(/^bulk-centralized-supply: /),
      }),
    );
  });

  it("requires scene file names to match scene ids", () => {
    const contentDir = copySeed();
    cpSync(path.join(contentDir, "scenes", "icu.json"), path.join(contentDir, "scenes", "icu-copy.json"));
    const result = loadContentFromDirectory(contentDir);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        file: "content/scenes/icu-copy.json",
        message: expect.stringContaining("must match its file name"),
      }),
    );
  });
});
