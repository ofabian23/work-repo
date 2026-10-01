import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminConfig } from "@/server/admin/admin-config";
import { parseAdminFilters } from "@/server/admin/admin-filters";
import {
  handleBackup,
  handleExport,
  handleLogin,
  handleLogout,
  handleMarkExported,
  handleRetry,
  type AdminHttpContext,
} from "@/server/admin/admin-http";
import { createAdminRepository } from "@/server/admin/admin-repository";
import { createAdminService, INTEREST_CSV_COLUMNS, LEAD_CSV_COLUMNS } from "@/server/admin/admin-service";
import { ADMIN_COOKIE, createAdminSessions, createLoginThrottle } from "@/server/admin/admin-session";
import { hashPassphrase } from "@/server/admin/passphrase";
import { createZip } from "@/server/follow-up/zip";
import { loadSeedBundle } from "../../helpers/schema";
import {
  captureLogs,
  createTestDatabase,
  createTestLeadService,
  validLead,
  type TestDatabase,
} from "../../helpers/test-database";
import { readZip } from "../../helpers/zip";

const PASSPHRASE = "frase de acceso de prueba";
let HASH: string;
beforeAll(async () => {
  HASH = await hashPassphrase(PASSPHRASE, { N: 1024, r: 8, p: 1 });
});

let t: TestDatabase;
beforeEach(() => {
  t = createTestDatabase();
});
afterEach(async () => {
  await t.cleanup();
});

/** Three leads: 20 Oct (sent), 21 Oct (failed, awkward CSV values), 22 Oct (pending, exported). */
async function seed() {
  const { service } = createTestLeadService(t.db);
  const make = async (i: number, overrides: Record<string, unknown>) => {
    const r = await service.submitLead(
      validLead({
        idempotencyKey: `0f8e2f52-8f0c-4d8a-a1b2-00000000000${i}`,
        email: `persona${i}@hospital.example`,
        ...overrides,
      }),
    );
    if (r.outcome !== "created") throw new Error(r.outcome);
    return t.db.lead.findFirstOrThrow({
      where: { businessEmail: `persona${i}@hospital.example` },
      include: { emailDeliveries: true },
    });
  };
  const a = await make(1, {});
  const b = await make(2, {
    firstName: "Ana",
    lastName: "-Rivera",
    organization: "+Hospital (Norte), Inc.",
    phone: "+1 787 555 0100",
  });
  const c = await make(3, { firstName: "Luis", lastName: "Prueba" });
  await t.db.lead.update({ where: { id: a.id }, data: { createdAt: new Date("2026-10-20T15:00:00Z") } });
  await t.db.lead.update({ where: { id: b.id }, data: { createdAt: new Date("2026-10-21T15:00:00Z") } });
  await t.db.lead.update({
    where: { id: c.id },
    data: { createdAt: new Date("2026-10-22T15:00:00Z"), exportedAt: new Date("2026-10-22T20:00:00Z") },
  });
  await t.db.emailDelivery.update({
    where: { id: a.emailDeliveries[0]!.id },
    data: { status: "sent", attempts: 1 },
  });
  await t.db.emailDelivery.update({
    where: { id: b.emailDeliveries[0]!.id },
    data: { status: "failed", attempts: 12, errorCode: "SMTP_PERMANENT_FAILURE" },
  });
  return { a, b, c, failedDelivery: b.emailDeliveries[0]!.id, pendingDelivery: c.emailDeliveries[0]!.id };
}

function setup({ enabled = true } = {}) {
  const logs = captureLogs();
  const outbox = { processDelivery: vi.fn(async () => "sent" as const) };
  const service = createAdminService({
    repo: createAdminRepository(t.db),
    outbox,
    loadContent: loadSeedBundle,
    databaseFile: t.file,
    logger: logs.logger,
    now: () => new Date("2026-10-23T12:00:00Z"),
  });
  const config: AdminConfig = {
    enabled,
    basePath: "/gestion-local",
    passphraseHash: HASH,
    sessionMinutes: 30,
    followUpMode: "LOCAL_PACKAGE",
    emailProvider: "preview",
  };
  const ctx: AdminHttpContext = {
    config,
    sessions: createAdminSessions({ idleMs: 30 * 60_000 }),
    throttle: createLoginThrottle(),
    service,
    logger: logs.logger,
  };
  return { ctx, service, outbox, logs };
}

