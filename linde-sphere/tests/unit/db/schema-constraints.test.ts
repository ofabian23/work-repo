import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { expectedMigrations, probeSqliteDatabase } from "@/server/database-probe";
import {
  createTestDatabase,
  createTestLeadService,
  validLead,
  type TestDatabase,
} from "../../helpers/test-database";
import { PROJECT_ROOT } from "../../helpers/schema";

const prisma = path.join(PROJECT_ROOT, "node_modules", ".bin", "prisma");
const tsx = path.join(PROJECT_ROOT, "node_modules", ".bin", "tsx");

describe("migrations (real Prisma CLI)", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(path.join(os.tmpdir(), "linde-migrate-"));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("`prisma migrate deploy` creates a database the health probe reports as ready", () => {
    const url = `file:${path.join(dir, "deploy.db")}`;
    expect(probeSqliteDatabase(url, PROJECT_ROOT).status).toBe("not_initialized");
    execFileSync(prisma, ["migrate", "deploy"], {
      cwd: PROJECT_ROOT,
      env: { ...process.env, DATABASE_URL: url },
      stdio: "pipe",
    });
    expect(probeSqliteDatabase(url, PROJECT_ROOT)).toEqual({ status: "ready", reason: null });
  }, 60_000);

  it("the migrations match schema.prisma (no drift)", () => {
    const result = spawnSync(
      prisma,
      [
        "migrate",
        "diff",
        "--from-migrations",
        "prisma/migrations",
        "--to-schema",
        "prisma/schema.prisma",
        "--exit-code",
      ],
      { cwd: PROJECT_ROOT, encoding: "utf8" },
    );
    expect(result.status, result.stdout + result.stderr).toBe(0);
  }, 60_000);

  it("the seed refuses to run in production", () => {
    const result = spawnSync(tsx, ["--conditions=react-server", "prisma/seed.ts"], {
      cwd: PROJECT_ROOT,
      env: { ...process.env, NODE_ENV: "production", DATABASE_URL: `file:${path.join(dir, "never.db")}` },
      encoding: "utf8",
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Refusing to seed");
  }, 60_000);
});

describe("database constraints (defence in depth behind Prisma's enums)", () => {
  let t: TestDatabase;
  let raw: Database.Database;
  let leadId: string;
  beforeEach(async () => {
    t = createTestDatabase();
    const { service } = createTestLeadService(t.db);
    await service.submitLead(validLead());
    leadId = (await t.db.lead.findFirstOrThrow()).id;
    raw = t.raw();
  });
  afterEach(async () => {
    await t.cleanup();
  });

  const tableSql = (table: string) =>
    (
      raw.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?").get(table) as {
        sql: string;
      }
    ).sql;

  it("keeps the hand-written CHECK constraints (a table-redefining migration must re-add them)", () => {
    expect(tableSql("EmailDelivery")).toContain("EmailDelivery_status_check");
    expect(tableSql("EmailDelivery")).toContain("EmailDelivery_errorCode_check");
    expect(tableSql("Lead")).toContain("Lead_status_check");
    expect(tableSql("Lead")).toContain("Lead_reportConsent_check");
    expect(tableSql("LeadInterest")).toContain("LeadInterest_sourceType_check");
    expect(tableSql("SessionSummaryItem")).toContain("SessionSummaryItem_kind_check");
    expect(tableSql("EmailDelivery")).toContain("EmailDelivery_provider_check");
    expect(tableSql("EmailDeliveryEvent")).toContain("EmailDeliveryEvent_eventType_check");
    expect(tableSql("EmailDeliveryEvent")).toContain("EmailDeliveryEvent_errorCode_check");
    expect(tableSql("Report")).toContain("Report_language_check");
  });

  it.each([
    ["an unknown delivery status", `UPDATE EmailDelivery SET status = 'delivered'`],
    ["a negative attempt count", `UPDATE EmailDelivery SET attempts = -1`],
    [
      "a raw provider message as error code",
      `UPDATE EmailDelivery SET errorCode = '550 mailbox maria@x.com unavailable'`,
    ],
    ["an unknown lead status", `UPDATE Lead SET status = 'hot'`],
    ["a lead without report consent", `UPDATE Lead SET reportConsent = 0`],
    ["an unknown interest source", `UPDATE LeadInterest SET sourceType = 'guess'`],
    ["the retired provider name", `UPDATE EmailDelivery SET provider = 'file'`],
    ["an unknown delivery event", `UPDATE EmailDeliveryEvent SET eventType = 'opened'`],
    [
      "a raw message as event error code",
      `UPDATE EmailDeliveryEvent SET errorCode = 'user maria@x.com unknown'`,
    ],
    ["an unknown report language", `UPDATE Report SET language = 'fr'`],
  ])("rejects %s", (_label, sql) => {
    expect(() => raw.prepare(sql).run()).toThrow(/CHECK constraint failed/);
  });

  it("accepts a sanitized error code", () => {
    expect(() => raw.prepare(`UPDATE EmailDelivery SET errorCode = 'SMTP_TIMEOUT'`).run()).not.toThrow();
  });

  it("enforces unique request tokens and foreign keys", () => {
    const lead = raw.prepare("SELECT * FROM Lead").get() as Record<string, unknown>;
    expect(() =>
      raw
        .prepare(
          "INSERT INTO Lead SELECT 'other-id', createdAt, updatedAt, firstName, lastName, organization, roleLabel, businessEmail, optionalPhone, preferredLanguage, sessionId, reportConsent, followUpConsent, consentTextVersion, source, status, idempotencyKey, requestFingerprint, 'other-hash', contentVersion, exportedAt, leadScore, leadTier, leadScoreFactors, leadScoringVersion FROM Lead",
        )
        .run(),
    ).toThrow(/UNIQUE constraint failed: Lead.idempotencyKey/);
    expect(lead.idempotencyKey).toBeTruthy();
    expect(() =>
      raw
        .prepare(
          "INSERT INTO EmailDelivery (id, updatedAt, leadId, provider) VALUES ('d2', 0, 'missing-lead', 'preview')",
        )
        .run(),
    ).toThrow(/FOREIGN KEY constraint failed/);
  });

  it("deletes a lead's interests and deliveries with the lead (erasure requests)", async () => {
    await t.db.lead.delete({ where: { id: leadId } });
    expect(await t.db.leadInterest.count()).toBe(0);
    expect(await t.db.emailDelivery.count()).toBe(0);
    // The anonymous session summary is not personal data and stays.
    expect(await t.db.visitorSessionSummary.count()).toBe(1);
  });
});

