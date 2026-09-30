import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SubmissionStatusResponseSchema } from "@/domain/leads/lead-submission";
import { handleCreateLead, handleSubmissionStatus } from "@/server/leads/lead-http";
import {
  captureLogs,
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

const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request("http://localhost/api/leads", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

const setup = () => {
  const { service, logs } = createTestLeadService(t.db);
  return { service, logs, create: (req: Request) => handleCreateLead(req, service, logs.logger) };
};

describe("POST /api/leads", () => {
  it("answers 201 with only an opaque token, then 200 for a double tap", async () => {
    const { create } = setup();
    const first = await create(post(validLead()));
    expect(first.status).toBe(201);
    expect(first.headers.get("cache-control")).toBe("no-store");
    const body = await first.json();
    expect(Object.keys(body).sort()).toEqual(["emailQueued", "replayed", "statusToken"]);

    const second = await create(post(validLead()));
    expect(second.status).toBe(200);
    expect(await second.json()).toEqual({ ...body, replayed: true });
    expect(await t.db.lead.count()).toBe(1);
  });

  it("answers 409 when a request token is reused for a different submission", async () => {
    const { create } = setup();
    await create(post(validLead()));
    const res = await create(post(validLead({ firstName: "Otra" })));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "idempotency_conflict" });
  });

  it("answers 422 with field names and messages, never the submitted values", async () => {
    const { create } = setup();
    const res = await create(post(validLead({ email: "maria.rivera-at-hospital", phone: "call me" })));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe("validation_failed");
    expect([...new Set(body.issues.map((i: { field: string }) => i.field))].sort()).toEqual([
      "email",
      "phone",
    ]);
    expect(JSON.stringify(body)).not.toMatch(/maria\.rivera|call me/);
  });

  it("rejects malformed, oversized and non-JSON requests", async () => {
    const { create } = setup();
    expect((await create(post("{not json"))).status).toBe(400);
    expect((await create(post(validLead(), { "content-type": "text/plain" }))).status).toBe(415);
    expect((await create(post({ ...validLead(), padding: "x".repeat(20_000) }))).status).toBe(413);
    expect(await t.db.lead.count()).toBe(0);
  });

  it("answers 500 without details when storage fails, and logs no personal data", async () => {
    const logs = captureLogs();
    const { service } = createTestLeadService(t.db, { emailProvider: "carrier-pigeon" as never });
    const res = await handleCreateLead(post(validLead()), service, logs.logger);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "server_error" });
    expect(logs.text()).toContain("lead.store_failed");
    PERSONAL_VALUES.forEach((v) => expect(logs.text()).not.toContain(v));
  });
});

describe("GET /api/leads/status/:token", () => {
  it("returns the delivery state for a known token and 404 otherwise", async () => {
    const { service, logs, create } = setup();
    const { statusToken } = await (await create(post(validLead()))).json();

    const ok = await handleSubmissionStatus(statusToken, service, logs.logger);
    expect(ok.status).toBe(200);
    expect(SubmissionStatusResponseSchema.parse(await ok.json())).toEqual({
      submission: "stored",
      report: "pending",
    });

    const unknown = await handleSubmissionStatus("B".repeat(43), service, logs.logger);
    const malformed = await handleSubmissionStatus("not-a-token", service, logs.logger);
    expect([unknown.status, malformed.status]).toEqual([404, 404]);
    expect(await unknown.json()).toEqual(await malformed.json());
  });
});

describe("route surface", () => {
  it("exposes only POST on /api/leads (no endpoint lists leads)", async () => {
    const route = await import("@/app/api/leads/route");
    expect(typeof route.POST).toBe("function");
    expect(Object.keys(route).filter((k) => /^(GET|PUT|PATCH|DELETE|HEAD|OPTIONS)$/.test(k))).toEqual([]);
    const status = await import("@/app/api/leads/status/[token]/route");
    expect(Object.keys(status).filter((k) => /^(POST|PUT|PATCH|DELETE)$/.test(k))).toEqual([]);
  });
});
