import { describe, expect, it } from "vitest";
import {
  buildSalesValidationRows,
  SALES_VALIDATION_COLUMNS,
  salesValidationTable,
  summarizeSalesValidation,
} from "@/domain/review/sales-validation";
import { toCsv } from "@/lib/csv";
import { approveForProduction } from "../../helpers/fixtures";
import { clone, loadSeedBundle } from "../../helpers/schema";

const seed = loadSeedBundle();
const rows = buildSalesValidationRows(seed);
const row = (type: string, id: string) => rows.find((r) => r.recordType === type && r.id === id)!;

describe("sales-validation worksheet (ADR-060)", () => {
  it("has one row for every persona, challenge, solution and digital asset, in that order", () => {
    expect(rows).toHaveLength(
      seed.personas.length + seed.challenges.length + seed.solutions.length + seed.digitalAssets.length,
    );
    const order = [...new Set(rows.map((r) => r.recordType))];
    expect(order).toEqual(["persona", "challenge", "solution", "digital-asset"]);
  });

  it("the CSV has a column for each of the 16 requested fields, plus type and id", () => {
    const header = salesValidationTable(rows)[0]!;
    expect(header).toEqual([...SALES_VALIDATION_COLUMNS]);
    for (const field of [
      "current_name",
      "spanish_name",
      "english_name",
      "current_description",
      "market_status",
      "validation_status",
      "intended_personas",
      "intended_challenges",
      "intended_healthcare_areas",
      "recommendation_priority",
      "available_in_puerto_rico",
      "decision (keep/remove/rename)",
      "required_correction",
      "missing_digital_material",
      "sales_owner",
      "approval_status",
    ]) {
      expect(
        header.some((h) => h.startsWith(field)),
        field,
      ).toBe(true);
    }
    expect(header).toHaveLength(18);
  });

  it("derives intended personas, challenges and areas from the rules and relations", () => {
    const solution = seed.solutions.find((s) => !s.isFallback)!;
    const rule = seed.recommendationRules.find((r) => r.solutionId === solution.id)!;
    const r = row("solution", solution.id);
    for (const personaId of Object.keys(rule.weights.personas)) {
      expect(r.intendedPersonas).toContain(seed.personas.find((p) => p.id === personaId)!.label.es);
    }
    for (const challengeId of solution.relatedChallengeIds) {
      expect(r.intendedChallenges).toContain(seed.challenges.find((c) => c.id === challengeId)!.label.es);
    }
    for (const sceneId of solution.relatedSceneIds) {
      expect(r.intendedHealthcareAreas).toContain(seed.scenes.find((s) => s.id === sceneId)!.title.es);
    }
    const persona = seed.personas[0]!;
    expect(row("persona", persona.id).intendedChallenges).toEqual(
      persona.suggestedChallengeIds.map((id) => seed.challenges.find((c) => c.id === id)!.label.es),
    );
    const c = seed.challenges.find((x) => seed.personas.some((p) => p.suggestedChallengeIds.includes(x.id)))!;
    expect(row("challenge", c.id).intendedPersonas.length).toBeGreaterThan(0);
    expect(rows.every((x) => x.intendedHealthcareAreas.every((a) => a.length > 0))).toBe(true);
  });

  it("flags missing digital material and nothing as production-ready in the seed", () => {
    const withoutAsset = rows.filter((r) => r.recordType === "solution" && r.id !== "talk-to-specialist");
    expect(withoutAsset.every((r) => r.missingDigitalMaterial.includes("No approved"))).toBe(true);
    expect(
      rows.filter((r) => r.recordType === "digital-asset").every((r) => r.missingDigitalMaterial !== ""),
    ).toBe(true);
    expect(rows.every((r) => !r.productionReady && r.approvalStatus === "not-started")).toBe(true);
    expect(rows.every((r) => r.availableInPuertoRico === "unknown" && r.decision === "pending")).toBe(true);
  });

  it("shows the proposed local name in the Spanish and English name columns", () => {
    const b = clone(seed);
    b.solutions[0]!.salesReview = {
      ...b.solutions[0]!.salesReview,
      decision: "rename",
      proposedName: { es: "Nombre local PR", en: "PR local name" },
    };
    const r = buildSalesValidationRows(b).find((x) => x.id === b.solutions[0]!.id)!;
    expect([r.spanishName, r.englishName]).toEqual(["Nombre local PR", "PR local name"]);
    expect(r.currentName.es).toBe(b.solutions[0]!.title.es);
  });

  it("counts approvals and production-ready items", () => {
    const b = clone(seed);
    approveForProduction(b.solutions[0]!);
    approveForProduction(b.personas[0]!);
    const summary = summarizeSalesValidation(buildSalesValidationRows(b));
    expect(summary.total).toBe(rows.length);
    expect(summary.productionReady).toBe(2);
    expect(summary.byApproval.approved).toBe(2);
    expect(summary.byType.solution).toEqual({ total: seed.solutions.length, approved: 1 });
  });

  it("the CSV is formula-safe and has no visitor data columns", () => {
    const b = clone(seed);
    b.personas[0]!.salesReview.requiredCorrection = '=HYPERLINK("http://x")';
    const csv = toCsv(salesValidationTable(buildSalesValidationRows(b)));
    expect(csv).toContain(`"'=HYPERLINK(""http://x"")"`);
    const header = csv.split("\r\n")[0]!;
    expect(header).not.toMatch(/email|phone|first_name|last_name|organization/i);
  });
});