const ORIGIN = "http://localhost:3000";
function post(
  path: string,
  body: Record<string, string>,
  { cookie, origin = ORIGIN }: { cookie?: string; origin?: string | null } = {},
) {
  const headers: Record<string, string> = {
    "content-type": "application/x-www-form-urlencoded",
    host: "localhost:3000",
  };
  if (origin) headers.origin = origin;
  if (cookie) headers.cookie = `${ADMIN_COOKIE}=${cookie}`;
  return new Request(`${ORIGIN}${path}`, {
    method: "POST",
    headers,
    body: new URLSearchParams(body).toString(),
  });
}
const cookieFrom = (res: Response) =>
  /ls_admin_session=([^;]*)/.exec(res.headers.get("set-cookie") ?? "")?.[1];

describe("admin data: overview, filters, detail", () => {
  it("counts leads and filters by date, lead status, delivery state and export", async () => {
    const { a, b, c } = await seed();
    const { service } = setup();
    const f = (raw: Record<string, string>) => parseAdminFilters(raw);
    expect(await service.overview(f({}))).toMatchObject({
      total: 3,
      exported: 1,
      byStatus: { active: 3, archived: 0 },
      byDelivery: { sent: 1, failed: 1, pending: 1 },
    });
    const ids = async (raw: Record<string, string>) =>
      (await service.listLeads(f(raw))).rows.map((r) => r.id).sort();
    expect(await ids({ from: "2026-10-21", to: "2026-10-21" })).toEqual([b.id]);
    expect(await ids({ from: "2026-10-21" })).toEqual([b.id, c.id].sort());
    expect(await ids({ delivery: "failed" })).toEqual([b.id]);
    expect(await ids({ exported: "yes" })).toEqual([c.id]);
    expect(await ids({ exported: "no" })).toEqual([a.id, b.id].sort());
    expect(await ids({ status: "archived" })).toEqual([]);
    expect((await service.overview(f({ delivery: "failed" }))).total).toBe(1);
  });

  it("shows a lead's business contact, interests and delivery history", async () => {
    const { b } = await seed();
    const detail = await setup().service.leadDetail(b.id);
    expect(detail).toMatchObject({
      name: "Ana -Rivera",
      businessEmail: "persona2@hospital.example",
      optionalPhone: "+1 787 555 0100",
      delivery: { status: "failed", errorCode: "SMTP_PERMANENT_FAILURE" },
      report: { subject: "Su resumen personalizado de Linde Sphere" },
    });
    expect(detail!.interests.some((i) => i.sourceType === "recommendation")).toBe(true);
    expect(detail!.deliveries[0]!.events.map((e) => e.eventType)).toContain("queued");
    expect(await setup().service.leadDetail("missing")).toBeNull();
  });

  it("lists content pending validation", () => {
    const rows = setup().service.pendingValidation();
    expect(rows.length).toBeGreaterThan(0);
    expect(
      rows.every((r) => r.validation_status !== "validated" || r.requires_sales_validation === "yes"),
    ).toBe(true);
    expect(rows.some((r) => r.record_type === "solution")).toBe(true);
  });
});

describe("admin actions: retry and mark exported (no delete)", () => {
  it("retries only failed or retrying deliveries, through a manual outbox attempt", async () => {
    const { failedDelivery, pendingDelivery } = await seed();
    const { service, outbox } = setup();
    expect(await service.retryDelivery(failedDelivery)).toBe("sent");
    expect(outbox.processDelivery).toHaveBeenCalledWith(failedDelivery, { manual: true });
    expect(await service.retryDelivery(pendingDelivery)).toBe("not-retryable");
    expect(await service.retryDelivery("nope")).toBe("not-found");
    expect(outbox.processDelivery).toHaveBeenCalledTimes(1);
  });

  it("marks a lead exported once and keeps the first export time", async () => {
    const { a, c } = await seed();
    const { service } = setup();
    expect(await service.markExported(a.id)).toBe(true);
    expect(await service.markExported(a.id)).toBe(false);
    expect((await t.db.lead.findUniqueOrThrow({ where: { id: c.id } })).exportedAt).toEqual(
      new Date("2026-10-22T20:00:00Z"),
    );
    expect(await t.db.lead.count()).toBe(3);
  });
});

