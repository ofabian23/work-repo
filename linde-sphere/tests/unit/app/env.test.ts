import { describe, expect, it } from "vitest";
import { EnvValidationError, parseServerEnv } from "@/server/env";

describe("parseServerEnv", () => {
  it("applies safe defaults for an empty environment", () => {
    const result = parseServerEnv({});
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.env).toMatchObject({
      NODE_ENV: "development",
      CONTENT_MODE: "demo",
      CONTENT_PREVIEW_PLACEHOLDERS: false,
      DATABASE_URL: "file:./data/linde-sphere.db",
      EMAIL_PROVIDER: "preview",
      EMAIL_MAX_ATTEMPTS: 12,
      ADMIN_ENABLED: false,
    });
  });

  it("treats empty strings from .env files as unset", () => {
    const result = parseServerEnv({ CONTENT_MODE: "", SMTP_PORT: "", ADMIN_ENABLED: "" });
    expect(result.ok).toBe(true);
  });

  it("rejects an unknown content mode", () => {
    const result = parseServerEnv({ CONTENT_MODE: "staging" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.map((i) => i.variable)).toContain("CONTENT_MODE");
  });

  it("requires SMTP settings when the SMTP provider is selected", () => {
    const result = parseServerEnv({ EMAIL_PROVIDER: "smtp" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.map((i) => i.variable).sort()).toEqual(["EMAIL_FROM", "SMTP_HOST", "SMTP_PORT"]);
  });

  it("accepts a complete SMTP configuration", () => {
    const result = parseServerEnv({
      EMAIL_PROVIDER: "smtp",
      SMTP_HOST: "smtp.example.org",
      SMTP_PORT: "587",
      SMTP_SECURE: "false",
      EMAIL_FROM: "reports@example.org",
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.env.SMTP_PORT).toBe(587);
  });

  it("requires a passphrase hash (never a plain password) when admin is enabled", () => {
    const missing = parseServerEnv({ ADMIN_ENABLED: "true" });
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.issues[0]?.variable).toBe("ADMIN_PASSPHRASE_HASH");
    const plain = parseServerEnv({
      ADMIN_ENABLED: "true",
      ADMIN_USER: "ops",
      ADMIN_PASSWORD: "long-enough-pass",
    });
    expect(plain.ok).toBe(false);
    if (!plain.ok)
      expect(plain.issues.map((i) => i.variable)).toEqual(
        expect.arrayContaining(["ADMIN_USER", "ADMIN_PASSWORD"]),
      );
  });

  it("forces placeholder preview off in production", () => {
    const result = parseServerEnv({ NODE_ENV: "production", CONTENT_PREVIEW_PLACEHOLDERS: "true" });
    expect(result.ok && result.env.CONTENT_PREVIEW_PLACEHOLDERS).toBe(false);
    const dev = parseServerEnv({ NODE_ENV: "development", CONTENT_PREVIEW_PLACEHOLDERS: "true" });
    expect(dev.ok && dev.env.CONTENT_PREVIEW_PLACEHOLDERS).toBe(true);
  });

  it("rejects non-SQLite database URLs", () => {
    const result = parseServerEnv({ DATABASE_URL: "postgres://user:secret@host/db" });
    expect(result.ok).toBe(false);
  });

  it("never includes variable values in error messages", () => {
    const secret = "sup3r-secret-value";
    const result = parseServerEnv({
      DATABASE_URL: `postgres://admin:${secret}@db`,
      ADMIN_ENABLED: "true",
      ADMIN_PASSPHRASE_HASH: "tiny",
      SMTP_PORT: secret,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const message = new EnvValidationError(result.issues).message;
    expect(message).not.toContain(secret);
    expect(message).not.toContain("tiny");
    expect(message).toContain("DATABASE_URL");
    expect(message).toContain(".env.example");
  });

  it("defaults the follow-up strategy to LOCAL_PACKAGE (no email), configured only by FOLLOW_UP_MODE", () => {
    const empty = parseServerEnv({});
    expect(empty.ok && empty.env.FOLLOW_UP_MODE).toBe("LOCAL_PACKAGE");
    const blank = parseServerEnv({ FOLLOW_UP_MODE: "" });
    expect(blank.ok && blank.env.FOLLOW_UP_MODE).toBe("LOCAL_PACKAGE");
    // A complete SMTP configuration does not turn email on by itself: the mode decides.
    const smtpReady = parseServerEnv({
      EMAIL_PROVIDER: "smtp",
      SMTP_HOST: "smtp.example.test",
      SMTP_PORT: "587",
      EMAIL_FROM: "reports@example.test",
    });
    expect(smtpReady.ok && smtpReady.env.FOLLOW_UP_MODE).toBe("LOCAL_PACKAGE");
    const email = parseServerEnv({ FOLLOW_UP_MODE: "SMTP_EMAIL" });
    expect(email.ok && email.env.FOLLOW_UP_MODE).toBe("SMTP_EMAIL");
  });

  it("refuses follow-up modes that are recognized but not implemented, with the reason", () => {
    for (const [mode, reason] of [
      ["MICROSOFT_GRAPH", /not implemented/],
      ["OUTLOOK_DRAFT", /not implemented/],
      ["FUTURE_CRM", /reserved/],
    ] as const) {
      const result = parseServerEnv({ FOLLOW_UP_MODE: mode });
      expect(result.ok, mode).toBe(false);
      if (result.ok) continue;
      const issue = result.issues.find((i) => i.variable === "FOLLOW_UP_MODE");
      expect(issue?.message, mode).toMatch(reason);
    }
    const unknown = parseServerEnv({ FOLLOW_UP_MODE: "email" });
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) expect(unknown.issues[0]!.message).toMatch(/LOCAL_PACKAGE, SMTP_EMAIL/);
  });

  it("leaves lead retention undecided by default (placeholder, no invented policy)", () => {
    const result = parseServerEnv({});
    expect(result.ok && result.env.LEAD_RETENTION_DAYS).toBeUndefined();
    const set = parseServerEnv({ LEAD_RETENTION_DAYS: "180" });
    expect(set.ok && set.env.LEAD_RETENTION_DAYS).toBe(180);
    expect(parseServerEnv({ LEAD_RETENTION_DAYS: "0" }).ok).toBe(false);
    expect(parseServerEnv({ LEAD_RETENTION_DAYS: "forever" }).ok).toBe(false);
  });
});
