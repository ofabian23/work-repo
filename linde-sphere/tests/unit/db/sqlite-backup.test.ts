import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { backupSqliteFile } from "@/server/db/sqlite-backup";

describe("SQLite backup", () => {
  let dir: string | undefined;
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it("completes while another connection keeps writing, and the copy is consistent", async () => {
    dir = mkdtempSync(path.join(os.tmpdir(), "linde-backup-test-"));
    const source = path.join(dir, "source.db");
    const writer = new Database(source, { timeout: 5000 });
    writer.exec("CREATE TABLE item (id INTEGER PRIMARY KEY, payload TEXT NOT NULL)");
    const insert = writer.prepare("INSERT INTO item (payload) VALUES (?)");
    writer.transaction(() => {
      // ~2 MB: hundreds of pages, far more than one default backup step.
      for (let i = 0; i < 2000; i++) insert.run("x".repeat(1000));
    })();

    // Keep writing between event-loop turns, as the server would during a backup.
    let writing = true;
    const loop = () => {
      if (!writing) return;
      insert.run("during backup");
      setImmediate(loop);
    };
    setImmediate(loop);
    const target = path.join(dir, "backup.db");
    await backupSqliteFile(source, target);
    writing = false;
    writer.close();

    const copy = new Database(target, { readonly: true });
    expect(copy.pragma("integrity_check", { simple: true })).toBe("ok");
    expect((copy.prepare("SELECT COUNT(*) AS n FROM item").get() as { n: number }).n).toBeGreaterThanOrEqual(
      2000,
    );
    copy.close();
  });
});
