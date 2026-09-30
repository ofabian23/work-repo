import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GraphProvider } from "@/server/email/graph-provider";
import { DevelopmentPreviewProvider } from "@/server/email/preview-provider";
import { createEmailProvider, PREVIEW_FROM, senderFor } from "@/server/email/select-provider";
import { SmtpProvider, smtpTransportOptions } from "@/server/email/smtp-provider";
import { parseServerEnv, type ServerEnv } from "@/server/env";
import { sanitizeEmailError } from "@/server/leads/email-error";
import { startFakeSmtp } from "../../helpers/fake-smtp";

const env = (raw: Record<string, string>): ServerEnv => {
  const result = parseServerEnv(raw);
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.env;
};
const message = {
  to: "maria.rivera@hospital.example",
  from: "Linde Sphere <reportes@sender.test>",
  subject: "Su resumen personalizado de Linde Sphere",
  html: "<p>Hola, María</p>",
  text: "Hola, María",
};

let dir: string | undefined;
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = undefined;
});

describe("provider selection", () => {
  it("defaults to the development preview provider, which never sends externally", () => {
    const provider = createEmailProvider(env({}));
    expect(provider).toBeInstanceOf(DevelopmentPreviewProvider);
    expect(provider.deliversExternally).toBe(false);
    expect(senderFor(env({}))).toEqual({ from: PREVIEW_FROM, replyTo: undefined });
    // The former name "file" still selects the preview provider.
    expect(createEmailProvider(env({ EMAIL_PROVIDER: "file" }))).toBeInstanceOf(DevelopmentPreviewProvider);
  });

  it("selects SMTP from environment variables", () => {
    const provider = createEmailProvider(
      env({
        EMAIL_PROVIDER: "smtp",
        SMTP_HOST: "smtp.example.com",
        SMTP_PORT: "587",
        SMTP_USER: "reports@example.com",
        SMTP_PASS: "dummy-password",
        EMAIL_FROM: "reports@example.com",
      }),
    );
    expect(provider).toBeInstanceOf(SmtpProvider);
    expect(provider.deliversExternally).toBe(true);
  });

  it("rejects Microsoft Graph and unsafe SMTP configuration at startup", () => {
    const issues = (raw: Record<string, string>) => {
      const result = parseServerEnv(raw);
      return result.ok ? [] : result.issues.map((i) => `${i.variable}: ${i.message}`);
    };
    expect(issues({ EMAIL_PROVIDER: "graph" }).join()).toMatch(
      /EMAIL_PROVIDER: Microsoft Graph delivery is not implemented/,
    );
    const smtp = {
      EMAIL_PROVIDER: "smtp",
      SMTP_HOST: "smtp.example.com",
      SMTP_PORT: "587",
      EMAIL_FROM: "a@example.com",
    };
    expect(issues({ ...smtp, SMTP_USER: "user" }).join()).toMatch(/SMTP_PASS/);
    expect(issues({ ...smtp, NODE_ENV: "production", SMTP_REQUIRE_TLS: "false" }).join()).toMatch(
      /SMTP_REQUIRE_TLS/,
    );
    expect(issues({ ...smtp, NODE_ENV: "development", SMTP_REQUIRE_TLS: "false" })).toEqual([]);
  });

  it("never pretends Graph works", async () => {
    const error = await new GraphProvider().send().catch((e: unknown) => e);
    expect(sanitizeEmailError(error)).toEqual({ code: "PROVIDER_NOT_CONFIGURED", retryable: false });
  });
});

