import { describe, it } from "vitest";
import { RecommendationResultSchema } from "@/domain/recommendations/recommendation-result";
import { SessionSignalsSchema, VisitorSessionSchema } from "@/domain/session/visitor-session";
import { SESSION_ID, localized, signals } from "../../helpers/fixtures";
import { expectInvalid, expectValid } from "../../helpers/schema";

const session = () => ({
  id: SESSION_ID,
  startedAt: "2026-10-20T14:00:00Z",
  endedAt: null,
  language: "es",
  entryPath: "role",
  contentMode: "demo",
  contentVersion: "0.1.0",
  outcome: "in-progress",
  signals: signals(),
});

describe("SessionSignalsSchema", () => {
  it("accepts valid signals", () => {
    expectValid(SessionSignalsSchema, signals());
  });
  it("allows at most three challenges", () => {
    expectInvalid(
      SessionSignalsSchema,
      { ...signals(), challengeIds: ["a1", "b1", "c1", "d1"] },
      "challengeIds",
    );
  });
  it("rejects duplicate ids", () => {
    expectInvalid(
      SessionSignalsSchema,
      { ...signals(), visitedSceneIds: ["icu", "icu"] },
      "visitedSceneIds",
      "unique",
    );
  });
  it("requires engaged hotspots to be opened hotspots", () => {
    expectInvalid(
      SessionSignalsSchema,
      { ...signals(), engagedHotspotIds: ["other-hotspot"] },
      "engagedHotspotIds[0]",
    );
  });
  it("rejects personal data smuggled into signals", () => {
    expectInvalid(SessionSignalsSchema, { ...signals(), email: "a@b.co" }, "", "Unrecognized");
  });
});

describe("VisitorSessionSchema", () => {
  it("accepts an in-progress session", () => {
    expectValid(VisitorSessionSchema, session());
  });
  it("accepts a completed session", () => {
    expectValid(VisitorSessionSchema, {
      ...session(),
      outcome: "completed",
      endedAt: "2026-10-20T14:03:10Z",
    });
  });
  it("requires a UUID id", () => {
    expectInvalid(VisitorSessionSchema, { ...session(), id: "abc" }, "id");
  });
  it("requires endedAt for finished sessions and forbids it for in-progress ones", () => {
    expectInvalid(VisitorSessionSchema, { ...session(), outcome: "timeout" }, "endedAt", "required");
    expectInvalid(
      VisitorSessionSchema,
      { ...session(), endedAt: "2026-10-20T14:03:10Z" },
      "endedAt",
      "in-progress",
    );
  });
  it("rejects endedAt before startedAt", () => {
    expectInvalid(
      VisitorSessionSchema,
      { ...session(), outcome: "completed", endedAt: "2026-10-20T13:00:00Z" },
      "endedAt",
      "before",
    );
  });
  it("rejects an unsupported language", () => {
    expectInvalid(VisitorSessionSchema, { ...session(), language: "fr" }, "language");
  });
});

const item = (rank = 1, solutionId = "clinical-gases") => ({
  solutionId,
  ruleId: `rule-${solutionId}`,
  rank,
  score: 9,
  matchedSignals: [{ signalType: "challenges", signalId: "supply-continuity", kind: "direct", weight: 5 }],
  whyThisAppeared: localized(
    "Aparece porque eligió «Mejorar la continuidad del suministro».",
    "This appeared because you chose “Improve supply continuity”.",
  ),
  relevance: localized("Puede ser útil cuando cambia la demanda.", "Can be useful when demand changes."),
  relatedSceneIds: ["icu"],
  digitalAssetIds: [],
  nextStep: localized("Hable con un especialista.", "Talk to a specialist."),
  pendingValidation: true,
  isFallback: false,
});

const fallbackItem = () => ({
  ...item(),
  solutionId: "talk-to-specialist",
  ruleId: null,
  score: 0,
  matchedSignals: [],
  isFallback: true,
});

const result = () => ({
  engineVersion: "1.0.0",
  contentVersion: "0.1.0",
  contentMode: "demo",
  items: [item(1), item(2, "supply-monitoring")],
});

describe("RecommendationResultSchema", () => {
  it("accepts a ranked demo result", () => {
    expectValid(RecommendationResultSchema, result());
  });
  it("accepts a fallback-only result", () => {
    expectValid(RecommendationResultSchema, { ...result(), items: [fallbackItem()] });
  });
  it("requires ranks to be sequential from 1", () => {
    expectInvalid(
      RecommendationResultSchema,
      { ...result(), items: [item(1), item(3, "supply-monitoring")] },
      "items[1].rank",
    );
  });
  it("rejects duplicate solutions", () => {
    expectInvalid(
      RecommendationResultSchema,
      { ...result(), items: [item(1), item(2)] },
      "items",
      "only once",
    );
  });
  it("never allows content pending validation in production mode", () => {
    expectInvalid(
      RecommendationResultSchema,
      { ...result(), contentMode: "production" },
      "items[0].pendingValidation",
    );
  });
  it("uses the fallback only on its own", () => {
    expectInvalid(
      RecommendationResultSchema,
      { ...result(), items: [item(1), { ...fallbackItem(), rank: 2 }] },
      "items",
      "on its own",
    );
  });
  it("requires every rule-based item to be explained by matched signals", () => {
    expectInvalid(
      RecommendationResultSchema,
      { ...result(), items: [{ ...item(), matchedSignals: [] }] },
      "items[0].matchedSignals",
    );
  });
  it("requires ruleId for rule-based items and forbids it for the fallback", () => {
    expectInvalid(
      RecommendationResultSchema,
      { ...result(), items: [{ ...item(), ruleId: null }] },
      "items[0].ruleId",
    );
    expectInvalid(
      RecommendationResultSchema,
      { ...result(), items: [{ ...fallbackItem(), ruleId: "rule-x" }] },
      "items[0].ruleId",
    );
  });
  it("requires at least one and at most five items", () => {
    expectInvalid(RecommendationResultSchema, { ...result(), items: [] }, "items");
    const six = ["a1", "b1", "c1", "d1", "e1", "f1"].map((id, i) => item(i + 1, id));
    expectInvalid(RecommendationResultSchema, { ...result(), items: six }, "items");
  });
});
