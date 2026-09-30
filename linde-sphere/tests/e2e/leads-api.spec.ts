import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

/**
 * Lead storage through the real production server and a migrated SQLite database (ADR-052).
 * API-level only: the lead form UI arrives with report delivery.
 */
const lead = () => ({
  sessionId: randomUUID(),
  sessionStartedAt: new Date(Date.now() - 5 * 60_000).toISOString(),
  idempotencyKey: randomUUID(),
  firstName: "Prueba",
  lastName: "Automatizada",
  organization: "Hospital de Pruebas (ficticio)",
  jobFunctionId: "operations-facilities",
  email: `  E2E.${randomUUID().slice(0, 8)}@Example.TEST `,
  phone: null,
  preferredLanguage: "es",
  selectedInterestIds: [],
  consents: { reportDelivery: true, salesFollowUp: false },
  consentVersion: "0.1.0",
  signals: {
    personaId: "operations-facilities",
    challengeIds: ["aging-infrastructure"],
    facilityTypeId: null,
    visitedSceneIds: ["campus"],
    openedHotspotIds: [],
    engagedHotspotIds: [],
    explicitInterestIds: [],
  },
  submittedAt: new Date().toISOString(),
});

test.describe("lead storage API", () => {
  test("health reports the migrated database as ready", async ({ request }) => {
    const body = await (await request.get("/api/health")).json();
    expect(body.database).toEqual({ status: "ready", engine: "sqlite", reason: null });
  });

  test("stores a lead once, even when the same request arrives twice, and reports its status", async ({
    request,
  }) => {
    const payload = lead();
    const [a, b] = await Promise.all([
      request.post("/api/leads", { data: payload }),
      request.post("/api/leads", { data: payload }),
    ]);
    expect([a.status(), b.status()].sort()).toEqual([200, 201]);
    const [bodyA, bodyB] = [await a.json(), await b.json()];
    expect(bodyA.statusToken).toBe(bodyB.statusToken);
    expect(JSON.stringify(bodyA)).not.toMatch(/@|Prueba|leadId/);

    const status = await request.get(`/api/leads/status/${bodyA.statusToken}`);
    expect(status.status()).toBe(200);
    expect(status.headers()["cache-control"]).toBe("no-store");
    expect(await status.json()).toEqual({ submission: "stored", report: "pending" });
  });

  test("validates on the server and never echoes submitted values", async ({ request }) => {
    const res = await request.post("/api/leads", {
      data: { ...lead(), email: "no-es-un-correo", notes: "Paciente en sala 3" },
    });
    expect(res.status()).toBe(422);
    const text = await res.text();
    expect(text).not.toMatch(/no-es-un-correo|Paciente/);
  });

  test("offers no way to list leads", async ({ request }) => {
    expect((await request.get("/api/leads")).status()).toBe(405);
    expect((await request.get("/api/leads/status/not-a-real-token")).status()).toBe(404);
  });
});
