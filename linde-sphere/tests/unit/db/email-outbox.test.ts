import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EmailMessage, EmailProvider } from "@/server/email/email-provider";
import { createEmailOutbox } from "@/server/email/email-outbox";
import {
  createPrismaEmailDeliveryRepository,
  defaultRetryDelayMs,
} from "@/server/leads/email-delivery-repository";
import {
  captureLogs,
  createTestDatabase,
  createTestLeadService,
  PERSONAL_VALUES,
  validLead,
  type TestDatabase,
} from "../../helpers/test-database";

let t: TestDatabase;
let clock: Date;
beforeEach(() => {
  t = createTestDatabase();
  clock = new Date("2026-10-20T14:05:00Z");
});
afterEach(async () => {
  await t.cleanup();
});

const advance = (ms: number) => (clock = new Date(clock.getTime() + ms));

function fakeProvider(behaviour: (message: EmailMessage) => Promise<{ messageId: string }>) {
  const sent: EmailMessage[] = [];
  const provider: EmailProvider = {
    name: "smtp",
    deliversExternally: true,
    send: vi.fn(async (message: EmailMessage) => {
      const result = await behaviour(message);
      sent.push(message);
      return result;
    }),
  };
  return { provider, sent };
}

const ok = async () => ({ messageId: "msg-1" });
const transient = async (): Promise<never> => {
  throw Object.assign(new Error("connect ETIMEDOUT for maria.rivera@hospital.example"), {
    code: "ETIMEDOUT",
  });
};

function outbox(provider: EmailProvider, maxAttempts = 3) {
  const logs = captureLogs();
  const box = createEmailOutbox({
    deliveries: createPrismaEmailDeliveryRepository(t.db),
    provider,
    sender: { from: "Linde Sphere <reportes@sender.test>" },
    maxAttempts,
    retryDelayMs: defaultRetryDelayMs,
    logger: logs.logger,
    now: () => clock,
  });
  return { box, logs };
}

async function storeLead(overrides: Record<string, unknown> = {}) {
  const { service } = createTestLeadService(t.db);
  const result = await service.submitLead(validLead(overrides));
  if (result.outcome !== "created") throw new Error(result.outcome);
  return (await t.db.emailDelivery.findFirstOrThrow({ orderBy: { createdAt: "desc" } })).id;
}
const delivery = (id: string) => t.db.emailDelivery.findUniqueOrThrow({ where: { id } });
const eventTypes = async (id: string) =>
  (
    await t.db.emailDeliveryEvent.findMany({
      where: { deliveryId: id },
      orderBy: [{ occurredAt: "asc" }, { attempt: "asc" }],
    })
  ).map((e) => e.eventType);

