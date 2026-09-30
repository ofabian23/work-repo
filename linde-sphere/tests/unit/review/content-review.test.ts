import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  REVIEW_COLUMNS,
  buildReviewRows,
  renderSalesReviewMarkdown,
  reviewRowsAsTable,
} from "@/domain/review/content-review";
import { escapeCsvCell, toCsv } from "@/lib/csv";
import { CSV_PATH, DOC_PATH, buildContentExport } from "../../../scripts/lib/content-export";
import { PROJECT_ROOT, clone, loadSeedBundle } from "../../helpers/schema";

const seed = loadSeedBundle();

describe("CSV writer", () => {
  it("quotes commas, quotes and line breaks", () => {
    expect(escapeCsvCell('Oxígeno, "clínico"')).toBe('"Oxígeno, ""clínico"""');
    expect(escapeCsvCell("line1\nline2")).toBe('"line1\nline2"');
    expect(escapeCsvCell("plain")).toBe("plain");
  });

  it("neutralizes spreadsheet formulas", () => {
    expect(escapeCsvCell('=HYPERLINK("x")')).toBe('"\'=HYPERLINK(""x"")"');
    expect(escapeCsvCell("+1 787")).toBe("'+1 787");
    expect(escapeCsvCell("@cmd")).toBe("'@cmd");
  });

  it("renders null/booleans and uses a BOM with CRLF line endings", () => {
    const csv = toCsv([
      ["a", null, true],
      ["b", undefined, false],
    ]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toBe("﻿a,,yes\r\nb,,no\r\n");
  });
});

describe("content review rows", () => {
  const rows = buildReviewRows(seed);

  it("covers every content item exactly once", () => {
    const hotspots = seed.scenes.reduce((n, s) => n + s.hotspots.length, 0);
    const expected =
      seed.solutions.length +
      seed.digitalAssets.length +
      seed.personas.length +
      seed.challenges.length +
      seed.facilityTypes.length +
      seed.scenes.length +
      hotspots +
      1; // consent text
    expect(rows).toHaveLength(expected);
    const keys = rows.map((r) => `${r.record_type}:${r.id}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("marks every sample solution as requiring Puerto Rico verification and missing an approved asset", () => {
    const solutions = rows.filter((r) => r.record_type === "solution");
    expect(solutions).toHaveLength(10);
    for (const r of solutions) {
      expect(r.validation_status).toBe("assumed");
      expect(r.requires_sales_validation).toBe("yes");
      expect(r.pr_availability).toBe("requires-verification");
      expect(r.review_decision).toBe("pending");
      expect(r.missing_asset).toBe("yes");
      expect(r.internal_notes).toMatch(/^PENDING PUERTO RICO VALIDATION/);
      expect(r["sales_decision (keep/remove/rename)"]).toBe("");
    }
  });

  it("clears missing_asset once a validated asset is linked", () => {
    const b = clone(seed);
    const asset = b.digitalAssets.find((a) => a.id === "asset-emergency-planning-checklist")!;
    Object.assign(asset, {
      validationStatus: "validated",
      market: "puerto-rico",
      requiresSalesValidation: false,
    });
    const row = buildReviewRows(b).find((r) => r.id === "backup-emergency-supply")!;
    expect(row.missing_asset).toBe("no");
  });

  it("has a header row matching the column list", () => {
    const table = reviewRowsAsTable(rows);
    expect(table[0]).toEqual([...REVIEW_COLUMNS]);
    expect(table.slice(1).every((r) => r.length === REVIEW_COLUMNS.length)).toBe(true);
  });
});

describe("sales review markdown", () => {
  it("contains every section the sales team reviews", () => {
    const md = renderSalesReviewMarkdown(seed);
    for (const heading of [
      "Keep",
      "Remove",
      "Rename",
      "Available in Puerto Rico",
      "Not available in Puerto Rico",
      "Requires verification",
      "Missing asset",
      "Priority at convention",
    ]) {
      expect(md).toMatch(new RegExp(`### 11\\.\\d+ ${heading}\\n`));
    }
  });

  it("reflects recorded decisions", () => {
    const b = clone(seed);
    const s = b.solutions.find((x) => x.id === "monitoring-telemetry")!;
    s.salesReview = {
      ...s.salesReview,
      decision: "rename",
      proposedName: { es: "Telemetría", en: "Telemetry" },
    };
    const md = renderSalesReviewMarkdown(b);
    const rename = md.slice(md.indexOf("### 11.4 Rename"), md.indexOf("### 11.5"));
    expect(rename).toContain("`monitoring-telemetry`");
    expect(rename).toContain("Telemetry");
  });
});

describe("committed export files", () => {
  it("are up to date with the seed content (run `npm run content:export` if this fails)", async () => {
    const result = await buildContentExport(PROJECT_ROOT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(readFileSync(path.join(PROJECT_ROOT, CSV_PATH), "utf8")).toBe(result.csv);
    expect(readFileSync(path.join(PROJECT_ROOT, DOC_PATH), "utf8")).toBe(result.doc);
  });
});
