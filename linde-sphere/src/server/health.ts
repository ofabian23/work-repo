import "server-only";
import path from "node:path";
import { loadContentFromDirectory } from "@/server/content/load-content";
import { probeSqliteDatabase } from "@/server/database-probe";
import { parseServerEnv } from "@/server/env";
import { appConfig } from "@/lib/config/app-config";
import { brandConfig } from "@/lib/config/brand-config";
import type { HealthReport } from "@/types/health";

const startedAt = Date.now();

/**
 * Aggregates readiness without exposing secrets: invalid configuration is reported by variable name
 * only, and database details are limited to a status and a reason code.
 */
export function getHealthReport({
  rawEnv = process.env,
  projectRoot = process.cwd(),
}: { rawEnv?: Record<string, string | undefined>; projectRoot?: string } = {}): HealthReport {
  const envResult = parseServerEnv(rawEnv);
  const env = envResult.ok ? envResult.env : null;

  const content = loadContentFromDirectory(path.join(projectRoot, "content"), { projectRoot });
  const contentErrors = content.issues.filter((i) => i.severity === "error").length;

  const database = env
    ? probeSqliteDatabase(env.DATABASE_URL, projectRoot)
    : { status: "unavailable" as const, reason: "configuration_invalid" };

  const configValid = envResult.ok;
  const contentValid = content.bundle !== null && contentErrors === 0;
  const hardFailure = !configValid || !contentValid || database.status === "unavailable";
  const ready = configValid && contentValid && database.status === "ready";

  return {
    status: hardFailure ? "error" : ready ? "ok" : "degraded",
    ready,
    timestamp: new Date().toISOString(),
    app: {
      name: brandConfig.productName,
      version: appConfig.version,
      environment: env?.NODE_ENV ?? "unknown",
      contentMode: env?.CONTENT_MODE ?? null,
      uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
    },
    configuration: {
      status: configValid ? "valid" : "invalid",
      invalidVariables: envResult.ok ? [] : [...new Set(envResult.issues.map((i) => i.variable))],
    },
    content: {
      status: content.bundle
        ? contentValid
          ? "valid"
          : "invalid"
        : contentErrors > 0
          ? "invalid"
          : "unknown",
      version: content.bundle?.manifest.contentVersion ?? null,
      errorCount: contentErrors,
    },
    database: { status: database.status, engine: "sqlite", reason: database.reason },
    email: {
      provider: env?.EMAIL_PROVIDER ?? null,
      deliversExternally: env ? env.EMAIL_PROVIDER !== "preview" : null,
    },
  };
}
