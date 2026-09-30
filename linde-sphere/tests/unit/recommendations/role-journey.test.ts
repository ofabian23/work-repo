import { describe, expect, it } from "vitest";
import { visibleContent } from "@/domain/content";
import { recommend } from "@/domain/recommendations/engine";
import { RecommendationResultSchema } from "@/domain/recommendations/recommendation-result";
import { EMPTY_SIGNALS } from "@/domain/session/visitor-session";
import { loadSeedBundle } from "../../helpers/schema";

const demo = visibleContent(loadSeedBundle(), "demo");

/**
 * "Trabajo en…" journeys for the four roles the convention prioritizes. The engine must explain every
 * recommendation with reasons derived from the visitor's own choices, not only order them by score.
 */
const JOURNEYS = [
  {
    personaId: "operations-facilities",
    label: "Operaciones e instalaciones",
    challengeId: "aging-infrastructure",
    challengeLabel: "Modernizar infraestructura envejecida",
    personaOnlyTop: "infrastructure-assessment",
    withChallenge: ["infrastructure-assessment", "preventive-service-maintenance", "backup-emergency-supply"],
  },
  {
    personaId: "procurement-supply",
    label: "Compras y cadena de suministro",
    challengeId: "cylinder-inventory",
    challengeLabel: "Manejar cilindros e inventario",
    personaOnlyTop: "medical-gas-supply-planning",
    withChallenge: [
      "cylinder-inventory-management",
      "bulk-centralized-supply",
      "medical-gas-supply-planning",
    ],
  },
  {
    personaId: "clinical-respiratory",
    label: "Clínica y terapia respiratoria",
    challengeId: "patient-staff-safety",
    challengeLabel: "Mejorar la seguridad de pacientes y personal",
    personaOnlyTop: "clinical-oxygen-support",
    withChallenge: [
      "clinical-oxygen-support",
      "training-operational-readiness",
      "cylinder-inventory-management",
    ],
  },
  {
    personaId: "executive",
    label: "Alta gerencia",
    challengeId: "supply-continuity",
    challengeLabel: "Mejorar la continuidad del suministro",
    personaOnlyTop: "backup-emergency-supply",
    withChallenge: ["medical-gas-supply-planning", "bulk-centralized-supply", "backup-emergency-supply"],
  },
] as const;

describe.each(JOURNEYS)("role journey: $personaId", (j) => {
  it("produces preliminary recommendations from the role alone, explained by the role", () => {
    const r = RecommendationResultSchema.parse(recommend({ ...EMPTY_SIGNALS, personaId: j.personaId }, demo));
    expect(r.items[0]!.solutionId).toBe(j.personaOnlyTop);
    for (const item of r.items) {
      expect(item.isFallback).toBe(false);
      expect(item.matchedSignals).toContainEqual(
        expect.objectContaining({ signalType: "personas", signalId: j.personaId, kind: "direct" }),
      );
      expect(item.whyThisAppeared.es).toBe(`Aparece porque seleccionó «${j.label}» como su área.`);
      expect(item.whyThisAppeared.en).toMatch(/^This appeared because you selected “.+” as your area\.$/);
    }
  });

  it("adding a role-relevant challenge refines the order and adds it to the reasons", () => {
    const r = RecommendationResultSchema.parse(
      recommend({ ...EMPTY_SIGNALS, personaId: j.personaId, challengeIds: [j.challengeId] }, demo),
    );
    expect(r.items.map((i) => i.solutionId)).toEqual(j.withChallenge);
    const top = r.items[0]!;
    expect(top.whyThisAppeared.es).toContain(`«${j.challengeLabel}»`);
    expect(top.whyThisAppeared.es).toContain(`«${j.label}»`);
    // Reasons are words, never the numeric score.
    expect(top.whyThisAppeared.es).not.toMatch(/\d/);
    expect(top.relevance.es.length).toBeGreaterThan(20);
    expect(top.nextStep.es.length).toBeGreaterThan(10);
  });

  it("is suggested to this role on the challenge step", () => {
    const persona = demo.personas.find((p) => p.id === j.personaId)!;
    expect(persona.suggestedChallengeIds).toContain(j.challengeId);
  });
});
