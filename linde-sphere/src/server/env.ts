import "server-only";
import { z } from "zod";
import { ContentModeSchema } from "@/domain/content/primitives";

/**
 * Server environment, validated once at boot (instrumentation.ts) and on first use.
 * Class C4 (secrets) lives only here. Nothing in this module is ever sent to the client, and
 * validation errors name the offending variables without echoing their values.
 */

/** Treat `KEY=` (empty) in .env files as "not set". */
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), schema.optional());

const booleanFlag = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z
    .enum(["true", "false", "1", "0"], { error: "Use true or false" })
    .optional()
    .transform((v) => v === "true" || v === "1"),
);

const ServerEnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    CONTENT_MODE: optional(ContentModeSchema).transform((v) => v ?? "demo"),
    CONTENT_PREVIEW_PLACEHOLDERS: booleanFlag,
    DATABASE_URL: optional(
      z.string().regex(/^file:.+/, { error: "Must be a SQLite file URL, e.g. file:./data/linde-sphere.db" }),
    ).transform((v) => v ?? "file:./data/linde-sphere.db"),
    /**
     * preview (default): DevelopmentPreviewProvider, writes local files, never sends · smtp: real delivery.
     * "file" is accepted as the former name of "preview". "graph" is reserved and rejected (ADR-054).
     */
    EMAIL_PROVIDER: optional(
      z.enum(["preview", "file", "smtp", "graph"], { error: "Use preview or smtp" }),
    ).transform((v) => (v === undefined || v === "file" ? "preview" : v)),
    EMAIL_FROM: optional(z.email({ error: "Must be an email address" })),
    EMAIL_REPLY_TO: optional(z.email({ error: "Must be an email address" })),
    SMTP_HOST: optional(z.string().min(1)),
    SMTP_PORT: optional(z.coerce.number().int().min(1).max(65535)),
    SMTP_SECURE: booleanFlag,
    SMTP_USER: optional(z.string().min(1)),
    SMTP_PASS: optional(z.string().min(1)),
    /**
     * With SMTP_SECURE=false the connection must upgrade with STARTTLS (default true). Only a local test
     * mail server outside production may turn this off.
     */
    SMTP_REQUIRE_TLS: z
      .preprocess(
        (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
        z.enum(["true", "false", "1", "0"], { error: "Use true or false" }).optional(),
      )
      .transform((v) => v === undefined || v === "true" || v === "1"),
    /** Where the development preview provider writes emails (relative to the project root). */
    EMAIL_PREVIEW_DIR: optional(z.string().min(1).max(200)).transform((v) => v ?? "data/email-preview"),
    /** How often the email worker looks for deliveries that are due (retries). */
    EMAIL_WORKER_INTERVAL_MS: optional(z.coerce.number().int().min(1_000).max(3_600_000)).transform(
      (v) => v ?? 15_000,
    ),
    EMAIL_MAX_ATTEMPTS: optional(z.coerce.number().int().min(1).max(50)).transform((v) => v ?? 12),
    /**
     * Kiosk inactivity (ADR-055), in seconds. Unset = defaults in app-config.ts (60 s + 15 s warning;
     * 120 s + 20 s on the contact form; 15 s on the completion screen). Read on every page load, so the
     * event team can tune them without rebuilding.
     */
    KIOSK_IDLE_WARNING_SECONDS: optional(z.coerce.number().int().min(10).max(3600)),
    KIOSK_IDLE_COUNTDOWN_SECONDS: optional(z.coerce.number().int().min(5).max(300)),
    KIOSK_FORM_IDLE_WARNING_SECONDS: optional(z.coerce.number().int().min(30).max(3600)),
    KIOSK_FORM_IDLE_COUNTDOWN_SECONDS: optional(z.coerce.number().int().min(5).max(300)),
    KIOSK_COMPLETION_SECONDS: optional(z.coerce.number().int().min(5).max(300)),
    ADMIN_ENABLED: booleanFlag,
    /**
     * Retention placeholder (ADR-052). The company's lead-retention policy is not decided yet: unset means
     * "no automatic deletion configured", never a default period. Nothing deletes data automatically.
     */
    LEAD_RETENTION_DAYS: optional(z.coerce.number().int().min(1).max(3650)),
    /** Dev-only component gallery at /dev/components; in production it is disabled unless this is true. */
    ENABLE_COMPONENT_GALLERY: booleanFlag,
    /** Dev-only scene coordinate calibration at /dev/scenes; in production it is disabled unless this is true. */
    ENABLE_SCENE_CALIBRATION: booleanFlag,
    ADMIN_USER: optional(z.string().min(3)),
    ADMIN_PASSWORD: optional(z.string().min(12, { error: "Must be at least 12 characters" })),
  })
  .superRefine((env, ctx) => {
    const require = (key: keyof typeof env, reason: string) => {
      if (env[key] === undefined)
        ctx.addIssue({ code: "custom", path: [key], message: `Required ${reason}` });
    };
    if (env.EMAIL_PROVIDER === "graph") {
      ctx.addIssue({
        code: "custom",
        path: ["EMAIL_PROVIDER"],
        message:
          "Microsoft Graph delivery is not implemented; it needs an organizational app registration " +
          "(tenant, client id, Mail.Send permission). Use preview or smtp",
      });
    }
    if (env.EMAIL_PROVIDER === "smtp") {
      require("SMTP_HOST", "when EMAIL_PROVIDER=smtp");
      require("SMTP_PORT", "when EMAIL_PROVIDER=smtp");
      require("EMAIL_FROM", "when EMAIL_PROVIDER=smtp");
      if ((env.SMTP_USER === undefined) !== (env.SMTP_PASS === undefined)) {
        ctx.addIssue({
          code: "custom",
          path: [env.SMTP_USER ? "SMTP_PASS" : "SMTP_USER"],
          message: "Set both SMTP_USER and SMTP_PASS, or neither",
        });
      }
      if (!env.SMTP_REQUIRE_TLS && !env.SMTP_SECURE && env.NODE_ENV === "production") {
        ctx.addIssue({
          code: "custom",
          path: ["SMTP_REQUIRE_TLS"],
          message: "Unencrypted SMTP is not allowed in production; use SMTP_SECURE=true or STARTTLS",
        });
      }
    }
    if (env.ADMIN_ENABLED) {
      require("ADMIN_USER", "when ADMIN_ENABLED=true");
      require("ADMIN_PASSWORD", "when ADMIN_ENABLED=true");
    }
  })
  .transform((env) => ({
    ...env,
    // Placeholder preview is a development aid only; it can never be enabled in production builds.
    CONTENT_PREVIEW_PLACEHOLDERS: env.NODE_ENV !== "production" && env.CONTENT_PREVIEW_PLACEHOLDERS,
  }));

