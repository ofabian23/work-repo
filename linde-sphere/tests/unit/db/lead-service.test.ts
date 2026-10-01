import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LeadCreatedResponseSchema } from "@/domain/leads/lead-submission";
import {
  createPrismaEmailDeliveryRepository,
  defaultRetryDelayMs,
} from "@/server/leads/email-delivery-repository";
import { createPrismaLeadRepository } from "@/server/leads/lead-repository";
import { hashStatusToken } from "@/server/leads/status-token";
import {
  createTestDatabase,
  createTestLeadService,
  PERSONAL_VALUES,
  validLead,
  type TestDatabase,
} from "../../helpers/test-database";

let t: TestDatabase;
beforeEach(() => {
  t = createTestDatabase();
});
afterEach(async () => {
  await t.cleanup();
});

const counts = async () => ({
  leads: await t.db.lead.count(),
  interests: await t.db.leadInterest.count(),
  sessions: await t.db.visitorSessionSummary.count(),
  deliveries: await t.db.emailDelivery.count(),
});

const created = async (overrides: Record<string, unknown> = {}) => {
  const { service, logs } = createTestLeadService(t.db);
  const result = await service.submitLead(validLead(overrides));
  if (result.outcome !== "created") throw new Error(`Expected created, got ${result.outcome}`);
  return { service, logs, response: result.response };
};

describe("lead service — storing a submission", () => {
  it("stores lead, interests, session summary and a pending delivery in one submission", async () => {
    const { response } = await created();
    expect(LeadCreatedResponseSchema.parse(response)).toEqual({
      statusToken: expect.any(String),
      emailQueued: true,
      followUp: "email",
      replayed: false,
    });
    const lead = await t.db.lead.findFirstOrThrow({ include: { interests: true, emailDeliveries: true } });
    expect(lead).toMatchObject({
      firstName: "María José",
      lastName: "O'Neill-Rivera",
      organization: "Hospital San Juan (Metro)",
      roleLabel: "Compras y cadena de suministro",
      businessEmail: "maria.rivera@hospital.example",
      optionalPhone: "+1 (787) 555-0100",
      preferredLanguage: "es",
      reportConsent: true,
      followUpConsent: false,
      consentTextVersion: "0.1.0",
      source: "kiosk_lead_form",
      status: "active",
    });
    expect(lead.emailDeliveries).toEqual([
      expect.objectContaining({ provider: "preview", status: "pending", attempts: 0, errorCode: null }),
    ]);
    expect(await counts()).toMatchObject({ leads: 1, sessions: 1, deliveries: 1 });
  });

  it("stores the visitor's selections and the server-recomputed recommendations as interests", async () => {
    await created();
    const interests = await t.db.leadInterest.findMany();
    const bySource = (source: string) =>
      interests.filter((i) => i.sourceType === source).map((i) => `${i.category}:${i.value}`);
    expect(bySource("form_selection")).toEqual(
      expect.arrayContaining(["role:procurement-supply", "challenge:supply-continuity"]),
    );
    expect(bySource("session_selection")).toEqual(
      expect.arrayContaining([
        "role:procurement-supply",
        "challenge:supply-continuity",
        "challenge:cylinder-inventory",
      ]),
    );
    const recommended = interests.filter((i) => i.sourceType === "recommendation");
    expect(recommended.length).toBeGreaterThan(0);
    // Relevance is stored in words, never as a score; selections carry no relevance.
    recommended.forEach((i) => expect(["high", "medium", "possible"]).toContain(i.relevance));
    interests.filter((i) => i.sourceType !== "recommendation").forEach((i) => expect(i.relevance).toBeNull());
  });

  it("stores the session as normalized sets and drops ids that are not in the served content", async () => {
    const lead = validLead();
    await created({
      signals: {
        ...lead.signals,
        visitedSceneIds: ["campus", "icu", "not-a-scene"],
        openedHotspotIds: ["icu-monitoring", "made-up-hotspot"],
        engagedHotspotIds: ["icu-monitoring"],
      },
    });
    const summary = await t.db.visitorSessionSummary.findFirstOrThrow({ include: { items: true } });
    expect(summary).toMatchObject({
      sessionId: lead.sessionId,
      selectedPersona: "procurement-supply",
      startedAt: new Date("2026-10-20T13:58:00Z"),
      completedAt: new Date("2026-10-20T14:05:00Z"),
    });
    const of = (kind: string) =>
      summary.items
        .filter((i) => i.kind === kind)
        .sort((a, b) => a.position - b.position)
        .map((i) => i.value);
    expect(of("scene")).toEqual(["campus", "icu"]);
    expect(of("hotspot")).toEqual(["icu-monitoring"]);
    expect(of("challenge")).toEqual(["supply-continuity", "cylinder-inventory"]);
    expect(of("recommendation").length).toBeGreaterThan(0);
  });

  it("keeps one session summary when a second lead comes from the same session", async () => {
    await created();
    const { service } = createTestLeadService(t.db);
    const second = await service.submitLead(
      validLead({ idempotencyKey: "1a2b3c4d-5e6f-4a1b-8c2d-3e4f5a6b7c8d", email: "otra@hospital.example" }),
    );
    expect(second.outcome).toBe("created");
    expect(await counts()).toMatchObject({ leads: 2, sessions: 1, deliveries: 2 });
  });
});

