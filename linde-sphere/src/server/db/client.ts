import "server-only";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";
import { resolveSqlitePath } from "@/server/database-probe";
import { getServerEnv } from "@/server/env";

/**
 * The only place that constructs Prisma clients. UI code never imports this module; route handlers use
 * services, services use repositories, and only repositories (and CLI scripts) touch Prisma (ADR-052).
 */
export type Database = PrismaClient;

/** Creates a client for a SQLite file URL, resolving relative paths against `baseDir` (the project root). */
export function createDatabase(databaseUrl: string, baseDir = process.cwd()): Database {
  const file = resolveSqlitePath(databaseUrl, baseDir);
  // `timeout`: wait up to 5 s for a lock instead of failing immediately when two requests write at once.
  const adapter = new PrismaBetterSqlite3({ url: `file:${file}`, timeout: 5000 });
  return new PrismaClient({ adapter });
}

const globalForDb = globalThis as unknown as { lindeSphereDb?: Database };

/** Process-wide client (kept on globalThis so development hot reloads don't open extra connections). */
export function getDatabase(): Database {
  globalForDb.lindeSphereDb ??= createDatabase(getServerEnv().DATABASE_URL);
  return globalForDb.lindeSphereDb;
}
