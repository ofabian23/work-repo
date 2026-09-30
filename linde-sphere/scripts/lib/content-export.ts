import { readFileSync } from "node:fs";
import path from "node:path";
import * as prettier from "prettier";
import {
  buildReviewRows,
  renderSalesReviewMarkdown,
  reviewRowsAsTable,
} from "../../src/domain/review/content-review";
import { toCsv } from "../../src/lib/csv";
import { loadContentFromDirectory, type LoadIssue } from "../../src/server/content/load-content";

export const CSV_PATH = "exports/content-validation.csv";
export const DOC_PATH = "CONTENT_VALIDATION.md";
export const BEGIN_MARKER = "<!-- BEGIN GENERATED: sales-review (npm run content:export) -->";
export const END_MARKER = "<!-- END GENERATED: sales-review -->";

export type ExportArtifacts = { ok: true; csv: string; doc: string } | { ok: false; issues: LoadIssue[] };

/** Builds the CSV and the updated CONTENT_VALIDATION.md text from the seed content (no writes). */
export async function buildContentExport(projectRoot: string): Promise<ExportArtifacts> {
  const loaded = loadContentFromDirectory(path.join(projectRoot, "content"), { projectRoot });
  const errors = loaded.issues.filter((i) => i.severity === "error");
  if (!loaded.bundle || errors.length > 0) return { ok: false, issues: errors };

  const csv = toCsv(reviewRowsAsTable(buildReviewRows(loaded.bundle)));

  const docPath = path.join(projectRoot, DOC_PATH);
  const current = readFileSync(docPath, "utf8");
  const start = current.indexOf(BEGIN_MARKER);
  const end = current.indexOf(END_MARKER);
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`${DOC_PATH} must contain the markers ${BEGIN_MARKER} … ${END_MARKER}`);
  }
  const replaced =
    current.slice(0, start + BEGIN_MARKER.length) +
    "\n\n" +
    renderSalesReviewMarkdown(loaded.bundle) +
    "\n" +
    current.slice(end);
  const options = (await prettier.resolveConfig(docPath)) ?? {};
  const doc = await prettier.format(replaced, { ...options, filepath: docPath });
  return { ok: true, csv, doc };
}
