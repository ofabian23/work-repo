import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { probeSqliteDatabase } from "@/server/database-probe";
import { enableWriteAheadLog } from "@/server/db/sqlite-pragmas";
import { PROJECT_ROOT } from "../../helpers/schema";
import {
  createTestDatabase,
  createTestLeadService,
  validLead,
  type TestDatabase,
} from "../../helpers/test-database";

describe("SQLite write-ahead logging (ADR-058)", () => {
  let t: TestDatabase | undefined;
  afterEach(async () => t?.cleanup());

  it("switches the file to WAL; leads are still stored and the health probe still reads it", async () => {
    t = createTestDatabase();
    expect(enableWriteAheadLog(t.url)).toBe("wal");
    expect(enableWriteAheadLog(t.url)).toBe("wal"); // idempotent
    expect(t.raw().pragma("journal_mode", { simple: true })).toBe("wal");

    const { service } = createTestLeadService(t.db);
    await service.submitLead(validLead());
    expect(await t.db.lead.count()).toBe(1);
    // The test file has no _prisma_migrations table, so "readable" is what matters here (not corrupt/locked).
    expect(probeSqliteDatabase(t.url, PROJECT_ROOT)).toEqual({
      status: "not_initialized",
      reason: "migrations_not_applied",
    });
  });

  it("never throws for a missing file (the health check reports it instead)", () => {
    expect(enableWriteAheadLog(`file:${path.join(PROJECT_ROOT, "data", "does-not-exist.db")}`)).toBe(
      "skipped",
    );
    expect(enableWriteAheadLog("not-a-sqlite-url")).toBe("skipped");
  });
});
