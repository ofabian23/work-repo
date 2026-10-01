/**
 * Builds the Convention Export Package (ADR-062) from the local database: leads.csv and reports/<leadId>/
 * (HTML, text, JSON). The LOCAL_PACKAGE deliverable for the sales team. Runs locally on the laptop only.
 *
 *   npm run followup:package                      # all active leads → data/exports/
 *   npm run followup:package -- --only-new        # leads not exported yet
 *   npm run followup:package -- --from 2026-10-20 --to 2026-10-22
 *   npm run followup:package -- --mark-exported   # mark the included leads as exported
 *   npm run followup:package -- --out <file.zip>
 *
 * The file contains personal contact data: keep it on encrypted storage, share it only through the channel
 * Linde approves, and delete local copies once handed over. The console shows counts and the path only.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseAdminFilters } from "../src/server/admin/admin-filters";
import { createAdminRepository } from "../src/server/admin/admin-repository";
import { createDatabase } from "../src/server/db/client";
import { buildConventionPackage } from "../src/server/follow-up/convention-package";
import { createLogger } from "../src/server/logging/logger";

const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : undefined;
};

async function main() {
  // Same validation as the admin filters: dates only (YYYY-MM-DD); anything else is ignored.
  const { from, to } = parseAdminFilters({ from: arg("--from"), to: arg("--to") });
  const db = createDatabase(process.env.DATABASE_URL?.trim() || "file:./data/linde-sphere.db");
  try {
    const pkg = await buildConventionPackage({
      repo: createAdminRepository(db),
      filters: { from, to, exported: process.argv.includes("--only-new") ? "no" : undefined },
      markExported: process.argv.includes("--mark-exported"),
      logger: createLogger({ minLevel: "warn" }),
    });
    const out = path.resolve(arg("--out") ?? path.join("data", "exports", pkg.filename));
    mkdirSync(path.dirname(out), { recursive: true });
    writeFileSync(out, pkg.bytes, { mode: 0o600 });
    console.log(
      `Follow-up package: ${pkg.leads} lead(s), ${pkg.reports} report(s)` +
        `${pkg.marked ? `, ${pkg.marked} marked as exported` : ""} → ${out}`,
    );
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(`Follow-up package failed: ${error instanceof Error ? error.name : "Error"}`);
  process.exit(1);
});
