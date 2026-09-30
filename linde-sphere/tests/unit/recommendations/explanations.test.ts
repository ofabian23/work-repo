import { describe, expect, it } from "vitest";
import { visibleContent } from "@/domain/content";
import { recommend } from "@/domain/recommendations/engine";
import { FALLBACK_WHY, buildWhyThisAppeared, type LabelIndex } from "@/domain/recommendations/explanations";
import type { MatchedSignal } from "@/domain/recommendations/recommendation-result";
import { EMPTY_SIGNALS } from "@/domain/session/visitor-session";
import { loadSeedBundle } from "../../helpers/schema";

const L = (es: string, en = es) => ({ es, en });
const idx: LabelIndex = {
  personas: new Map([["finance", L("Finanzas", "Finance")]]),
  challenges: new Map([
    ["a", L("Reto A", "Challenge A")],
    ["b", L("Reto B", "Challenge B")],
    ["c", L("Reto C", "Challenge C")],
  ]),
  facilityTypes: new Map([["acute", L("Hospital general", "General hospital")]]),
  scenes: new Map([["icu", L("UCI", "ICU")]]),
  hotspotLabels: new Map([["h", L("Tanque", "Tank")]]),
  solutions: new Map([["s", L("Solución", "Solution")]]),
};
const m = (
  signalType: MatchedSignal["signalType"],
  signalId: string,
  weight: number,
  kind: MatchedSignal["kind"] = "direct",
) => ({ signalType, signalId, weight, kind }) as MatchedSignal;

describe("explanation generation (“Why this appeared”)", () => {
  it("writes one reason as a single sentence, quoting labels in each language's style", () => {
    expect(buildWhyThisAppeared([m("personas", "finance", 3)], idx)).toEqual({
      es: "Aparece porque seleccionó «Finanzas» como su área.",
      en: "This appeared because you selected “Finance” as your area.",
    });
  });

  it("lists several reasons after a colon, strongest first", () => {
    const why = buildWhyThisAppeared(
      [m("personas", "finance", 3), m("challenges", "a", 5), m("scenes", "icu", 1)],
      idx,
    );
    expect(why.es).toBe(
      "Aparece porque: eligió «Reto A»; seleccionó «Finanzas» como su área; exploró «UCI».",
    );
    expect(why.en).toBe(
      "This appeared because: you chose “Challenge A”; you selected “Finance” as your area; you explored “ICU”.",
    );
  });

  it("joins up to two labels per reason and keeps at most three reasons", () => {
    const why = buildWhyThisAppeared(
      [
        m("challenges", "a", 5),
        m("challenges", "b", 4),
        m("challenges", "c", 1),
        m("personas", "finance", 3),
        m("hotspots", "h", 2),
        m("facilityTypes", "acute", 1),
      ],
      idx,
    );
    expect(why.es).toBe(
      "Aparece porque: eligió «Reto A» y «Reto B»; seleccionó «Finanzas» como su área; abrió «Tanque».",
    );
    expect(why.es).not.toContain("Reto C");
    expect(why.es).not.toContain("Hospital general");
  });

  it("phrases implied challenges as related to exploration, never as the visitor's choice", () => {
    const why = buildWhyThisAppeared([m("challenges", "a", 2, "implied-challenge")], idx);
    expect(why.es).toBe("Aparece porque lo que exploró se relaciona con «Reto A».");
    expect(why.en).not.toContain("you chose");
  });

  it("describes an explicit interest and an organization type plainly", () => {
    expect(buildWhyThisAppeared([m("explicitInterests", "s", 6)], idx).es).toBe(
      "Aparece porque lo marcó como interés.",
    );
    expect(buildWhyThisAppeared([m("facilityTypes", "acute", 1)], idx).en).toBe(
      "This appeared because your organization is “General hospital”.",
    );
  });

  it("never mentions scores, weights or percentages", () => {
    const why = buildWhyThisAppeared([m("challenges", "a", 7), m("hotspots", "h", 3, "engaged-bonus")], idx);
    expect(`${why.es} ${why.en}`).not.toMatch(/\d|%/);
  });

  it("is deterministic when two reasons weigh the same (explicit choices first)", () => {
    const one = buildWhyThisAppeared([m("scenes", "icu", 2), m("challenges", "a", 2)], idx);
    const two = buildWhyThisAppeared([m("challenges", "a", 2), m("scenes", "icu", 2)], idx);
    expect(one).toEqual(two);
    expect(one.en).toBe("This appeared because: you chose “Challenge A”; you explored “ICU”.");
  });

  it("the fallback explains honestly that no specific match was found", () => {
    const r = recommend(EMPTY_SIGNALS, visibleContent(loadSeedBundle(), "demo"))!;
    expect(r.items[0]!.whyThisAppeared).toEqual(FALLBACK_WHY);
    expect(r.items[0]!.relevanceLevel).toBe("possible");
  });
});
