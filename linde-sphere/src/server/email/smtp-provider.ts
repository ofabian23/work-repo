import "server-only";
import nodemailer from "nodemailer";
import type { EmailMessage, EmailProvider } from "./email-provider";

/**
 * SMTP delivery (ADR-054). Configuration comes only from server environment variables (`env.ts`, never
 * sent to the client). Transport security:
 * - SMTP_SECURE=true: implicit TLS (usually port 465);
 * - otherwise STARTTLS is required (usually port 587) and the connection fails rather than sending in the
 *   clear — `SMTP_REQUIRE_TLS=false` is refused in production by env validation;
 * - TLS 1.2 or newer, certificates always verified; connection, greeting and socket timeouts;
 * - message building cannot read local files or fetch URLs.
 */
export type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  requireTls: boolean;
  user?: string;
  pass?: string;
};

export function smtpTransportOptions(config: SmtpConfig) {
  return {
    host: config.host,
    port: config.port,
    secure: config.secure,
    requireTLS: !config.secure && config.requireTls,
    ignoreTLS: !config.secure && !config.requireTls,
    auth: config.user && config.pass ? { user: config.user, pass: config.pass } : undefined,
    tls: { minVersion: "TLSv1.2" as const, rejectUnauthorized: true, servername: config.host },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
    disableFileAccess: true,
    disableUrlAccess: true,
  };
}

type Transport = { sendMail: (mail: EmailMessage) => Promise<{ messageId?: string }> };

export class SmtpProvider implements EmailProvider {
  readonly name = "smtp" as const;
  readonly deliversExternally = true;
  private readonly transport: Transport;

  constructor(
    config: SmtpConfig,
    createTransport: (options: ReturnType<typeof smtpTransportOptions>) => Transport = (o) =>
      nodemailer.createTransport(o),
  ) {
    this.transport = createTransport(smtpTransportOptions(config));
  }

  async send(message: EmailMessage) {
    const info = await this.transport.sendMail(message);
    return { messageId: info.messageId ?? "smtp-unknown" };
  }
}