export type ServerEnv = z.output<typeof ServerEnvSchema>;

export type EnvIssue = { variable: string; message: string };

export class EnvValidationError extends Error {
  constructor(readonly issues: EnvIssue[]) {
    super(
      `Invalid environment configuration:\n${issues.map((i) => `  - ${i.variable}: ${i.message}`).join("\n")}\n` +
        "See .env.example for the expected variables.",
    );
    this.name = "EnvValidationError";
  }
}

/** Pure parser (testable). Never includes variable values in errors. */
export function parseServerEnv(
  raw: Record<string, string | undefined>,
): { ok: true; env: ServerEnv } | { ok: false; issues: EnvIssue[] } {
  const result = ServerEnvSchema.safeParse(raw);
  if (result.success) return { ok: true, env: result.data };
  return {
    ok: false,
    issues: result.error.issues.map((i) => ({
      variable: String(i.path[0] ?? "(environment)"),
      message: i.message,
    })),
  };
}

let cached: ServerEnv | undefined;

/** Validated environment for server code. Throws `EnvValidationError` on invalid configuration. */
export function getServerEnv(): ServerEnv {
  if (cached) return cached;
  const result = parseServerEnv(process.env);
  if (!result.ok) throw new EnvValidationError(result.issues);
  cached = result.env;
  return cached;
}