describe("lead service — idempotency and double taps", () => {
  it("returns the original result for a repeated request token without storing a duplicate", async () => {
    const { service, response } = await created();
    const again = await service.submitLead(validLead({ submittedAt: "2026-10-20T14:03:02Z" }));
    expect(again).toEqual({ outcome: "replayed", response: { ...response, replayed: true } });
    expect(await counts()).toMatchObject({ leads: 1, sessions: 1, deliveries: 1 });
  });

  it("stores exactly one lead when two identical requests race (double tap)", async () => {
    const { service } = createTestLeadService(t.db);
    const results = await Promise.all([service.submitLead(validLead()), service.submitLead(validLead())]);
    expect(results.map((r) => r.outcome).sort()).toEqual(["created", "replayed"]);
    const tokens = results.map((r) => ("response" in r ? r.response.statusToken : null));
    expect(tokens[0]).toBe(tokens[1]);
    expect(await counts()).toMatchObject({ leads: 1, deliveries: 1 });
  });

  it("rejects a reused request token with a different payload", async () => {
    const { service } = await created();
    const conflict = await service.submitLead(validLead({ email: "someone.else@hospital.example" }));
    expect(conflict).toEqual({ outcome: "conflict" });
    expect(await counts()).toMatchObject({ leads: 1 });
  });
});

describe("lead service — consent version", () => {
  it("refuses a submission made against an older consent text and stores nothing", async () => {
    const { service } = createTestLeadService(t.db);
    const result = await service.submitLead(validLead({ consentVersion: "0.0.9" }));
    expect(result.outcome).toBe("invalid");
    const issues = result.outcome === "invalid" ? result.issues : [];
    expect(issues).toContainEqual(
      expect.objectContaining({ field: "consentVersion", code: "consent_version_mismatch" }),
    );
    expect(await counts()).toMatchObject({ leads: 0 });
  });
});

describe("lead service — validation", () => {
  it.each([
    ["invalid email", { email: "not-an-email" }, "email"],
    [
      "missing report consent",
      { consents: { reportDelivery: false, salesFollowUp: false } },
      "consents.reportDelivery",
    ],
    ["unknown role", { jobFunctionId: "astronaut" }, "jobFunctionId"],
    ["outdated consent text", { consentVersion: "0.0.9" }, "consentVersion"],
    ["unknown interest", { selectedInterestIds: ["free-text-note"] }, "selectedInterestIds.0"],
    ["session start in the future", { sessionStartedAt: "2026-10-20T15:00:00Z" }, "sessionStartedAt"],
    ["patient information field", { patientName: "Juan del Pueblo" }, "(body)"],
    ["free-text comments", { comments: "Paciente en cuarto 4" }, "(body)"],
  ])("rejects %s without storing anything", async (_label, overrides, field) => {
    const { service, logs } = createTestLeadService(t.db);
    const result = await service.submitLead(validLead(overrides));
    expect(result.outcome).toBe("invalid");
    if (result.outcome !== "invalid") return;
    expect(result.issues.map((i) => i.field)).toContain(field);
    expect(JSON.stringify(result.issues)).not.toMatch(/Juan del Pueblo|cuarto 4|not-an-email/);
    expect(await counts()).toMatchObject({ leads: 0, sessions: 0, deliveries: 0 });
    PERSONAL_VALUES.forEach((v) => expect(logs.text()).not.toContain(v));
  });

  it("normalizes the email address (trim and lower-case)", async () => {
    await created({ email: "  ANA.Lopez@Hospital.Example  " });
    expect((await t.db.lead.findFirstOrThrow()).businessEmail).toBe("ana.lopez@hospital.example");
  });
});

