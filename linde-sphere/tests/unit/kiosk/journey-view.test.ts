import { describe, expect, it } from "vitest";
import { visibleContent } from "@/domain/content";
import { recommend } from "@/domain/recommendations/engine";
import { EMPTY_SIGNALS } from "@/domain/session/visitor-session";
import {
  MAX_RELEVANT_AREAS,
  MAX_SUGGESTED_CHALLENGES,
  relevantSceneIds,
  splitPersonas,
  suggestedChallengeIds,
} from "@/features/kiosk/journey/journey-view";
import { loadSeedBundle } from "../../helpers/schema";

const demo = visibleContent(loadSeedBundle(), "demo");
const persona = (id: string) => demo.personas.find((p) => p.id === id)!;

describe("persona list", () => {
  it("keeps the several-areas option apart from the professional areas", () => {
    const { single, multiple } = splitPersonas(demo.personas);
    expect(single).toHaveLength(10);
    expect(single.every((p) => p.scope === "single")).toBe(true);
    expect(multiple?.id).toBe("multiple-areas");
  });

  it("every persona has a plain-language label and a concise explanation in both languages", () => {
    for (const p of demo.personas) {
      for (const language of ["es", "en"] as const) {
        expect(p.label[language].length).toBeLessThanOrEqual(50);
        expect(p.label[language]).not.toMatch(/[_/]|\b[A-Z]{3,}\b/); // no ids, slashes or jargon acronyms
        expect(p.description[language].length).toBeLessThanOrEqual(60); // about two lines on a card
      }
    }
  });
});

describe("role-relevant challenges", () => {
  it.each(demo.personas.map((p) => [p.id]))("%s gets a small, quick-to-scan set", (id) => {
    const ids = suggestedChallengeIds(persona(id), [], demo);
    expect(ids.length).toBeGreaterThan(0);
    expect(ids.length).toBeLessThanOrEqual(MAX_SUGGESTED_CHALLENGES);
    expect(ids).toEqual(persona(id).suggestedChallengeIds.slice(0, MAX_SUGGESTED_CHALLENGES));
  });

  it("keeps challenges the visitor already chose elsewhere visible", () => {
    const ids = suggestedChallengeIds(persona("finance"), ["visibility-monitoring"], demo);
    expect(ids).toContain("visibility-monitoring");
  });
});

describe("relevant areas", () => {
  it("come from the recommendations, without the campus, and are capped", () => {
    const result = recommend({ ...EMPTY_SIGNALS, personaId: "procurement-supply" }, demo);
    const ids = relevantSceneIds(result, demo);
    expect(ids).not.toContain("campus");
    expect(ids.length).toBeGreaterThan(0);
    expect(ids.length).toBeLessThanOrEqual(MAX_RELEVANT_AREAS);
    expect(ids[0]).toBe("gas-plant");
  });

  it("are empty when there are no recommendations", () => {
    expect(relevantSceneIds(null, demo)).toEqual([]);
  });
});
