import "server-only";

/**
 * Application logger that never writes full contact records (ADR-052). Every context object passes through
 * `maskFields`: known personal keys are masked (email → "m***@hospital.example", names → "M.", phone → last
 * two digits), unknown string values that look like an email address are masked too, and nested objects are
 * masked recursively. Log lines are single-line JSON so they are easy to grep and to ship.
 */
export type LogLevel = "debug" | "info" | "warn" | "error";
export type LogContext = Record<string, unknown>;
export type Logger = Record<LogLevel, (event: string, context?: LogContext) => void>;

const EMAIL_PATTERN = /[^\s@"'<>]+@[^\s@"'<>]+\.[^\s@"'<>]+/g;

export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at < 1) return "***";
  return `${email[0]}***@${email.slice(at + 1)}`;
}

export function maskName(name: string): string {
  const first = name.trim()[0];
  return first ? `${first.toUpperCase()}.` : "***";
}

export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 2 ? `***${digits.slice(-2)}` : "***";
}

type Masker = (value: string) => string;
const redact: Masker = () => "[redacted]";

/** Keys (case-insensitive, without separators) whose values are personal data. */
const PERSONAL_KEYS: Record<string, Masker> = {
  email: maskEmail,
  businessemail: maskEmail,
  firstname: maskName,
  lastname: maskName,
  name: maskName,
  fullname: maskName,
  phone: maskPhone,
  optionalphone: maskPhone,
  organization: redact,
  // Secrets and capabilities are never logged, not even partially.
  statustoken: redact,
  idempotencykey: redact,
  password: redact,
  smtppass: redact,
  authorization: redact,
  token: redact,
};

const normalizeKey = (key: string) => key.toLowerCase().replace(/[^a-z]/g, "");

export function maskFields(value: unknown, depth = 0): unknown {
  if (depth > 5) return "[truncated]";
  if (typeof value === "string") return value.replace(EMAIL_PATTERN, maskEmail);
  if (Array.isArray(value)) return value.map((v) => maskFields(v, depth + 1));
  if (value instanceof Error) return { name: value.name, code: (value as { code?: unknown }).code };
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, v]) => {
        const masker = PERSONAL_KEYS[normalizeKey(key)];
        if (masker) return [key, v === null || v === undefined ? v : masker(String(v))];
        return [key, maskFields(v, depth + 1)];
      }),
    );
  }
  return value;
}

export type LogSink = (level: LogLevel, line: string) => void;

const consoleSink: LogSink = (level, line) => {
  (level === "error" ? console.error : level === "warn" ? console.warn : console.log)(line);
};

export function createLogger({
  sink = consoleSink,
  now = () => new Date(),
  minLevel = process.env.NODE_ENV === "test" ? "warn" : "info",
}: { sink?: LogSink; now?: () => Date; minLevel?: LogLevel } = {}): Logger {
  const order: LogLevel[] = ["debug", "info", "warn", "error"];
  const write =
    (level: LogLevel) =>
    (event: string, context: LogContext = {}) => {
      if (order.indexOf(level) < order.indexOf(minLevel)) return;
      const masked = maskFields(context) as LogContext;
      sink(level, JSON.stringify({ time: now().toISOString(), level, event, ...masked }));
    };
  return { debug: write("debug"), info: write("info"), warn: write("warn"), error: write("error") };
}

export const logger = createLogger();