describe("admin exports", () => {
  it("exports leads with interests, escaping formula-like values, and logs counts only", async () => {
    const { b } = await seed();
    const { service, logs } = setup();
    const { csv, filename, leads, marked } = await service.exportCsv(
      "leads",
      parseAdminFilters({ delivery: "failed" }),
      { markExported: true },
    );
    expect(filename).toMatch(/^linde-sphere-leads-2026-10-23-12-00-00\.csv$/);
    expect([leads, marked]).toEqual([1, 1]);
    const [header, row] = csv.replace(/^﻿/, "").trimEnd().split("\r\n");
    expect(header).toBe(LEAD_CSV_COLUMNS.join(","));
    expect(header).toContain("internal_score,internal_tier,score_factors"); // AC-34
    expect(row).toContain(b.id);
    expect(row).toMatch(/,\d{1,3},[ABC],"?\[/); // score, tier, factors JSON
    expect(row).toContain(",'-Rivera,");
    expect(row).toContain(`"'+Hospital (Norte), Inc."`);
    expect(row).toContain("'+1 787 555 0100");
    expect(row).toContain("supply-continuity");
    expect((await t.db.lead.findUniqueOrThrow({ where: { id: b.id } })).exportedAt).not.toBeNull();
    const logText = logs.text();
    expect(logText).toContain("admin.export");
    for (const secret of ["persona2", "Rivera", "Hospital (Norte)", "555 0100"]) {
      expect(logText).not.toContain(secret);
    }
  });

  it("exports one row per interest", async () => {
    await seed();
    const { csv } = await setup().service.exportCsv("interests", parseAdminFilters({}));
    const lines = csv.replace(/^﻿/, "").trimEnd().split("\r\n");
    expect(lines[0]).toBe(INTEREST_CSV_COLUMNS.join(","));
    expect(lines.length - 1).toBe(await t.db.leadInterest.count());
  });

  it("exports the content-validation list and a consistent database backup", async () => {
    await seed();
    const { service } = setup();
    expect(service.contentValidationCsv().csv).toContain("record_type,id,parent_id");
    const { rows, summary } = service.salesValidation();
    expect(summary.total).toBe(rows.length);
    expect(rows.some((r) => r.recordType === "persona")).toBe(true);
    const backup = await service.createBackup();
    expect(backup.filename).toMatch(/\.db$/);
    expect(backup.bytes.subarray(0, 15).toString("latin1")).toBe("SQLite format 3");
  });
});

describe("admin HTTP: authorization", () => {
  it("signs in with the passphrase and sets a strict, HttpOnly cookie scoped to the admin path", async () => {
    const { ctx } = setup();
    const res = await handleLogin(post("/gestion-local/api/login", { passphrase: PASSPHRASE }), ctx);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/gestion-local");
    const cookie = res.headers.get("set-cookie")!;
    expect(cookie).toMatch(/Path=\/gestion-local; HttpOnly; SameSite=Strict; Max-Age=1800/);
    expect(cookie).not.toContain("Secure");
    expect(ctx.sessions.validate(cookieFrom(res))).toBe(true);

    const https = await handleLogin(
      new Request("https://kiosk.test/gestion-local/api/login", {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          host: "kiosk.test",
          origin: "https://kiosk.test",
        },
        body: `passphrase=${encodeURIComponent(PASSPHRASE)}`,
      }),
      ctx,
    );
    expect(https.headers.get("set-cookie")).toContain("Secure");
  });

  it("rejects a wrong passphrase and locks after repeated failures", async () => {
    const { ctx, logs } = setup();
    const wrong = await handleLogin(post("/gestion-local/api/login", { passphrase: "incorrecta" }), ctx);
    expect(wrong.headers.get("location")).toBe("/gestion-local/login?error=invalid");
    expect(wrong.headers.get("set-cookie")).toBeNull();
    for (let i = 0; i < 4; i++) {
      await handleLogin(post("/gestion-local/api/login", { passphrase: "incorrecta" }), ctx);
    }
    const locked = await handleLogin(post("/gestion-local/api/login", { passphrase: PASSPHRASE }), ctx);
    expect(locked.headers.get("location")).toBe("/gestion-local/login?error=locked");
    expect(logs.text()).not.toContain("incorrecta");
  });

  it("refuses cross-site and origin-less posts, and everything when admin is disabled", async () => {
    const { ctx } = setup();
    const evil = post("/x", { passphrase: PASSPHRASE }, { origin: "http://evil.test" });
    expect((await handleLogin(evil, ctx)).status).toBe(403);
    expect((await handleLogin(post("/x", { passphrase: PASSPHRASE }, { origin: null }), ctx)).status).toBe(
      403,
    );
    // Browsers send "Origin: null" under no-referrer; Sec-Fetch-Site then decides.
    const nullOrigin = (site: string) => {
      const request = post("/x", { passphrase: PASSPHRASE }, { origin: "null" });
      request.headers.set("sec-fetch-site", site);
      return request;
    };
    expect((await handleLogin(nullOrigin("cross-site"), ctx)).status).toBe(403);
    expect((await handleLogin(nullOrigin("same-origin"), ctx)).status).toBe(303);
    const disabled = setup({ enabled: false }).ctx;
    expect((await handleLogin(post("/x", { passphrase: PASSPHRASE }), disabled)).status).toBe(404);
    expect((await handleExport(post("/x", { kind: "leads", confirm: "yes" }), disabled)).status).toBe(404);
  });

  it("sends unauthenticated or forged-cookie requests to the sign-in page, without doing anything", async () => {
    const { failedDelivery, a } = await seed();
    const { ctx, outbox } = setup();
    for (const cookie of [undefined, "forged-cookie-value"]) {
      for (const [handler, body] of [
        [handleExport, { kind: "leads", confirm: "yes" }],
        [handleBackup, { confirm: "yes" }],
        [handleRetry, { deliveryId: failedDelivery, leadId: a.id }],
        [handleMarkExported, { leadId: a.id }],
      ] as const) {
        const res = await handler(post("/x", body, { cookie }), ctx);
        expect(res.status).toBe(303);
        expect(res.headers.get("location")).toBe("/gestion-local/login");
        expect(res.headers.get("content-disposition")).toBeNull();
      }
    }
    expect(outbox.processDelivery).not.toHaveBeenCalled();
    expect((await t.db.lead.findUniqueOrThrow({ where: { id: a.id } })).exportedAt).toBeNull();
  });

  it("requires confirmation before any export, then returns an uncached attachment", async () => {
    await seed();
    const { ctx } = setup();
    const token = ctx.sessions.create();
    const unconfirmed = await handleExport(post("/x", { kind: "leads" }, { cookie: token }), ctx);
    expect(unconfirmed.headers.get("location")).toBe("/gestion-local/exports?error=confirm");
    const backupUnconfirmed = await handleBackup(post("/x", {}, { cookie: token }), ctx);
    expect(backupUnconfirmed.headers.get("location")).toBe("/gestion-local/exports?error=confirm");

    const res = await handleExport(
      post("/x", { kind: "leads", confirm: "yes", exported: "no" }, { cookie: token }),
      ctx,
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toMatch(
      /^attachment; filename="linde-sphere-leads-.*\.csv"$/,
    );
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.text()).toContain("persona1@hospital.example");

    const content = await handleExport(
      post("/x", { kind: "content", confirm: "yes" }, { cookie: token }),
      ctx,
    );
    expect(await content.text()).toContain("record_type");

    // Sales-validation worksheet (ADR-060): confirmed download, no visitor data, back to its own page.
    const salesUnconfirmed = await handleExport(post("/x", { kind: "sales" }, { cookie: token }), ctx);
    expect(salesUnconfirmed.headers.get("location")).toBe("/gestion-local/sales?error=confirm");
    const sales = await handleExport(post("/x", { kind: "sales", confirm: "yes" }, { cookie: token }), ctx);
    expect(sales.headers.get("content-disposition")).toMatch(
      /^attachment; filename="linde-sphere-sales-validation-.*\.csv"$/,
    );
    const salesCsv = await sales.text();
    expect(salesCsv).toContain("record_type,id,current_name,spanish_name,english_name");
    expect(salesCsv).not.toContain("persona1@hospital.example");

    const backup = await handleBackup(post("/x", { confirm: "yes" }, { cookie: token }), ctx);
    expect(backup.headers.get("content-type")).toBe("application/vnd.sqlite3");
  });

  it("retries a failed delivery and marks a lead exported with redirects that carry no personal data", async () => {
    const { failedDelivery, a } = await seed();
    const { ctx, outbox } = setup();
    const token = ctx.sessions.create();
    const retry = await handleRetry(
      post("/x", { deliveryId: failedDelivery, leadId: a.id }, { cookie: token }),
      ctx,
    );
    expect(retry.headers.get("location")).toBe(`/gestion-local/leads/${a.id}?result=retry-sent`);
    expect(outbox.processDelivery).toHaveBeenCalledWith(failedDelivery, { manual: true });
    const mark = await handleMarkExported(post("/x", { leadId: a.id }, { cookie: token }), ctx);
    expect(mark.headers.get("location")).toBe(`/gestion-local/leads/${a.id}?result=marked`);
    expect(mark.headers.get("location")).not.toMatch(/@|persona/);
    const bad = await handleRetry(post("/x", { deliveryId: "../etc", leadId: a.id }, { cookie: token }), ctx);
    expect(bad.status).toBe(400);
  });

  it("answers a generic 500 (no stack, no message) when an action fails unexpectedly", async () => {
    const { ctx, logs } = setup();
    ctx.service.exportCsv = async () => {
      throw Object.assign(new Error("SQLITE_BUSY at /home/user/secret/path.db for maria@x.com"), {
        code: "SQLITE_BUSY",
      });
    };
    const token = ctx.sessions.create();
    const res = await handleExport(post("/x", { kind: "leads", confirm: "yes" }, { cookie: token }), ctx);
    expect(res.status).toBe(500);
    const body = await res.text();
    expect(body).toBe("Error interno. Vuelva a intentarlo.");
    expect(logs.text()).toContain("SQLITE_BUSY");
    expect(logs.text()).not.toMatch(/secret\/path|maria@x\.com/);
  });

  it("logs out by revoking the session", async () => {
    const { ctx } = setup();
    const token = ctx.sessions.create();
    const res = await handleLogout(post("/x", {}, { cookie: token }), ctx);
    expect(res.headers.get("location")).toBe("/gestion-local/login");
    expect(res.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(ctx.sessions.validate(token)).toBe(false);
  });
});

describe("Convention Export Package (ADR-062)", () => {
  /** Two active LOCAL_PACKAGE leads and one erasure request, as the default kiosk stores them. */
  async function seedLocal() {
    const { service } = createTestLeadService(t.db, { followUpMode: "LOCAL_PACKAGE" });
    const ids: string[] = [];
    for (const [i, overrides] of [
      [1, {}],
      [2, { firstName: "Ana", lastName: "-Rivera", organization: "+Hospital (Norte), Inc." }],
      [3, { firstName: "Luis", lastName: "Prueba" }],
    ] as const) {
      const r = await service.submitLead(
        validLead({
          idempotencyKey: `0f8e2f52-8f0c-4d8a-a1b2-10000000000${i}`,
          email: `local${i}@hospital.example`,
          ...overrides,
        }),
      );
      if (r.outcome !== "created") throw new Error(r.outcome);
      ids.push(
        (await t.db.lead.findFirstOrThrow({ where: { businessEmail: `local${i}@hospital.example` } })).id,
      );
    }
    await t.db.lead.update({ where: { id: ids[2] }, data: { status: "erasure_requested" } });
    return ids as [string, string, string];
  }

  it("writes a standard ZIP (deflate, UTF-8 names, CRC-32) and refuses unsafe entry names", () => {
    const zip = createZip(
      [
        { name: "a.txt", data: "hola" },
        { name: "carpeta/año.txt", data: Buffer.from("ñandú ".repeat(200)) },
      ],
      new Date("2026-10-23T12:00:00Z"),
    );
    const files = readZip(zip);
    expect([...files.keys()]).toEqual(["a.txt", "carpeta/año.txt"]);
    expect(files.get("carpeta/año.txt")!.toString("utf8")).toBe("ñandú ".repeat(200));
    expect(() => createZip([{ name: "../x", data: "" }], new Date())).toThrow();
    expect(() => createZip([{ name: "/x", data: "" }], new Date())).toThrow();
    expect(() =>
      createZip(
        [
          { name: "a", data: "" },
          { name: "a", data: "" },
        ],
        new Date(),
      ),
    ).toThrow();
  });

  it("contains /reports (HTML, text, JSON per active lead) and /leads.csv, with no personal data in file names", async () => {
    const [a, b, erased] = await seedLocal();
    const { service, logs } = setup();
    const pkg = await service.exportPackage({});
    expect(pkg).toMatchObject({ leads: 2, reports: 2, marked: 0 });
    expect(pkg.filename).toBe("linde-sphere-follow-up-package-2026-10-23-12-00-00.zip");

    const files = readZip(pkg.bytes);
    expect([...files.keys()].sort()).toEqual(
      [
        "LEEME.txt",
        "leads.csv",
        ...[a, b].flatMap((id) => ["html", "json", "txt"].map((ext) => `reports/${id}/report.${ext}`)),
      ].sort(),
    );
    expect([...files.keys()].join(" ")).not.toMatch(/local\d|Ana|Rivera|hospital/i);
    expect([...files.keys()].join(" ")).not.toContain(erased);

    const csv = files
      .get("leads.csv")!
      .toString("utf8")
      .replace(/^\uFEFF/, "");
    const [header, ...rows] = csv.trimEnd().split("\r\n");
    expect(header).toBe([...LEAD_CSV_COLUMNS, "report_folder"].join(","));
    expect(header).toContain("follow_up_mode,follow_up_status");
    expect(rows).toHaveLength(2);
    expect(csv).toContain(`reports/${a}/`);
    expect(csv).toContain("LOCAL_PACKAGE,follow_up_pending");
    // Spreadsheet formula injection is neutralized in the package CSV too.
    expect(csv).toContain(`"'+Hospital (Norte), Inc."`);
    expect(csv).not.toContain("local3@hospital.example");

    expect(files.get(`reports/${a}/report.html`)!.toString("utf8")).toContain("<html");
    const json = JSON.parse(files.get(`reports/${a}/report.json`)!.toString("utf8"));
    expect(json).toMatchObject({ leadId: a, language: "es", report: { language: "es" } });
    expect(JSON.stringify(json)).not.toMatch(/leadScore|leadTier|internal_score|score_factors/);

    // Counts only in the logs: never names, emails or organizations.
    expect(logs.text()).toContain("follow_up.package");
    expect(logs.text()).not.toMatch(/local\d@|Ana|Norte|Hospital San Juan/);
  });

  it("counts generated packages, and marking exported sets the follow-up status", async () => {
    const [a] = await seedLocal();
    const { service } = setup();
    expect(await service.overview(parseAdminFilters({}))).toMatchObject({
      total: 3,
      packages: 3,
      followUpPending: 3,
      byDelivery: { pending: 0, sent: 0, failed: 0, retrying: 0 },
    });
    const pkg = await service.exportPackage({ exported: "no" }, { markExported: true });
    expect(pkg.marked).toBe(2);
    expect(await t.db.lead.findUniqueOrThrow({ where: { id: a } })).toMatchObject({
      followUpStatus: "exported",
      exportedAt: new Date("2026-10-23T12:00:00Z"),
    });
    expect(await service.overview(parseAdminFilters({}))).toMatchObject({ followUpPending: 1, exported: 2 });
    // Only not-yet-exported active leads remain: none.
    expect((await service.exportPackage({ exported: "no" })).leads).toBe(0);
    expect(await t.db.lead.count()).toBe(3);
  });

  it("is a confirmed, uncached download over the admin export route", async () => {
    await seedLocal();
    const { ctx } = setup();
    const token = ctx.sessions.create();
    const unconfirmed = await handleExport(post("/x", { kind: "package" }, { cookie: token }), ctx);
    expect(unconfirmed.headers.get("location")).toBe("/gestion-local/exports?error=confirm");
    expect(await t.db.lead.count({ where: { followUpStatus: "exported" } })).toBe(0);

    const res = await handleExport(
      post("/x", { kind: "package", confirm: "yes", markExported: "yes" }, { cookie: token }),
      ctx,
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/zip");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("content-disposition")).toMatch(
      /^attachment; filename="linde-sphere-follow-up-package-[\d-]+\.zip"$/,
    );
    const files = readZip(Buffer.from(await res.arrayBuffer()));
    expect(files.has("leads.csv")).toBe(true);
    expect(await t.db.lead.count({ where: { followUpStatus: "exported" } })).toBe(2);

    const signedOut = await handleExport(post("/x", { kind: "package", confirm: "yes" }), ctx);
    expect(signedOut.headers.get("location")).toBe("/gestion-local/login");
  });
});
