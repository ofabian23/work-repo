import { describe, expect, it } from "vitest";
import { en } from "@/data/i18n/en";
import { es } from "@/data/i18n/es";

/** Every visitor-facing UI string, flattened. */
const strings = (messages: object): string[] =>
  Object.values(messages).flatMap((v) => (typeof v === "string" ? [v] : strings(v as object)));

/**
 * Conversion principles (ADR-051): no pressure language, no claim of a complete assessment, nothing that
 * reads as clinical advice. These patterns must never appear in the UI copy.
 */
const PROHIBITED: [RegExp, string][] = [
  [
    /\búltima oportunidad|no se lo pierda|ahora mismo|date prisa|apúrese|oferta|por tiempo limitado|exclusiv[oa]\b/i,
    "pressure (ES)",
  ],
  [/\blast chance|don't miss|act now|hurry|limited time|exclusive offer|today only\b/i, "pressure (EN)"],
  [/\bgarantiz|\bguarantee/i, "guarantee"],
  [/\bdiagn[oó]stic|\btratamiento\b|\btreatment\b|\bprescri/i, "clinical advice"],
  [
    /\b(evaluación|assessment) (completa|integral|comprehensive)|\bcomprehensive\b|\bintegral\b/i,
    "comprehensiveness claim",
  ],
];

describe("UI copy follows the conversion principles", () => {
  for (const [name, messages] of [
    ["es", es],
    ["en", en],
  ] as const) {
    it(`${name}: no pressure, guarantee, clinical or comprehensiveness language`, () => {
      for (const text of strings(messages)) {
        // The disclaimer negates the claim explicitly ("not a complete assessment"); that is allowed.
        if (text === messages.recommendations.disclaimer) continue;
        for (const [pattern, label] of PROHIBITED) expect(text, `${label}: "${text}"`).not.toMatch(pattern);
      }
    });
  }

  it("the recommendations disclaimer says they are not a complete assessment or clinical advice", () => {
    expect(es.recommendations.disclaimer).toMatch(/no una evaluación completa ni un consejo clínico/);
    expect(en.recommendations.disclaimer).toMatch(/not a complete assessment or clinical advice/);
  });

  it("demo content is labeled as pending validation for Puerto Rico", () => {
    expect(es.recommendations.demoNotice).toMatch(/pendiente de validación para Puerto Rico/);
    expect(en.recommendations.demoNotice).toMatch(/pending validation for Puerto Rico/);
  });
});
