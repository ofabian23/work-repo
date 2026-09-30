import "server-only";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import type { DatabaseStatus } from "@/types/health";

/**
 * Read-only SQLite readiness probe using Node's built-in `node:sqlite` (ADR-038, amended by ADR-052).
 * It never creates the database file. "ready" means the file is readable AND every migration in
 * `prisma/migrations` has been applied (read from Prisma's `_prisma_migrations` table), i.e. leads can be
 * stored. It stays synchronous and independent of the Prisma client so the health route works even when
 * the client cannot start.
 */
export type ProbeResult = { status: DatabaseStatus; reason: string | null };

export function resolveSqlitePath(databaseUrl: string, baseDir = process.cwd()): string {
  const raw = databaseUrl.replace(/^file:/, "");
  return path.isAbsolute(raw) ? raw : path.resolve(baseDir, raw);
}

type SqliteModule = { DatabaseSync: new (path: string, options?: { readOnly?: boolean }) => DatabaseSync };

function loadSqlite(): SqliteModule | undefined {
  // getBuiltinModule avoids bundler resolution of `node:sqlite` and fails soft on older runtimes.
  return process.getBuiltinModule?.("node:sqlite") as SqliteModule | undefined;
}

/** Migration folder names shipped with the app (`prisma/migrations/<timestamp>_<name>`). */
export function expectedMigrations(baseDir = process.cwd()): string[] {
  const dir = path.join(baseDir, "prisma", "migrations");
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

type MigrationRow = { migration_name: string; finished_at: unknown; rolled_back_at: unknown };

export function probeSqliteDatabase(databaseUrl: string, baseDir?: string): ProbeResult {
  const file = resolveSqlitePath(databaseUrl, baseDir);
  if (!existsSync(file)) return { status: "not_initialized", reason: "database_file_missing" };

  const sqlite = loadSqlite();
  if (!sqlite) return { status: "unavailable", reason: "sqlite_driver_unavailable" };

  let db: DatabaseSync | undefined;
  try {
    db = new sqlite.DatabaseSync(file, { readOnly: true });
    // Reading sqlite_master forces SQLite to parse the file header, so corrupt files fail here.
    const table = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = '_prisma_migrations'")
      .get();
    if (!table) return { status: "not_initialized", reason: "migrations_not_applied" };
    const rows = db
      .prepare("SELECT migration_name, finished_at, rolled_back_at FROM _prisma_migrations")
      .all() as MigrationRow[];
    const live = rows.filter((r) => r.rolled_back_at === null);
    if (live.some((r) => r.finished_at === null))
      return { status: "unavailable", reason: "migration_failed" };
    const applied = new Set(live.map((r) => r.migration_name));
    if (expectedMigrations(baseDir).some((name) => !applied.has(name))) {
      return { status: "not_initialized", reason: "migrations_pending" };
    }
    return { status: "ready", reason: null };
  } catch {
    return { status: "unavailable", reason: "database_unreadable" };
  } finally {
    db?.close();
  }
}
