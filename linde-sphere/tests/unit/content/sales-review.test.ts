import { describe, it } from "vitest";
import { ChallengeSchema, DigitalAssetSchema, PersonaSchema, SolutionSchema } from "@/domain/content";
import { SalesReviewSchema } from "@/domain/content/sales-review";
import {
  challenge,
  confirmedReview,
  digitalAsset,
  pendingReview,
  persona,
  solution,
  validatedGovernance,
} from "../../helpers/fixtures";
import { expectInvalid, expectValid } from "../../helpers/schema";

/** Sales-validation worksheet rules (ADR-060, CONTENT_VALIDATION.md §9). */
describe("SalesReviewSchema", () => {
  it("accepts an unanswered worksheet and an approved one", () => {
    expectValid(SalesReviewSchema, pendingReview());
    expectValid(SalesReviewSchema, confirmedReview());
  });

  it.each([
    [{ decision: "pending" }, "decision"],
    [{ salesOwner: null }, "salesOwner"],
    [{ availableInPuertoRico: "unknown" }, "availableInPuertoRico"],
    [{ requiredCorrection: "Cambiar el nombre a la versión local" }, "requiredCorrection"],
  ])("an approval needs complete answers: %j is rejected", (change, path) => {
    expectInvalid(SalesReviewSchema, { ...confirmedReview(), ...change }, path);
  });

  it("only accepts yes, no or unknown for Puerto Rico availability", () => {
    expectInvalid(
      SalesReviewSchema,
      { ...pendingReview(), availableInPuertoRico: "maybe" },
      "availableInPuertoRico",
    );
    expectInvalid(
      SalesReviewSchema,
      { ...pendingReview(), availableInPuertoRico: "requires-verification" },
      "availableInPuertoRico",
    );
  });

  it("requires a proposed name exactly when renaming", () => {
    expectInvalid(SalesReviewSchema, { ...pendingReview(), decision: "rename" }, "proposedName");
    expectInvalid(
      SalesReviewSchema,
      { ...pendingReview(), proposedName: { es: "A", en: "B" } },
      "proposedName",
    );
  });
});

const TYPES = [
  { name: "persona", schema: PersonaSchema, make: persona, nameField: "label", offering: false },
  { name: "challenge", schema: ChallengeSchema, make: challenge, nameField: "label", offering: false },
  {
    name: "solution",
    schema: SolutionSchema,
    make: solution,
    nameField: "title",
    offering: true,
  },
  {
    name: "digital asset",
    schema: DigitalAssetSchema,
    make: () => ({ ...digitalAsset(), validationStatus: "assumed" }),
    nameField: "title",
    offering: true,
  },
] as const;

/** A validated record of the given type (governance filled in where the type has it). */
const validated = (t: (typeof TYPES)[number], review: Record<string, unknown>) => ({
  ...t.make(),
  ...(t.offering ? validatedGovernance() : {}),
  ...(t.name === "digital asset" ? { access: { kind: "local-file", path: "/resources/overview.pdf" } } : {}),
  validationStatus: "validated",
  salesReview: review,
});

describe.each(TYPES)("$name: worksheet and validation status agree", (t) => {
  it("an unapproved item cannot be validated", () => {
    expectInvalid(t.schema, validated(t, pendingReview()), "salesReview.approvalStatus");
    expectInvalid(
      t.schema,
      validated(t, { ...confirmedReview(), approvalStatus: "changes-requested" }),
      "salesReview.approvalStatus",
    );
    expectValid(t.schema, validated(t, confirmedReview()));
  });

  it("an approved item must be validated (the approval is not left unapplied)", () => {
    expectInvalid(t.schema, { ...t.make(), salesReview: confirmedReview() }, "validationStatus");
  });

  it("not in Puerto Rico, or removed, means unavailable", () => {
    expectInvalid(
      t.schema,
      { ...t.make(), salesReview: { ...pendingReview(), availableInPuertoRico: "no" } },
      "validationStatus",
    );
    expectInvalid(
      t.schema,
      { ...t.make(), salesReview: { ...pendingReview(), decision: "remove" } },
      "validationStatus",
    );
  });

  it("a validated rename shows the approved local name", () => {
    const renamed = {
      ...confirmedReview(),
      decision: "rename",
      proposedName: { es: "Nombre local", en: "Local name" },
    };
    expectInvalid(t.schema, validated(t, renamed), t.nameField);
    expectValid(t.schema, {
      ...validated(t, renamed),
      [t.nameField]: { es: "Nombre local", en: "Local name" },
    });
  });

  if (t.offering) {
    it("a validated offering must be available in Puerto Rico", () => {
      expectInvalid(
        t.schema,
        validated(t, { ...confirmedReview(), availableInPuertoRico: "no" }),
        "salesReview.availableInPuertoRico",
      );
    });
  }
});