describe("delivery workflow: store lead → report → pending event → attempt → sent/failed", () => {
  it("stores the rendered report and a pending delivery with a queued event in the lead transaction", async () => {
    const id = await storeLead();
    const lead = await t.db.lead.findFirstOrThrow({ include: { report: true } });
    expect(lead.report).toMatchObject({
      language: "es",
      subject: "Su resumen personalizado de Linde Sphere",
      copyVersion: "0.1.0",
    });
    expect(lead.report!.html).toContain("Hola, María José:");
    expect(await delivery(id)).toMatchObject({ status: "pending", attempts: 0, provider: "preview" });
    expect(await eventTypes(id)).toEqual(["queued"]);
  });

  it("sends the stored report to the lead's address and marks it sent", async () => {
    const id = await storeLead();
    const { provider, sent } = fakeProvider(ok);
    expect(await outbox(provider).box.processDelivery(id)).toBe("sent");
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      to: "maria.rivera@hospital.example",
      from: "Linde Sphere <reportes@sender.test>",
    });
    expect(sent[0]!.html).toContain("Recomendaciones principales");
    expect(await delivery(id)).toMatchObject({
      status: "sent",
      attempts: 1,
      providerMessageId: "msg-1",
      claimedAt: null,
    });
    expect(await eventTypes(id)).toEqual(["queued", "attempt_started", "sent"]);
  });

  it("queues a failed attempt for retry with backoff, keeps the lead and stores only a code", async () => {
    const id = await storeLead();
    const { provider } = fakeProvider(transient);
    const { box, logs } = outbox(provider);
    expect(await box.processDelivery(id)).toBe("retrying");
    const row = await delivery(id);
    expect(row).toMatchObject({ status: "retrying", attempts: 1, errorCode: "NETWORK_TIMEOUT" });
    expect(row.nextAttemptAt).toEqual(new Date(clock.getTime() + 60_000));
    expect(await t.db.lead.count()).toBe(1);
    const events = await t.db.emailDeliveryEvent.findMany();
    expect(JSON.stringify(events)).not.toContain("maria");
    expect(JSON.stringify(row)).not.toContain("ETIMEDOUT for");
    PERSONAL_VALUES.forEach((v) => expect(logs.text()).not.toContain(v));
    expect(await eventTypes(id)).toEqual(["queued", "attempt_started", "attempt_failed", "retry_scheduled"]);
  });

  it("retries only when due and gives up after the attempt ceiling (never loops)", async () => {
    const id = await storeLead();
    const { provider } = fakeProvider(transient);
    const { box } = outbox(provider, 3);

    expect(await box.processDue()).toEqual({ processed: 1 }); // attempt 1
    expect(await box.processDue()).toEqual({ processed: 0 }); // not due yet
    advance(60_000);
    expect(await box.processDue()).toEqual({ processed: 1 }); // attempt 2
    advance(120_000);
    expect(await box.processDue()).toEqual({ processed: 1 }); // attempt 3 → failed
    expect(await delivery(id)).toMatchObject({ status: "failed", attempts: 3, nextAttemptAt: null });

    advance(24 * 3_600_000);
    expect(await box.processDue()).toEqual({ processed: 0 });
    expect(provider.send).toHaveBeenCalledTimes(3);
    expect((await eventTypes(id)).at(-1)).toBe("gave_up");
  });

  it("does not retry permanent failures", async () => {
    const id = await storeLead();
    const { provider } = fakeProvider(async () => {
      throw Object.assign(new Error("550 no such user"), { responseCode: 550 });
    });
    expect(await outbox(provider).box.processDelivery(id)).toBe("failed");
    expect(await delivery(id)).toMatchObject({
      status: "failed",
      attempts: 1,
      errorCode: "SMTP_PERMANENT_FAILURE",
    });
  });

  it("allows a manual retry of a failed delivery (one attempt, recorded)", async () => {
    const id = await storeLead();
    const failing = fakeProvider(async () => {
      throw Object.assign(new Error("auth"), { code: "EAUTH" });
    });
    await outbox(failing.provider).box.processDelivery(id);
    expect((await delivery(id)).status).toBe("failed");
    // Automatic processing never picks a failed delivery…
    expect(await outbox(failing.provider).box.processDelivery(id)).toBe("skipped");
    // …a manual retry does, exactly once.
    const fixed = fakeProvider(ok);
    expect(await outbox(fixed.provider).box.processDelivery(id, { manual: true })).toBe("sent");
    expect(fixed.provider.send).toHaveBeenCalledTimes(1);
    expect(await delivery(id)).toMatchObject({ status: "sent", attempts: 2, errorCode: null });
    expect(await eventTypes(id)).toContain("manual_retry");
    // A sent delivery is never sent again, even manually.
    expect(await outbox(fixed.provider).box.processDelivery(id, { manual: true })).toBe("skipped");
  });

  it("sends once when two workers race for the same delivery", async () => {
    const id = await storeLead();
    const { provider } = fakeProvider(ok);
    const a = outbox(provider).box;
    const b = outbox(provider).box;
    const outcomes = await Promise.all([a.processDelivery(id), b.processDelivery(id)]);
    expect(outcomes.sort()).toEqual(["sent", "skipped"]);
    expect(provider.send).toHaveBeenCalledTimes(1);
  });

  it("recovers a delivery whose worker crashed mid-send (stale claim)", async () => {
    const id = await storeLead();
    await t.db.emailDelivery.update({ where: { id }, data: { claimedAt: clock } });
    const { provider } = fakeProvider(ok);
    const { box } = outbox(provider);
    expect(await box.processDue()).toEqual({ processed: 0 });
    advance(6 * 60_000);
    expect(await box.processDue()).toEqual({ processed: 1 });
    expect((await delivery(id)).status).toBe("sent");
  });

  it("processes a bounded batch per tick", async () => {
    for (let i = 0; i < 12; i++) {
      await storeLead({
        idempotencyKey: `0f8e2f52-8f0c-4d8a-a1b2-${String(i).padStart(12, "0")}`,
        email: `persona${i}@hospital.example`,
      });
    }
    const { provider } = fakeProvider(ok);
    expect(await outbox(provider).box.processDue()).toEqual({ processed: 10 });
    expect(await outbox(provider).box.processDue()).toEqual({ processed: 2 });
  });

  it("each email goes only to its own visitor with only their report", async () => {
    const first = await storeLead();
    const second = await storeLead({
      idempotencyKey: "1a2b3c4d-5e6f-4a1b-8c2d-3e4f5a6b7c8d",
      firstName: "Luis",
      lastName: "Prueba",
      organization: "Clínica Modelo",
      email: "luis@clinica.example",
    });
    const { provider, sent } = fakeProvider(ok);
    const { box } = outbox(provider);
    await box.processDelivery(first);
    await box.processDelivery(second);
    const [toMaria, toLuis] = sent;
    expect(toMaria!.to).toBe("maria.rivera@hospital.example");
    expect(toMaria!.html).not.toMatch(/Luis|Clínica Modelo/);
    expect(toLuis!.to).toBe("luis@clinica.example");
    expect(toLuis!.html).not.toMatch(/María|Hospital San Juan/);
  });

  it("wakes the outbox after the lead commits, without waiting for delivery", async () => {
    const onDeliveryQueued = vi.fn();
    const { service } = createTestLeadService(t.db, { onDeliveryQueued });
    await service.submitLead(validLead());
    expect(onDeliveryQueued).toHaveBeenCalledTimes(1);
    expect(onDeliveryQueued.mock.calls[0]![0]).toBe((await t.db.emailDelivery.findFirstOrThrow()).id);
  });
});

describe("delivery without a report", () => {
  it("is recorded as failed with REPORT_UNAVAILABLE (lead kept, nothing retried)", async () => {
    const repo = (await import("@/server/leads/lead-repository")).createPrismaLeadRepository(t.db);
    const onDeliveryQueued = vi.fn();
    const { service } = createTestLeadService(t.db, {
      onDeliveryQueued,
      leads: {
        ...repo,
        createSubmission: (submission) => repo.createSubmission({ ...submission, report: null }),
      },
    });
    expect((await service.submitLead(validLead())).outcome).toBe("created");
    const row = await t.db.emailDelivery.findFirstOrThrow();
    expect(row).toMatchObject({ status: "failed", errorCode: "REPORT_UNAVAILABLE" });
    expect(await t.db.lead.count()).toBe(1);
    expect(onDeliveryQueued).not.toHaveBeenCalled();
    const { provider } = fakeProvider(ok);
    expect(await outbox(provider).box.processDue()).toEqual({ processed: 0 });
  });
});
