import "server-only";
import { existsSync } from "node:fs";
import Database from "better-sqlite3";
import { resolveSqlitePath } from "@/server/database-probe";

/**
 * Switches the SQLite file to write-ahead logging once at startup (ADR-058). WAL lets the admin
 * utility and the health check read while a lead is being written or the email worker records an attempt,
 * instead of waiting on the write lock. The setting is stored in the file, so this is a no-op after the
 * first run. `synchronous` stays at the default (FULL): every committed lead is on disk before the visitor
 * sees the confirmation. Never throws; a missing or read-only file is reported by the health check instead.
 */
export function enableWriteAheadLog(databaseUrl: string, baseDir = process.cwd()): "wal" | "skipped" {
  try {
    const file = resolveSqlitePath(databaseUrl, baseDir);
    if (!existsSync(file)) return "skipped";
    const db = new Database(file, { fileMustExist: true, timeout: 5000 });
    try {
      const mode = db.pragma("journal_mode = WAL", { simple: true });
      return String(mode).toLowerCase() === "wal" ? "wal" : "skipped";
    } finally {
      db.close();
    }
  } catch {
    return "skipped";
  }
}