describe("lead service — email failures never lose a lead", () => {
  it("keeps the lead and answers success when waking the outbox throws", async () => {
    const { service, logs } = createTestLeadService(t.db, {
      onDeliveryQueued: () => {
        throw Object.assign(new Error("connect ECONNREFUSED maria.rivera@hospital.example"), {
          code: "ECONNREFUSED",
        });
      },
    });
    const result = await service.submitLead(validLead());
    expect(result.outcome).toBe("created");
    expect(await counts()).toMatchObject({ leads: 1, deliveries: 1 });
    expect(logs.text()).toContain("email.dispatch_failed");
    expect(logs.text()).toContain("CONNECTION_REFUSED");
    PERSONAL_VALUES.forEach((v) => expect(logs.text()).not.toContain(v));
  });

  it("records failed attempts on the delivery only, then gives up at the attempt ceiling", async () => {
    await created();
    const deliveries = createPrismaEmailDeliveryRepository(t.db);
    const { id } = await t.db.emailDelivery.findFirstOrThrow();
    const at = new Date("2026-10-20T14:10:00Z");
    const failure = { ok: false as const, error: { code: "SMTP_TRANSIENT_FAILURE", retryable: true } };
    const options = { at, maxAttempts: 2, retryDelayMs: defaultRetryDelayMs };

    expect(await deliveries.recordAttempt(id, failure, options)).toEqual({
      status: "retrying",
      attempts: 1,
      nextAttemptAt: new Date(at.getTime() + 60_000),
    });
    expect(await deliveries.recordAttempt(id, failure, options)).toMatchObject({
      status: "failed",
      attempts: 2,
    });

    const stored = await t.db.emailDelivery.findUniqueOrThrow({ where: { id } });
    expect(stored).toMatchObject({
      status: "failed",
      errorCode: "SMTP_TRANSIENT_FAILURE",
      lastAttemptAt: at,
    });
    expect(await t.db.lead.count()).toBe(1);
  });

  it("marks a permanent failure as failed immediately and a success as sent", async () => {
    await created();
    const deliveries = createPrismaEmailDeliveryRepository(t.db);
    const { id } = await t.db.emailDelivery.findFirstOrThrow();
    const options = { at: new Date(), maxAttempts: 12, retryDelayMs: defaultRetryDelayMs };
    const permanent = { ok: false as const, error: { code: "RECIPIENT_REJECTED", retryable: false } };
    expect((await deliveries.recordAttempt(id, permanent, options)).status).toBe("failed");
    const sent = await deliveries.recordAttempt(id, { ok: true, providerMessageId: "msg-123" }, options);
    expect(sent.status).toBe("sent");
    expect(await t.db.emailDelivery.findUniqueOrThrow({ where: { id } })).toMatchObject({
      providerMessageId: "msg-123",
      errorCode: null,
    });
  });

  it("rolls back the whole submission if any part of the transaction fails", async () => {
    const repo = createPrismaLeadRepository(t.db);
    const { service } = createTestLeadService(t.db, {
      // An invalid provider makes the last insert (the email delivery) fail inside the transaction.
      emailProvider: "carrier-pigeon" as never,
      leads: repo,
    });
    await expect(service.submitLead(validLead())).rejects.toThrow();
    expect(await counts()).toEqual({ leads: 0, interests: 0, sessions: 0, deliveries: 0 });
  });
});

describe("lead service — submission status by opaque token", () => {
  it("reports the delivery state for a valid token and stores only its hash", async () => {
    const { service, response } = await created();
    expect(await service.getSubmissionStatus(response.statusToken)).toEqual({
      submission: "stored",
      report: "pending",
    });
    const lead = await t.db.lead.findFirstOrThrow();
    expect(lead.statusTokenHash).toBe(hashStatusToken(response.statusToken));
    expect(JSON.stringify(lead)).not.toContain(response.statusToken);

    await t.db.emailDelivery.updateMany({ data: { status: "sent" } });
    expect((await service.getSubmissionStatus(response.statusToken))?.report).toBe("sent");
  });

  it("returns null for unknown or malformed tokens", async () => {
    const { service } = await created();
    expect(await service.getSubmissionStatus("A".repeat(43))).toBeNull();
    expect(await service.getSubmissionStatus("../../etc/passwd")).toBeNull();
    expect(await service.getSubmissionStatus(undefined)).toBeNull();
  });

  it("gives different tokens to different submissions", async () => {
    const first = await created();
    const second = await first.service.submitLead(
      validLead({ idempotencyKey: "1a2b3c4d-5e6f-4a1b-8c2d-3e4f5a6b7c8d", email: "otra@hospital.example" }),
    );
    expect("response" in second && second.response.statusToken).not.toBe(first.response.statusToken);
  });
});

