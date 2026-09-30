/**
 * Generates the sales content-validation artifacts from the seed content:
 *   - exports/content-validation.csv      (every content item; blank sales_* columns to fill in)
 *   - CONTENT_VALIDATION.md §11           (Keep / Remove / Rename / Available / Not available /
 *                                          Requires verification / Missing asset / Priority / coverage)
 *
 *   npm run content:export             # write both files
 *   npm run content:export -- --check  # exit 1 if the committed files are out of date
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CSV_PATH, DOC_PATH, buildContentExport } from "./lib/content-export";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const check = process.argv.includes("--check");

async function main(): Promise<void> {
  const result = await buildContentExport(projectRoot);
  if (!result.ok) {
    console.error("Content has errors; run `npm run content:check` first.");
    for (const i of result.issues) console.error(`  ${i.file} ${i.path}: ${i.message}`);
    process.exit(1);
  }

  const targets = [
    { file: CSV_PATH, content: result.csv },
    { file: DOC_PATH, content: result.doc },
  ];

  if (check) {
    const stale = targets.filter(
      ({ file, content }) =>
        !existsSync(path.join(projectRoot, file)) ||
        readFileSync(path.join(projectRoot, file), "utf8") !== content,
    );
    if (stale.length > 0) {
      console.error(`Out of date: ${stale.map((t) => t.file).join(", ")}. Run \`npm run content:export\`.`);
      process.exit(1);
    }
    console.log("✔ Content-validation export is up to date.");
  } else {
    for (const { file, content } of targets) {
      mkdirSync(path.dirname(path.join(projectRoot, file)), { recursive: true });
      writeFileSync(path.join(projectRoot, file), content);
      console.log(`Wrote ${file}`);
    }
  }
}

void main();
