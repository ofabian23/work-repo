import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  LEAD_SCORING,
  LEAD_SCORING_VERSION,
  scoreLead,
  type LeadScoreInput,
} from "@/server/leads/lead-scoring";
import { handleCreateLead } from "@/server/leads/lead-http";
import {
  createTestDatabase,
  createTestLeadService,
  validLead,
  type TestDatabase,
} from "../../helpers/test-database";

/** Internal lead score (PROJECT_BRIEF M12, AC-16, AC-34): server-only, admin and CSV only. */
const base: LeadScoreInput = {
  roleId: "procurement-supply",
  challengeCount: 1,
  explicitInterestCount: 0,
  meaningfulHotspots: 0,
  facilityTypeKnown: false,
  followUpConsent: false,
  email: "ana@hospital.example",
};

describe("lead scoring rules", () => {
  it("is deterministic and explains every point", () => {
    const a = scoreLead(base);
    expect(scoreLead(base)).toEqual(a);
    expect(a.score).toBe(a.factors.reduce((s, f) => s + f.points, 0));
    expect(a.version).toBe(LEAD_SCORING_VERSION);
    expect(a.factors.map((f) => f.code)).toEqual(["role:procurement-supply", "challenges"]);
  });

  it("caps each factor and keeps the score between 0 and 100", () => {
    const max = scoreLead({
      ...base,
      roleId: "executive",
      challengeCount: 50,
      explicitInterestCount: 50,
      meaningfulHotspots: 500,
      facilityTypeKnown: true,
      followUpConsent: true,
    });
    const byCode = Object.fromEntries(max.factors.map((f) => [f.code, f.points]));
    expect(byCode.challenges).toBe(LEAD_SCORING.maxChallenges);
    expect(byCode.explicit_interests).toBe(LEAD_SCORING.maxExplicitInterests);
    expect(byCode.engagement).toBe(LEAD_SCORING.maxEngagement);
    expect(max.score).toBeLessThanOrEqual(100);
    expect(max.tier).toBe("A");
    const min = scoreLead({ ...base, roleId: "unknown-role", challengeCount: -3, email: "x@gmail.com" });
    expect(min.score).toBeGreaterThanOrEqual(0);
    expect(min.tier).toBe("C");
  });

  it("weights follow-up consent strongly and a personal mailbox negatively", () => {
    const consented = scoreLead({ ...base, followUpConsent: true });
    expect(consented.score - scoreLead(base).score).toBe(LEAD_SCORING.followUpConsent);
    const personal = scoreLead({ ...base, email: "Ana@GMAIL.com " });
    expect(personal.factors).toContainEqual({
      code: "personal_email_domain",
      points: LEAD_SCORING.personalEmailDomain,
    });
  });

  it("assigns tiers at the configured thresholds", () => {
    const tierFor = (followUpConsent: boolean, challengeCount: number, explicitInterestCount: number) =>
      scoreLead({ ...base, roleId: "executive", followUpConsent, challengeCount, explicitInterestCount })
        .tier;
    expect(tierFor(true, 3, 3)).toBe("A"); // 20 + 20 + 15 + 15 = 70
    expect(tierFor(false, 3, 0)).toBe("B"); // 20 + 15 = 35
    expect(tierFor(false, 1, 0)).toBe("C"); // 20 + 5 = 25
  });
});

describe("lead scoring in storage and responses", () => {
  let t: TestDatabase;
  beforeEach(() => {
    t = createTestDatabase();
  });
  afterEach(async () => t.cleanup());

  it("is stored with the lead and never returned to the kiosk", async () => {
    const { service, logs } = createTestLeadService(t.db);
    const res = await handleCreateLead(
      new Request("http://localhost/api/leads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(validLead({ consents: { reportDelivery: true, salesFollowUp: true } })),
      }),
      service,
      logs.logger,
    );
    expect(res.status).toBe(201);
    const body = await res.text();
    expect(body).not.toMatch(/score|tier|factor/i);

    const lead = await t.db.lead.findFirstOrThrow();
    expect(lead.leadScore).toBeGreaterThan(0);
    expect(["A", "B", "C"]).toContain(lead.leadTier);
    const factors = JSON.parse(lead.leadScoreFactors) as { code: string; points: number }[];
    expect(factors).toContainEqual({ code: "follow_up_consent", points: LEAD_SCORING.followUpConsent });
    expect(lead.leadScoringVersion).toBe(LEAD_SCORING_VERSION);

    const report = await t.db.report.findFirstOrThrow();
    expect(`${report.html}${report.text}`).not.toMatch(/leadScore|puntaje interno|internal score/i);
    expect(`${report.html}${report.text}`).not.toContain(String(lead.leadScoringVersion));
  });

  it("the database refuses a score outside 0–100 or an unknown tier", async () => {
    const { service } = createTestLeadService(t.db);
    await service.submitLead(validLead());
    const raw = t.raw();
    expect(() => raw.prepare('UPDATE "Lead" SET "leadScore" = 101').run()).toThrow(/CHECK/);
    expect(() => raw.prepare(`UPDATE "Lead" SET "leadTier" = 'Z'`).run()).toThrow(/CHECK/);
  });
});
