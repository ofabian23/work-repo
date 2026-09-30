import Database from "better-sqlite3";

/** Copy every remaining page per step (SQLite's maximum; see sqlite3_backup_step). */
const ALL_PAGES = 0x7fffffff;

/**
 * Consistent copy of a SQLite file with SQLite's online backup, safe while the server is writing.
 *
 * better-sqlite3 copies 100 pages per step by default and yields between steps. SQLite restarts an online
 * backup whenever another connection writes in between, so under steady writes a growing database might
 * never finish. Copying all pages in one step holds a read lock for a moment (writers wait on their busy
 * timeout) and always completes. At a single kiosk's size this takes milliseconds.
 */
export async function backupSqliteFile(sourceFile: string, targetFile: string): Promise<void> {
  const source = new Database(sourceFile, { readonly: true, fileMustExist: true, timeout: 5000 });
  try {
    await source.backup(targetFile, { progress: () => ALL_PAGES });
  } finally {
    source.close();
  }
}
