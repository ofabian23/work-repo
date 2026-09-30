import { describe, expect, it } from "vitest";
import {
  ChallengeSchema,
  FacilityTypeSchema,
  HttpsUrlSchema,
  IdSchema,
  LocalizedTextSchema,
  PersonaSchema,
  PublicPathSchema,
  extractPlaceholders,
} from "@/domain/content";
import { challenge, facilityType, persona } from "../../helpers/fixtures";
import { expectInvalid, expectValid } from "../../helpers/schema";

describe("IdSchema", () => {
  it.each(["gas-plant", "icu", "rule-2", "a1"])("accepts kebab-case id %s", (id) => {
    expectValid(IdSchema, id);
  });
  it.each(["Gas-Plant", "gas_plant", "gas--plant", "-gas", "gas-", "gas plant"])("rejects %s", (id) => {
    expectInvalid(IdSchema, id, "", "kebab-case");
  });
  it("rejects ids shorter than two characters", () => {
    expectInvalid(IdSchema, "a", "", "Too small");
  });
});

describe("LocalizedTextSchema", () => {
  it("requires both Spanish and English", () => {
    expectValid(LocalizedTextSchema, { es: "Hola", en: "Hello" });
    expectInvalid(LocalizedTextSchema, { es: "Hola" }, "en");
  });
  it("rejects empty or whitespace-only text", () => {
    expectInvalid(LocalizedTextSchema, { es: "   ", en: "Hello" }, "es", "empty");
  });
  it("rejects additional languages or unknown keys", () => {
    expectInvalid(LocalizedTextSchema, { es: "Hola", en: "Hello", fr: "Bonjour" }, "", "Unrecognized");
  });
  it("trims surrounding whitespace", () => {
    expect(expectValid(LocalizedTextSchema, { es: " Hola ", en: "Hello" }).es).toBe("Hola");
  });
});

describe("paths and URLs", () => {
  it("accepts root-relative public paths", () => {
    expectValid(PublicPathSchema, "/scenes/placeholder/icu-background.svg");
  });
  it.each(["scenes/icu.svg", "//cdn.example.com/x.svg", "/scenes/../secret", "https://x.com/a.svg"])(
    "rejects unsafe public path %s",
    (p) => {
      expect(PublicPathSchema.safeParse(p).success).toBe(false);
    },
  );
  it("only accepts https URLs", () => {
    expectValid(HttpsUrlSchema, "https://example.com/a");
    expectInvalid(HttpsUrlSchema, "http://example.com/a", "", "https");
  });
});

describe("extractPlaceholders", () => {
  it("finds {placeholders} in order", () => {
    expect(extractPlaceholders("Because {challenges} and {scenes}")).toEqual(["challenges", "scenes"]);
    expect(extractPlaceholders("No placeholders")).toEqual([]);
  });
});

describe("taxonomy schemas", () => {
  it("accepts valid persona, challenge and facility type", () => {
    expectValid(PersonaSchema, persona());
    expectValid(ChallengeSchema, challenge());
    expectValid(FacilityTypeSchema, facilityType());
  });
  it("rejects an unknown validation status", () => {
    expectInvalid(PersonaSchema, { ...persona(), validationStatus: "approved" }, "validationStatus");
  });
  it("rejects typos in keys (strict objects)", () => {
    expectInvalid(ChallengeSchema, { ...challenge(), lable: { es: "x", en: "y" } }, "", "Unrecognized key");
  });
  it("rejects non-integer or negative sort order", () => {
    expectInvalid(FacilityTypeSchema, { ...facilityType(), sortOrder: 1.5 }, "sortOrder");
    expectInvalid(FacilityTypeSchema, { ...facilityType(), sortOrder: -1 }, "sortOrder");
  });
  it("rejects a missing translation in a persona label", () => {
    expectInvalid(PersonaSchema, { ...persona(), label: { es: "Alta gerencia" } }, "label.en");
  });
});
