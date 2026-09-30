import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import { probeSqliteDatabase, resolveSqlitePath } from "@/server/database-probe";
import { getHealthReport } from "@/server/health";
import { CONTENT_DIR } from "../../helpers/schema";

let dir: string;

/** A SQLite file with Prisma's migration bookkeeping table, as `prisma migrate deploy` leaves it. */
function migratedDatabase(file: string, applied: string[]) {
  const db = new DatabaseSync(file);
  db.exec(`CREATE TABLE _prisma_migrations (id TEXT PRIMARY KEY, checksum TEXT, finished_at DATETIME,
    migration_name TEXT, logs TEXT, rolled_back_at DATETIME, started_at DATETIME, applied_steps_count INTEGER)`);
  applied.forEach((name, i) =>
    db.exec(
      `INSERT INTO _prisma_migrations VALUES ('${i}', 'x', '2026-01-01', '${name}', NULL, NULL, '2026-01-01', 1)`,
    ),
  );
  return db;
}
const makeDir = () => (dir = mkdtempSync(path.join(os.tmpdir(), "linde-health-")));
afterEach(() => dir && rmSync(dir, { recursive: true, force: true }));

describe("probeSqliteDatabase", () => {
  it("resolves relative file URLs against the base directory", () => {
    expect(resolveSqlitePath("file:./data/x.db", "/srv/app")).toBe(path.resolve("/srv/app/data/x.db"));
  });

  it("reports not_initialized without creating the file", () => {
    makeDir();
    const result = probeSqliteDatabase("file:./data/none.db", dir);
    expect(result).toEqual({ status: "not_initialized", reason: "database_file_missing" });
  });

  it("reports not_initialized for a database without migrations", () => {
    makeDir();
    mkdirSync(path.join(dir, "data"));
    const db = new DatabaseSync(path.join(dir, "data", "ok.db"));
    db.exec("CREATE TABLE t (id INTEGER)");
    db.close();
    expect(probeSqliteDatabase("file:./data/ok.db", dir)).toEqual({
      status: "not_initialized",
      reason: "migrations_not_applied",
    });
  });

  it("reports ready only when every shipped migration is applied", () => {
    makeDir();
    mkdirSync(path.join(dir, "prisma", "migrations", "20260101000000_init"), { recursive: true });
    mkdirSync(path.join(dir, "prisma", "migrations", "20260201000000_next"), { recursive: true });
    const db = migratedDatabase(path.join(dir, "app.db"), ["20260101000000_init"]);
    expect(probeSqliteDatabase("file:./app.db", dir)).toEqual({
      status: "not_initialized",
      reason: "migrations_pending",
    });
    db.exec(
      "INSERT INTO _prisma_migrations VALUES ('2', 'x', '2026-02-01', '20260201000000_next', NULL, NULL, '2026-02-01', 1)",
    );
    db.close();
    expect(probeSqliteDatabase("file:./app.db", dir)).toEqual({ status: "ready", reason: null });
  });

  it("reports unavailable when a migration failed half-way", () => {
    makeDir();
    const db = migratedDatabase(path.join(dir, "app.db"), []);
    db.exec(
      "INSERT INTO _prisma_migrations VALUES ('1', 'x', NULL, '20260101000000_init', 'log', NULL, '2026-01-01', 0)",
    );
    db.close();
    expect(probeSqliteDatabase("file:./app.db", dir)).toEqual({
      status: "unavailable",
      reason: "migration_failed",
    });
  });

  it("reports unavailable for a corrupt file", () => {
    makeDir();
    writeFileSync(path.join(dir, "bad.db"), "this is not a sqlite database".repeat(50));
    expect(probeSqliteDatabase("file:./bad.db", dir)).toEqual({
      status: "unavailable",
      reason: "database_unreadable",
    });
  });
});

describe("getHealthReport", () => {
  const withContent = () => {
    makeDir();
    cpSync(CONTENT_DIR, path.join(dir, "content"), { recursive: true });
    return dir;
  };

  it("is degraded (serving, not ready) before the database exists", () => {
    const report = getHealthReport({ rawEnv: {}, projectRoot: withContent() });
    expect(report.status).toBe("degraded");
    expect(report.ready).toBe(false);
    expect(report.app.name).toBe("Linde Sphere");
    expect(report.content).toEqual({ status: "valid", version: "0.4.0", errorCount: 0 });
    expect(report.database.status).toBe("not_initialized");
  });

  it("is ok and ready when configuration, content and database are ready", () => {
    const root = withContent();
    migratedDatabase(path.join(root, "app.db"), []).close();
    const report = getHealthReport({ rawEnv: { DATABASE_URL: "file:./app.db" }, projectRoot: root });
    expect(report.status).toBe("ok");
    expect(report.ready).toBe(true);
  });

  it("reports invalid configuration by variable name only", () => {
    const secret = "p4ssw0rd-that-must-not-leak";
    const report = getHealthReport({
      rawEnv: { EMAIL_PROVIDER: "smtp", SMTP_PASS: secret, ADMIN_ENABLED: "true", ADMIN_PASSWORD: "x" },
      projectRoot: withContent(),
    });
    expect(report.status).toBe("error");
    expect(report.configuration.status).toBe("invalid");
    expect(report.configuration.invalidVariables).toEqual(
      expect.arrayContaining(["SMTP_HOST", "ADMIN_USER", "ADMIN_PASSWORD"]),
    );
    expect(JSON.stringify(report)).not.toContain(secret);
  });

  it("reports invalid content as an error", () => {
    const root = withContent();
    writeFileSync(path.join(root, "content", "personas.json"), "{ broken");
    const report = getHealthReport({ rawEnv: {}, projectRoot: root });
    expect(report.status).toBe("error");
    expect(report.content.status).toBe("invalid");
    expect(report.content.errorCount).toBeGreaterThan(0);
  });

  it("never exposes filesystem paths or the database URL", () => {
    const root = withContent();
    const report = getHealthReport({
      rawEnv: { DATABASE_URL: "file:./secret-location.db" },
      projectRoot: root,
    });
    const json = JSON.stringify(report);
    expect(json).not.toContain(root);
    expect(json).not.toContain("secret-location");
  });
});
