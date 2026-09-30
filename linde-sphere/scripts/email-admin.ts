/**
 * Local email administration (ADR-024, ADR-054). Runs on the kiosk laptop only — there is no web route
 * for these actions — and prints ids, counters and error codes, never contact data or message content.
 *
 *   npm run email:status                        # deliveries by status + those needing attention
 *   npm run email:retry -- --delivery <id>      # one immediate attempt for one delivery
 *   npm run email:retry -- --all-failed         # one immediate attempt for every failed delivery
 *   npm run email:preview                       # synthetic sample reports (ES and EN) for design review
 *
 * Reads the same configuration as the server (.env in the project root, then the shell environment).
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { visibleContent } from "../src/domain/content/visibility";
import { recommend } from "../src/domain/recommendations/engine";
import { recommendationEvidence } from "../src/domain/recommendations/recommendation-stability";
import { EMPTY_SIGNALS } from "../src/domain/session/visitor-session";
import { loadContentFromDirectory } from "../src/server/content/load-content";
import { createDatabase } from "../src/server/db/client";
import { createEmailOutbox } from "../src/server/email/email-outbox";
import { createEmailProvider, senderFor } from "../src/server/email/select-provider";
import { EnvValidationError, parseServerEnv } from "../src/server/env";
import {
  createPrismaEmailDeliveryRepository,
  defaultRetryDelayMs,
} from "../src/server/leads/email-delivery-repository";
import { createLogger } from "../src/server/logging/logger";
import { buildReportPayload } from "../src/server/report/build-report-payload";
import { renderReport } from "../src/server/report/render-report";

const projectRoot = process.cwd();
if (existsSync(path.join(projectRoot, ".env"))) process.loadEnvFile(path.join(projectRoot, ".env"));

const envResult = parseServerEnv(process.env);
if (!envResult.ok) {
  console.error(new EnvValidationError(envResult.issues).message);
  process.exit(2);
}
const env = envResult.env;
const [command, ...args] = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(name);
  return i > -1 ? (args[i + 1] ?? "") : undefined;
};

async function withOutbox<T>(fn: (ctx: ReturnType<typeof setup>) => Promise<T>): Promise<T> {
  const ctx = setup();
  try {
    return await fn(ctx);
  } finally {
    await ctx.db.$disconnect();
  }
}

function setup() {
  const db = createDatabase(env.DATABASE_URL, projectRoot);
  const deliveries = createPrismaEmailDeliveryRepository(db);
  const outbox = createEmailOutbox({
    deliveries,
    provider: createEmailProvider(env, projectRoot),
    sender: senderFor(env),
    maxAttempts: env.EMAIL_MAX_ATTEMPTS,
    retryDelayMs: defaultRetryDelayMs,
    logger: createLogger({ minLevel: "warn" }),
  });
  return { db, deliveries, outbox };
}

const fmt = (d: Date | null) => (d ? d.toISOString() : "—");

async function status() {
  await withOutbox(async ({ deliveries }) => {
    const { counts, attention } = await deliveries.overview();
    console.log(`Provider: ${env.EMAIL_PROVIDER} · max attempts: ${env.EMAIL_MAX_ATTEMPTS}`);
    console.log(
      `pending ${counts.pending} · retrying ${counts.retrying} · sent ${counts.sent} · failed ${counts.failed}`,
    );
    if (attention.length === 0) return console.log("Nothing needs attention.");
    console.log("\nNeeds attention (id · status · attempts · error code · last attempt · next attempt):");
    for (const d of attention) {
      console.log(
        `  ${d.id} · ${d.status} · ${d.attempts} · ${d.errorCode ?? "—"} · ${fmt(d.lastAttemptAt)} · ${fmt(d.nextAttemptAt)}`,
      );
    }
  });
}

async function retry() {
  const id = flag("--delivery");
  const allFailed = args.includes("--all-failed");
  if (!id && !allFailed) {
    console.error("Use --delivery <id> or --all-failed.");
    process.exit(2);
  }
  await withOutbox(async ({ deliveries, outbox }) => {
    const ids = id ? [id] : await deliveries.findIdsByStatus("failed");
    if (ids.length === 0) return console.log("No failed deliveries.");
    for (const deliveryId of ids) {
      const outcome = await outbox.processDelivery(deliveryId, { manual: true });
      console.log(
        `${deliveryId}: ${outcome === "skipped" ? "skipped (already sent, being sent, or unknown id)" : outcome}`,
      );
    }
  });
}

function preview() {
  const loaded = loadContentFromDirectory(path.join(projectRoot, "content"));
  if (!loaded.bundle) throw new Error("Content failed to load; run npm run content:check");
  const content = visibleContent(loaded.bundle, env.CONTENT_MODE);
  const signals = {
    ...EMPTY_SIGNALS,
    personaId: content.personas[0]?.id ?? null,
    challengeIds: content.challenges.slice(0, 2).map((c) => c.id),
    visitedSceneIds: content.scenes.slice(0, 2).map((s) => s.id),
  };
  const result = recommend(recommendationEvidence(signals, content.scenes), content);
  const dir = path.resolve(projectRoot, env.EMAIL_PREVIEW_DIR);
  mkdirSync(dir, { recursive: true });
  for (const language of ["es", "en"] as const) {
    const payload = buildReportPayload({
      leadId: "sample",
      generatedAt: new Date(),
      language,
      visitor: { firstName: "Ana", lastName: "Ejemplo", organization: "Hospital de Demostración (ficticio)" },
      roleId: signals.personaId ?? "",
      priorityIds: signals.challengeIds,
      exploredSceneIds: signals.visitedSceneIds,
      result,
      content,
    });
    const rendered = renderReport(payload);
    writeFileSync(path.join(dir, `sample-${language}.html`), rendered.html);
    writeFileSync(path.join(dir, `sample-${language}.txt`), rendered.text);
    console.log(`Sample report (${language}, synthetic data): ${path.join(dir, `sample-${language}.html`)}`);
  }
}

async function main() {
  if (command === "status") return status();
  if (command === "retry") return retry();
  if (command === "preview") return preview();
  console.error("Usage: email-admin <status | retry --delivery <id> | retry --all-failed | preview>");
  process.exit(2);
}

main().catch((error: unknown) => {
  console.error(`Email admin failed: ${error instanceof Error ? error.name : "Error"}`);
  process.exit(1);
});