describe("lead service — logging", () => {
  it("logs ids and outcomes but never contact details", async () => {
    const { logs, service } = await created();
    await service.submitLead(validLead());
    expect(logs.text()).toContain("lead.stored");
    expect(logs.text()).toContain("lead.replayed");
    PERSONAL_VALUES.forEach((v) => expect(logs.text()).not.toContain(v));
    expect(logs.text()).not.toContain(validLead().idempotencyKey);
  });
});

describe("lead service — server recomputation (ADR-025, ADR-051)", () => {
  it("stores the same recommendations the kiosk computes from the same evidence", async () => {
    const { recommend } = await import("@/domain/recommendations/engine");
    const { recommendationEvidence } = await import("@/domain/recommendations/recommendation-stability");
    const { demoBundle } = await import("../../helpers/test-database");
    const lead = validLead();
    // Walking through the utilities scene without opening anything must not change recommendations.
    await created({
      signals: { ...lead.signals, visitedSceneIds: [...lead.signals.visitedSceneIds, "utilities"] },
    });
    const expected = recommend(recommendationEvidence(lead.signals, demoBundle().scenes), demoBundle());
    const summary = await t.db.visitorSessionSummary.findFirstOrThrow({ include: { items: true } });
    const stored = summary.items
      .filter((i) => i.kind === "recommendation")
      .sort((a, b) => a.position - b.position)
      .map((i) => i.value);
    expect(stored).toEqual(expected?.items.map((i) => i.solutionId));
  });
});

describe("lead service — LOCAL_PACKAGE follow-up (ADR-062)", () => {
  const local = () => createTestLeadService(t.db, { followUpMode: "LOCAL_PACKAGE" });

  it("stores the lead and its report (HTML, text, JSON) as follow_up_pending, with no email attempt", async () => {
    const queued: string[] = [];
    const { service, logs } = createTestLeadService(t.db, {
      followUpMode: "LOCAL_PACKAGE",
      onDeliveryQueued: (id) => void queued.push(id),
    });
    const result = await service.submitLead(validLead());
    if (result.outcome !== "created") throw new Error(result.outcome);
    expect(LeadCreatedResponseSchema.parse(result.response)).toEqual({
      statusToken: expect.any(String),
      emailQueued: false,
      followUp: "package",
      replayed: false,
    });

    expect(await counts()).toMatchObject({ leads: 1, sessions: 1, deliveries: 0 });
    expect(queued).toEqual([]);
    const lead = await t.db.lead.findFirstOrThrow({ include: { report: true } });
    expect(lead).toMatchObject({ followUpMode: "LOCAL_PACKAGE", followUpStatus: "follow_up_pending" });
    expect(lead.report?.html).toContain("<html");
    expect(lead.report?.text.length).toBeGreaterThan(0);
    const json = JSON.parse(lead.report!.payloadJson!) as Record<string, unknown>;
    expect(json).toMatchObject({ language: "es", contentVersion: lead.contentVersion });
    // The JSON is the visitor-safe report payload: no internal score or scoring factors.
    expect(lead.report!.payloadJson).not.toMatch(/leadScore|leadTier|internal/i);
    expect(logs.text()).toContain("LOCAL_PACKAGE");
    PERSONAL_VALUES.forEach((v) => expect(logs.text()).not.toContain(v));
  });

  it("reports the stored package as 'packaged', never 'sent' or 'pending'", async () => {
    const { service } = local();
    const result = await service.submitLead(validLead());
    if (result.outcome !== "created") throw new Error(result.outcome);
    expect(await service.getSubmissionStatus(result.response.statusToken)).toEqual({
      submission: "stored",
      report: "packaged",
    });
  });

  it("a replay keeps the original lead's follow-up kind even after the mode changes", async () => {
    const first = await local().service.submitLead(validLead());
    if (first.outcome !== "created") throw new Error(first.outcome);
    const later = createTestLeadService(t.db, { followUpMode: "SMTP_EMAIL" });
    const replay = await later.service.submitLead(validLead());
    expect(replay.outcome).toBe("replayed");
    if (replay.outcome !== "replayed") return;
    expect(replay.response).toMatchObject({ followUp: "package", emailQueued: false, replayed: true });
    expect(await counts()).toMatchObject({ leads: 1, deliveries: 0 });
  });

  it("an email mode stores SMTP_EMAIL on the lead and queues exactly one delivery", async () => {
    const { response } = await created();
    expect(response.followUp).toBe("email");
    const lead = await t.db.lead.findFirstOrThrow();
    expect(lead).toMatchObject({ followUpMode: "SMTP_EMAIL", followUpStatus: "follow_up_pending" });
    expect(await counts()).toMatchObject({ deliveries: 1 });
  });
});