describe("SMTP provider", () => {
  it("uses secure transport settings", () => {
    const startTls = smtpTransportOptions({
      host: "smtp.example.com",
      port: 587,
      secure: false,
      requireTls: true,
      user: "u",
      pass: "p",
    });
    expect(startTls).toMatchObject({
      secure: false,
      requireTLS: true,
      ignoreTLS: false,
      auth: { user: "u", pass: "p" },
      tls: { minVersion: "TLSv1.2", rejectUnauthorized: true, servername: "smtp.example.com" },
      disableFileAccess: true,
      disableUrlAccess: true,
    });
    expect(startTls.connectionTimeout).toBeGreaterThan(0);
    const implicit = smtpTransportOptions({
      host: "smtp.example.com",
      port: 465,
      secure: true,
      requireTls: true,
    });
    expect(implicit).toMatchObject({ secure: true, requireTLS: false, auth: undefined });
  });

  it("delivers a MIME message over SMTP (local test server, TLS off outside production)", async () => {
    const smtp = await startFakeSmtp();
    try {
      const provider = new SmtpProvider({
        host: "127.0.0.1",
        port: smtp.port,
        secure: false,
        requireTls: false,
      });
      const { messageId } = await provider.send(message);
      expect(messageId).toMatch(/@/);
      expect(smtp.received).toHaveLength(1);
      expect(smtp.received[0]!.to).toEqual(["<maria.rivera@hospital.example>"]);
      expect(smtp.received[0]!.data).toContain("Subject: Su resumen personalizado de Linde Sphere");
      expect(smtp.received[0]!.data).toContain("multipart/alternative");
    } finally {
      await smtp.close();
    }
  });

  it("refuses to send in the clear when STARTTLS is required but not offered", async () => {
    const smtp = await startFakeSmtp();
    try {
      const provider = new SmtpProvider({
        host: "127.0.0.1",
        port: smtp.port,
        secure: false,
        requireTls: true,
        user: "u",
        pass: "secret-pass",
      });
      const error = await provider.send(message).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(Error);
      expect(smtp.received).toHaveLength(0);
      const sanitized = sanitizeEmailError(error);
      expect(sanitized).toEqual({ code: "TLS_FAILURE", retryable: true });
      expect(JSON.stringify(sanitized)).not.toContain("secret-pass");
    } finally {
      await smtp.close();
    }
  });

  it("passes provider errors up for sanitizing (the outbox stores codes only)", async () => {
    const provider = new SmtpProvider({ host: "h", port: 1, secure: true, requireTls: true }, () => ({
      sendMail: vi.fn(async () => {
        throw Object.assign(new Error("550 maria.rivera@hospital.example unknown user"), {
          responseCode: 550,
        });
      }),
    }));
    const error = await provider.send(message).catch((e: unknown) => e);
    expect(sanitizeEmailError(error)).toEqual({ code: "SMTP_PERMANENT_FAILURE", retryable: false });
  });
});

describe("development preview provider", () => {
  it("writes an inspectable preview (eml, html, txt, index) without sending or leaking data in file names", async () => {
    dir = mkdtempSync(path.join(os.tmpdir(), "linde-preview-"));
    const provider = new DevelopmentPreviewProvider(dir, () => new Date("2026-10-20T14:05:00Z"));
    const { messageId } = await provider.send(message, { deliveryId: "delivery-123" });
    expect(messageId).toBe("preview-2026-10-20T14-05-00-000Z-delivery-123");

    const files = readdirSync(dir).sort();
    expect(files).toEqual([
      "2026-10-20T14-05-00-000Z-delivery-123.eml",
      "2026-10-20T14-05-00-000Z-delivery-123.html",
      "2026-10-20T14-05-00-000Z-delivery-123.txt",
      "index.html",
    ]);
    expect(files.join()).not.toMatch(/maria|hospital/i);
    const eml = readFileSync(path.join(dir, files[0]!), "utf8");
    expect(eml).toContain("To: maria.rivera@hospital.example");
    expect(eml).toContain("Subject: Su resumen personalizado de Linde Sphere");
    expect(readFileSync(path.join(dir, files[1]!), "utf8")).toBe(message.html);
    const index = readFileSync(path.join(dir, "index.html"), "utf8");
    expect(index).toContain('href="2026-10-20T14-05-00-000Z-delivery-123.html"');
    expect(index).not.toContain("maria");
    if (process.platform !== "win32") expect(statSync(path.join(dir, files[1]!)).mode & 0o077).toBe(0);
  });
});
