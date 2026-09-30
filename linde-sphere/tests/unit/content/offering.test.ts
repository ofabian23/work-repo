import { describe, it } from "vitest";
import { DigitalAssetSchema, SolutionSchema } from "@/domain/content";
import { confirmedReview, digitalAsset, solution, validatedGovernance } from "../../helpers/fixtures";
import { expectInvalid, expectValid } from "../../helpers/schema";

describe("SolutionSchema", () => {
  it("accepts an assumed solution flagged for sales validation", () => {
    expectValid(SolutionSchema, solution());
  });

  it("accepts a validated Puerto Rico solution with review metadata", () => {
    expectValid(SolutionSchema, { ...solution(), ...validatedGovernance(), salesReview: confirmedReview() });
  });

  it("requires every governance field", () => {
    for (const field of [
      "validationStatus",
      "market",
      "internalNotes",
      "lastReviewedAt",
      "reviewedBy",
      "sourceLabel",
    ]) {
      const value: Record<string, unknown> = solution();
      delete value[field];
      expectInvalid(SolutionSchema, value, field);
    }
  });

  it("rejects an unknown market", () => {
    expectInvalid(SolutionSchema, { ...solution(), market: "mexico" }, "market");
  });

  it("requires reviewer and review date when validated", () => {
    const value = { ...solution(), ...validatedGovernance(), reviewedBy: null, lastReviewedAt: null };
    expectInvalid(SolutionSchema, value, "reviewedBy", "required");
    expectInvalid(SolutionSchema, value, "lastReviewedAt", "required");
  });

  it("requires reviewer when marked unavailable", () => {
    expectInvalid(SolutionSchema, { ...solution(), validationStatus: "unavailable" }, "reviewedBy");
  });

  it("never treats non-Puerto Rico content as validated", () => {
    expectInvalid(
      SolutionSchema,
      { ...solution(), ...validatedGovernance(), market: "united-states-reference" },
      "market",
      "puerto-rico",
    );
  });

  it("requires assumed content to be flagged as requiring sales validation", () => {
    expectInvalid(
      SolutionSchema,
      { ...solution(), requiresSalesValidation: false },
      "requiresSalesValidation",
    );
  });

  it("rejects validated content that still requires sales validation", () => {
    expectInvalid(
      SolutionSchema,
      { ...solution(), ...validatedGovernance(), requiresSalesValidation: true },
      "requiresSalesValidation",
    );
  });

  it("rejects a malformed review date", () => {
    expectInvalid(
      SolutionSchema,
      { ...solution(), ...validatedGovernance(), lastReviewedAt: "15/10/2026" },
      "lastReviewedAt",
    );
  });
});

describe("Solution sales review", () => {
  const review = (overrides: Record<string, unknown>) => ({ ...solution().salesReview, ...overrides });

  it("requires a proposed name only when renaming", () => {
    expectInvalid(
      SolutionSchema,
      { ...solution(), salesReview: review({ decision: "rename" }) },
      "salesReview.proposedName",
    );
    expectValid(SolutionSchema, {
      ...solution(),
      salesReview: review({ decision: "rename", proposedName: { es: "Nuevo", en: "New" } }),
    });
    expectInvalid(
      SolutionSchema,
      { ...solution(), salesReview: review({ proposedName: { es: "Nuevo", en: "New" } }) },
      "salesReview.proposedName",
    );
  });

  it("requires unavailable status when sales marks a solution not available or removed", () => {
    expectInvalid(
      SolutionSchema,
      { ...solution(), salesReview: review({ puertoRicoAvailability: "not-available" }) },
      "validationStatus",
      "not available",
    );
    expectInvalid(
      SolutionSchema,
      { ...solution(), salesReview: review({ decision: "remove" }) },
      "validationStatus",
      "removed",
    );
    expectValid(SolutionSchema, {
      ...solution(),
      validationStatus: "unavailable",
      reviewedBy: "Sales PR",
      lastReviewedAt: "2026-10-15",
      salesReview: review({ decision: "remove", puertoRicoAvailability: "not-available" }),
    });
  });

  it("requires validated solutions to be available and kept", () => {
    expectInvalid(
      SolutionSchema,
      { ...solution(), ...validatedGovernance(), salesReview: review({ decision: "keep" }) },
      "salesReview.puertoRicoAvailability",
    );
    expectInvalid(
      SolutionSchema,
      {
        ...solution(),
        ...validatedGovernance(),
        salesReview: review({ puertoRicoAvailability: "available" }),
      },
      "salesReview.decision",
    );
  });

  it("rejects a confirmed but unset convention priority", () => {
    expectInvalid(
      SolutionSchema,
      { ...solution(), salesReview: review({ priorityConfirmedBySales: true }) },
      "salesReview.conventionPriority",
    );
  });
});

describe("DigitalAssetSchema", () => {
  it("accepts a placeholder asset", () => {
    expectValid(DigitalAssetSchema, digitalAsset());
  });

  it("accepts a validated asset served from a local file", () => {
    expectValid(DigitalAssetSchema, {
      ...digitalAsset(),
      ...validatedGovernance(),
      access: { kind: "local-file", path: "/resources/overview.pdf" },
    });
  });

  it("rejects non-https URLs", () => {
    expectInvalid(
      DigitalAssetSchema,
      { ...digitalAsset(), access: { kind: "url", url: "http://example.com/a" } },
      "access.url",
    );
  });

  it("rejects a validated asset still pointing to a reserved example domain", () => {
    expectInvalid(
      DigitalAssetSchema,
      { ...digitalAsset(), ...validatedGovernance() },
      "access.url",
      "example",
    );
  });

  it("rejects duplicate or missing languages", () => {
    expectInvalid(DigitalAssetSchema, { ...digitalAsset(), languages: ["es", "es"] }, "languages", "unique");
    expectInvalid(DigitalAssetSchema, { ...digitalAsset(), languages: [] }, "languages");
  });

  it("rejects an unknown asset type", () => {
    expectInvalid(DigitalAssetSchema, { ...digitalAsset(), type: "podcast" }, "type");
  });
});
