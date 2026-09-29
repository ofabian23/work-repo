import "server-only";
import { existsSync } from "node:fs";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import type { DatabaseStatus } from "@/types/health";

/**
 * Read-only SQLite readiness probe using Node's built-in `node:sqlite` (no dependency, ADR-038).
 * It never creates the database file. Until the Prisma schema is migrated (Phase 7), a missing file
 * reports `not_initialized`. Replaced by a Prisma `SELECT 1` once Prisma is introduced.
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

export function probeSqliteDatabase(databaseUrl: string, baseDir?: string): ProbeResult {
  const file = resolveSqlitePath(databaseUrl, baseDir);
  if (!existsSync(file)) return { status: "not_initialized", reason: "database_file_missing" };

  const sqlite = loadSqlite();
  if (!sqlite) return { status: "unavailable", reason: "sqlite_driver_unavailable" };

  let db: DatabaseSync | undefined;
  try {
    db = new sqlite.DatabaseSync(file, { readOnly: true });
    // Reading sqlite_master forces SQLite to parse the file header, so corrupt files fail here.
    db.prepare("SELECT count(*) AS tables FROM sqlite_master").get();
    return { status: "ready", reason: null };
  } catch {
    return { status: "unavailable", reason: "database_unreadable" };
  } finally {
    db?.close();
  }
}