describe("migration 2 (report and delivery events) on an existing database", () => {
  it("keeps existing deliveries and renames the provider 'file' to 'preview'", () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "linde-upgrade-"));
    try {
      const [first, ...rest] = expectedMigrations(PROJECT_ROOT);
      const sql = (name: string) =>
        readFileSync(path.join(PROJECT_ROOT, "prisma", "migrations", name, "migration.sql"), "utf8");
      const db = new Database(path.join(dir, "old.db"));
      db.exec(sql(first!));
      db.exec(`INSERT INTO VisitorSessionSummary (id, sessionId, startedAt, contentVersion, updatedAt) VALUES ('s1', 'session-1', 0, '0.4.0', 0);
        INSERT INTO Lead (id, updatedAt, firstName, lastName, organization, roleLabel, businessEmail, preferredLanguage, sessionId, reportConsent, followUpConsent, consentTextVersion, idempotencyKey, requestFingerprint, statusTokenHash, contentVersion)
          VALUES ('l1', 0, 'A', 'B', 'Org', 'Rol', 'a@b.co', 'es', 'session-1', 1, 0, '0.1.0', 'k1', 'f1', 'h1', '0.4.0');
        INSERT INTO EmailDelivery (id, updatedAt, leadId, provider, status) VALUES ('d1', 0, 'l1', 'file', 'pending');`);
      for (const name of rest) db.exec(sql(name));
      expect(db.prepare("SELECT provider, status FROM EmailDelivery WHERE id = 'd1'").get()).toEqual({
        provider: "preview",
        status: "pending",
      });
      expect(db.pragma("foreign_key_check")).toEqual([]);
      db.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
