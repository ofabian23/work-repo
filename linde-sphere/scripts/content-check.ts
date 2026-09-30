/**
 * Validates all Linde Sphere content files.
 *
 *   npm run content:check                      # demo mode (default)
 *   npm run content:check -- --mode production # also enforce production readiness
 *   npm run content:check -- --strict          # treat warnings as errors
 *
 * Exit code 0 = valid, 1 = errors found, 2 = invalid arguments.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ContentModeSchema, VALIDATION_STATUSES, type ContentMode } from "../src/domain/content/primitives";
import { visibleContent } from "../src/domain/content/visibility";
import { loadContentFromDirectory, type LoadIssue } from "../src/server/content/load-content";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs(argv: string[]): { mode: ContentMode; strict: boolean } {
  let mode: ContentMode = "demo";
  let strict = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--strict") strict = true;
    else if (arg === "--mode" || arg?.startsWith("--mode=")) {
      const value = arg === "--mode" ? argv[++i] : arg.slice("--mode=".length);
      const parsed = ContentModeSchema.safeParse(value);
      if (!parsed.success) {
        console.error(`Invalid --mode '${value}'. Use 'demo' or 'production'.`);
        process.exit(2);
      }
      mode = parsed.data;
    } else {
      console.error(`Unknown argument '${arg}'.`);
      process.exit(2);
    }
  }
  return { mode, strict };
}

const { mode, strict } = parseArgs(process.argv.slice(2));
const result = loadContentFromDirectory(path.join(projectRoot, "content"), {
  publicDir: path.join(projectRoot, "public"),
  projectRoot,
});
const issues: LoadIssue[] = [...result.issues];

// ---- Production readiness -------------------------------------------------------------------
if (result.bundle && mode === "production") {
  const pub = visibleContent(result.bundle, "production");
  const readiness = (message: string) =>
    issues.push({ severity: "error", file: "content", path: "", message: `[production] ${message}` });
  if (pub.personas.length === 0) readiness("No validated personas; the 'I work in…' path would be empty");
  if (pub.challenges.length === 0) readiness("No validated challenges; the 'I need to…' path would be empty");
  if (pub.scenes.length === 0) readiness("No validated scenes; the hospital explorer would be empty");
  if (!pub.solutions.some((s) => s.isFallback)) readiness("The fallback solution is not validated");
  if (pub.recommendationRules.length === 0)
    readiness("No validated rule with a validated solution; only the fallback could be recommended");
  if (result.bundle.consent.validationStatus !== "validated")
    readiness("Consent text is not validated by legal/compliance");
  if (result.bundle.report.validationStatus !== "validated")
    readiness("Report copy (content/report.json) is not validated by marketing/legal");
  if (result.bundle.report.salesContact === null)
    readiness("No sales contact is configured for the report (content/report.json)");
}

// ---- Report ---------------------------------------------------------------------------------
const byFile = new Map<string, LoadIssue[]>();
for (const issue of issues) byFile.set(issue.file, [...(byFile.get(issue.file) ?? []), issue]);

const errors = issues.filter((i) => i.severity === "error");
const warnings = issues.filter((i) => i.severity === "warning");

console.log(`\nLinde Sphere content check — mode: ${mode}${strict ? " (strict)" : ""}`);
console.log(`Files read: ${result.filesRead.length}\n`);

for (const [file, fileIssues] of [...byFile].sort(([a], [b]) => a.localeCompare(b))) {
  console.log(file);
  for (const i of fileIssues) {
    const tag = i.severity === "error" ? "  ✖ error  " : "  ⚠ warning";
    console.log(`${tag} ${i.path ? `${i.path}: ` : ""}${i.message}`);
  }
  console.log("");
}

if (result.bundle) {
  const b = result.bundle;
  const count = (items: { validationStatus: string }[]) =>
    VALIDATION_STATUSES.map((s) => `${s} ${items.filter((i) => i.validationStatus === s).length}`).join(
      " · ",
    );
  console.log(`Content version ${b.manifest.contentVersion}`);
  console.log("Validation status summary:");
  console.log(`  personas             ${count(b.personas)}`);
  console.log(`  challenges           ${count(b.challenges)}`);
  console.log(`  facility types       ${count(b.facilityTypes)}`);
  console.log(`  scenes               ${count(b.scenes)}`);
  console.log(`  hotspots             ${count(b.scenes.flatMap((s) => s.hotspots))}`);
  console.log(`  solutions            ${count(b.solutions)}`);
  console.log(`  digital assets       ${count(b.digitalAssets)}`);
  console.log(`  recommendation rules ${count(b.recommendationRules)}`);
  console.log(`  consent text         ${b.consent.validationStatus}`);
  console.log(`  report copy          ${b.report.validationStatus}`);
  const pending = b.solutions.filter((s) => s.requiresSalesValidation).length;
  console.log(`  solutions requiring Puerto Rico sales validation: ${pending}/${b.solutions.length}`);
  const visible = visibleContent(b, mode);
  console.log(
    `Visible in ${mode} mode: ${visible.solutions.length} solutions, ${visible.scenes.length} scenes, ` +
      `${visible.recommendationRules.length} rules\n`,
  );
}

const failed = errors.length > 0 || (strict && warnings.length > 0);
console.log(
  `${failed ? "✖ FAILED" : "✔ PASSED"} — ${errors.length} error(s), ${warnings.length} warning(s)\n`,
);
process.exit(failed ? 1 : 0);
