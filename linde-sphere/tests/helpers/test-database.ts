import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { visibleContent, type PublicContentBundle } from "@/domain/content/visibility";
import { createDatabase, type Database as PrismaDatabase } from "@/server/db/client";
import { expectedMigrations } from "@/server/database-probe";
import { createPrismaLeadRepository } from "@/server/leads/lead-repository";
import { createLeadService, type LeadServiceDeps } from "@/server/leads/lead-service";
import { createLogger, type LogLevel } from "@/server/logging/logger";
import { loadContentFromDirectory } from "@/server/content/load-content";
import { CONTENT_DIR, PROJECT_ROOT } from "./schema";

/**
 * A fresh SQLite database in a temp directory with every migration in prisma/migrations applied (the same
 * SQL `prisma migrate deploy` runs), plus a Prisma client for it. Call `cleanup()` in afterEach.
 */
export type TestDatabase = {
  db: PrismaDatabase;
  file: string;
  url: string;
  raw: () => Database.Database;
  cleanup: () => Promise<void>;
};

export function createTestDatabase(): TestDatabase {
  const dir = mkdtempSync(path.join(os.tmpdir(), "linde-db-"));
  const file = path.join(dir, "test.db");
  const sqlite = new Database(file);
  for (const name of expectedMigrations(PROJECT_ROOT)) {
    sqlite.exec(readFileSync(path.join(PROJECT_ROOT, "prisma", "migrations", name, "migration.sql"), "utf8"));
  }
  sqlite.close();
  const url = `file:${file}`;
  const db = createDatabase(url);
  const opened: Database.Database[] = [];
  return {
    db,
    file,
    url,
    raw: () => {
      const handle = new Database(file);
      opened.push(handle);
      return handle;
    },
    cleanup: async () => {
      opened.forEach((h) => h.close());
      await db.$disconnect();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

let demoContent: PublicContentBundle | undefined;
export function demoBundle(): PublicContentBundle {
  if (demoContent) return demoContent;
  const loaded = loadContentFromDirectory(CONTENT_DIR);
  if (!loaded.bundle) throw new Error("Seed content failed to load");
  demoContent = visibleContent(loaded.bundle, "demo");
  return demoContent;
}

/** Captures log lines so tests can assert that no personal data is written. */
export function captureLogs() {
  const lines: { level: LogLevel; line: string }[] = [];
  const logger = createLogger({ sink: (level, line) => lines.push({ level, line }), minLevel: "debug" });
  return { logger, lines, text: () => lines.map((l) => l.line).join("\n") };
}

export function createTestLeadService(db: PrismaDatabase, overrides: Partial<LeadServiceDeps> = {}) {
  const logs = captureLogs();
  const service = createLeadService({
    leads: createPrismaLeadRepository(db),
    content: demoBundle,
    emailProvider: "preview",
    logger: logs.logger,
    now: () => new Date("2026-10-20T14:05:00Z"),
    ...overrides,
  });
  return { service, logs };
}

export const validLead = (overrides: Record<string, unknown> = {}) => ({
  sessionId: "5b0c6a8e-7a53-4a5e-9f3d-2f4b8a6d9c11",
  sessionStartedAt: "2026-10-20T13:58:00Z",
  idempotencyKey: "0f8e2f52-8f0c-4d8a-a1b2-3c4d5e6f7a8b",
  firstName: "María José",
  lastName: "O'Neill-Rivera",
  organization: "Hospital San Juan (Metro)",
  jobFunctionId: "procurement-supply",
  email: "  Maria.Rivera@Hospital.example ",
  phone: "+1 (787)   555-0100",
  preferredLanguage: "es",
  selectedInterestIds: ["supply-continuity"],
  consents: { reportDelivery: true, salesFollowUp: false },
  consentVersion: "0.1.0",
  signals: {
    personaId: "procurement-supply",
    challengeIds: ["supply-continuity", "cylinder-inventory"],
    facilityTypeId: null,
    visitedSceneIds: ["campus", "icu"],
    openedHotspotIds: ["icu-monitoring"],
    engagedHotspotIds: ["icu-monitoring"],
    explicitInterestIds: [],
  },
  submittedAt: "2026-10-20T14:03:00Z",
  ...overrides,
});

/** Personal values from `validLead` that must never appear in logs. */
export const PERSONAL_VALUES = [
  "María",
  "O'Neill",
  "Rivera",
  "maria.rivera",
  "Hospital San Juan",
  "555-0100",
];
