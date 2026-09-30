/**
 * Consistent online backup of the SQLite database (safe while the kiosk is running: uses SQLite's backup
 * API, which also captures data still in the WAL file). The backup contains personal data.
 *
 *   npm run db:backup                 # → data/backups/linde-sphere-<timestamp>.db
 *   npm run db:backup -- --out <file>
 */
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { resolveSqlitePath } from "../src/server/database-probe";

async function main() {
  const source = resolveSqlitePath(process.env.DATABASE_URL?.trim() || "file:./data/linde-sphere.db");
  if (!existsSync(source)) {
    console.error("No database file found. Run `npm run db:deploy` first.");
    process.exit(1);
  }
  const outIndex = process.argv.indexOf("--out");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const out = path.resolve(
    outIndex > -1 && process.argv[outIndex + 1]
      ? process.argv[outIndex + 1]!
      : `data/backups/linde-sphere-${stamp}.db`,
  );
  mkdirSync(path.dirname(out), { recursive: true });
  const db = new Database(source, { readonly: true, fileMustExist: true });
  try {
    await db.backup(out);
    console.log(`Backup written to ${out}`);
  } finally {
    db.close();
  }
}

main().catch((error: unknown) => {
  console.error(`Backup failed: ${error instanceof Error ? error.name : "Error"}`);
  process.exit(1);
});
