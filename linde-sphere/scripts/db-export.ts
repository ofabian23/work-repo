/**
 * Exports stored leads to CSV for sales follow-up. Runs locally on the laptop only (ADR-024).
 *
 *   npm run db:export                 # → data/exports/leads-<timestamp>.csv
 *   npm run db:export -- --out <file>
 *
 * The file contains personal contact data: keep it on encrypted storage, share it only through the
 * company's approved channel, and delete local copies once imported. Nothing is printed to the console
 * except the row count and the output path.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createDatabase } from "../src/server/db/client";
import { exportLeadRows, LEAD_EXPORT_COLUMNS, toCsv } from "../src/server/leads/lead-export";

async function main() {
  const outIndex = process.argv.indexOf("--out");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const out = path.resolve(
    outIndex > -1 && process.argv[outIndex + 1]
      ? process.argv[outIndex + 1]!
      : `data/exports/leads-${stamp}.csv`,
  );
  const db = createDatabase(process.env.DATABASE_URL?.trim() || "file:./data/linde-sphere.db");
  try {
    const rows = await exportLeadRows(db);
    mkdirSync(path.dirname(out), { recursive: true });
    // UTF-8 BOM so Excel shows accents correctly.
    writeFileSync(out, "﻿" + toCsv(LEAD_EXPORT_COLUMNS, rows), { mode: 0o600 });
    console.log(`Exported ${rows.length} lead(s) to ${out}`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(`Export failed: ${error instanceof Error ? error.name : "Error"}`);
  process.exit(1);
});
