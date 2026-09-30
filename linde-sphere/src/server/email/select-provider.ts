import "server-only";
import path from "node:path";
import type { ServerEnv } from "@/server/env";
import type { EmailProvider } from "./email-provider";
import { GraphProvider } from "./graph-provider";
import { DevelopmentPreviewProvider } from "./preview-provider";
import { SmtpProvider } from "./smtp-provider";

/** Default sender for local previews only; SMTP requires EMAIL_FROM (env validation). */
export const PREVIEW_FROM = "Linde Sphere <no-reply@example.invalid>";

/** Chooses the provider from validated configuration (ADR-054). */
export function createEmailProvider(env: ServerEnv, projectRoot = process.cwd()): EmailProvider {
  switch (env.EMAIL_PROVIDER) {
    case "smtp":
      return new SmtpProvider({
        host: env.SMTP_HOST!,
        port: env.SMTP_PORT!,
        secure: env.SMTP_SECURE,
        requireTls: env.SMTP_REQUIRE_TLS,
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      });
    case "graph":
      return new GraphProvider();
    case "preview":
      return new DevelopmentPreviewProvider(path.resolve(projectRoot, env.EMAIL_PREVIEW_DIR));
  }
}

export function senderFor(env: ServerEnv): { from: string; replyTo?: string } {
  return { from: env.EMAIL_FROM ?? PREVIEW_FROM, replyTo: env.EMAIL_REPLY_TO };
}
