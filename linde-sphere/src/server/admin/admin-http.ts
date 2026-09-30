import "server-only";
import { isSameOrigin } from "@/server/http/request-guards";
import type { Logger } from "@/server/logging/logger";
import type { AdminConfig } from "./admin-config";
import { parseAdminFilters } from "./admin-filters";
import type { AdminService } from "./admin-service";
import { ADMIN_COOKIE, type AdminSessions, type LoginThrottle } from "./admin-session";
import { verifyPassphrase } from "./passphrase";

/**
 * HTTP handling for the admin utility (ADR-056), separate from the route files so tests can call it.
 * Every state-changing request must come from the same origin (the browser's Origin header) and carry a
 * valid session cookie; form posts answer with 303 redirects whose URLs contain no personal data.
 */
export type AdminHttpContext = {
  config: AdminConfig;
  sessions: AdminSessions;
  throttle: LoginThrottle;
  service: AdminService;
  logger: Logger;
  verify?: (passphrase: string, hash: string) => Promise<boolean>;
};

const NO_STORE = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" };

export function readCookie(header: string | null, name: string): string | null {
  for (const part of (header ?? "").split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

export { isSameOrigin } from "@/server/http/request-guards";

const isHttps = (request: Request) =>
  request.headers.get("x-forwarded-proto") === "https" || new URL(request.url).protocol === "https:";

function sessionCookie(request: Request, config: AdminConfig, token: string, maxAgeSeconds: number) {
  return [
    `${ADMIN_COOKIE}=${token}`,
    `Path=${config.basePath}`,
    "HttpOnly",
    "SameSite=Strict",
    `Max-Age=${maxAgeSeconds}`,
    ...(isHttps(request) ? ["Secure"] : []),
  ].join("; ");
}

const redirect = (location: string, headers: Record<string, string> = {}) =>
  new Response(null, { status: 303, headers: { Location: location, ...NO_STORE, ...headers } });

const forbidden = () => new Response("Forbidden", { status: 403, headers: NO_STORE });
const notFound = () => new Response("Not Found", { status: 404, headers: NO_STORE });

export function hasSession(request: Request, sessions: AdminSessions): boolean {
  return sessions.validate(readCookie(request.headers.get("cookie"), ADMIN_COOKIE));
}

async function formOf(request: Request): Promise<URLSearchParams | null> {
  const type = request.headers.get("content-type") ?? "";
  if (!type.startsWith("application/x-www-form-urlencoded")) return null;
  const text = await request.text();
  return text.length > 4_096 ? null : new URLSearchParams(text);
}

/** Generic 500: never a stack trace or message; the log gets the error's name and code only. */
async function safely(ctx: AdminHttpContext, event: string, run: () => Promise<Response>): Promise<Response> {
  try {
    return await run();
  } catch (error) {
    const e = error as { name?: unknown; code?: unknown };
    ctx.logger.error(event, { errorName: String(e?.name ?? "Error"), errorCode: e?.code ?? null });
    return new Response("Error interno. Vuelva a intentarlo.", {
      status: 500,
      headers: { ...NO_STORE, "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}

/** Wraps a state-changing admin handler: enabled, same origin, signed in, form body, safe errors. */
async function guarded(
  request: Request,
  ctx: AdminHttpContext,
  handle: (form: URLSearchParams) => Promise<Response>,
): Promise<Response> {
  if (!ctx.config.enabled) return notFound();
  if (!isSameOrigin(request)) return forbidden();
  if (!hasSession(request, ctx.sessions)) return redirect(`${ctx.config.basePath}/login`);
  const form = await formOf(request);
  if (!form) return new Response("Bad Request", { status: 400, headers: NO_STORE });
  return safely(ctx, "admin.action_failed", () => handle(form));
}

export async function handleLogin(request: Request, ctx: AdminHttpContext): Promise<Response> {
  const { config, throttle, logger } = ctx;
  if (!config.enabled || !config.passphraseHash) return notFound();
  if (!isSameOrigin(request)) return forbidden();
  const login = `${config.basePath}/login`;
  const lock = throttle.check();
  if (!lock.allowed) {
    logger.warn("admin.login_locked", { retryAfterSeconds: Math.ceil(lock.retryAfterMs / 1000) });
    return redirect(`${login}?error=locked`);
  }
  return safely(ctx, "admin.login_error", () => signIn(request, ctx));
}

async function signIn(request: Request, ctx: AdminHttpContext): Promise<Response> {
  const { config, throttle, sessions, logger } = ctx;
  const login = `${config.basePath}/login`;
  const form = await formOf(request);
  const passphrase = form?.get("passphrase") ?? "";
  const ok =
    passphrase.length > 0 &&
    passphrase.length <= 1_024 &&
    (await (ctx.verify ?? verifyPassphrase)(passphrase, config.passphraseHash!));
  if (!ok) {
    throttle.fail();
    logger.warn("admin.login_failed", {});
    return redirect(`${login}?error=invalid`);
  }
  throttle.succeed();
  const token = sessions.create();
  logger.info("admin.login", {});
  return redirect(config.basePath, {
    "Set-Cookie": sessionCookie(request, config, token, config.sessionMinutes * 60),
  });
}

export async function handleLogout(request: Request, ctx: AdminHttpContext): Promise<Response> {
  if (!ctx.config.enabled) return notFound();
  if (!isSameOrigin(request)) return forbidden();
  ctx.sessions.revoke(readCookie(request.headers.get("cookie"), ADMIN_COOKIE));
  ctx.logger.info("admin.logout", {});
  return redirect(`${ctx.config.basePath}/login`, {
    "Set-Cookie": sessionCookie(request, ctx.config, "", 0),
  });
}

const ID = /^[A-Za-z0-9_-]{1,64}$/;

export function handleRetry(request: Request, ctx: AdminHttpContext): Promise<Response> {
  return guarded(request, ctx, async (form) => {
    const deliveryId = form.get("deliveryId") ?? "";
    const leadId = form.get("leadId") ?? "";
    if (!ID.test(deliveryId) || !ID.test(leadId))
      return new Response("Bad Request", { status: 400, headers: NO_STORE });
    const outcome = await ctx.service.retryDelivery(deliveryId);
    return redirect(`${ctx.config.basePath}/leads/${leadId}?result=retry-${outcome}`);
  });
}

export function handleMarkExported(request: Request, ctx: AdminHttpContext): Promise<Response> {
  return guarded(request, ctx, async (form) => {
    const leadId = form.get("leadId") ?? "";
    if (!ID.test(leadId)) return new Response("Bad Request", { status: 400, headers: NO_STORE });
    const changed = await ctx.service.markExported(leadId);
    return redirect(`${ctx.config.basePath}/leads/${leadId}?result=${changed ? "marked" : "already-marked"}`);
  });
}

const attachment = (filename: string, contentType: string, body: string | Buffer) =>
  new Response(typeof body === "string" ? body : new Uint8Array(body), {
    status: 200,
    headers: {
      ...NO_STORE,
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "X-Content-Type-Options": "nosniff",
    },
  });

/** Exports require an explicit confirmation checkbox (the file holds personal data). */
export function handleExport(request: Request, ctx: AdminHttpContext): Promise<Response> {
  return guarded(request, ctx, async (form) => {
    if (form.get("confirm") !== "yes") return redirect(`${ctx.config.basePath}/exports?error=confirm`);
    const kind = form.get("kind");
    if (kind === "content") {
      const { filename, csv } = ctx.service.contentValidationCsv();
      return attachment(filename, "text/csv; charset=utf-8", csv);
    }
    if (kind !== "leads" && kind !== "interests")
      return new Response("Bad Request", { status: 400, headers: NO_STORE });
    const { filename, csv } = await ctx.service.exportCsv(kind, parseAdminFilters(form), {
      markExported: form.get("markExported") === "yes",
    });
    return attachment(filename, "text/csv; charset=utf-8", csv);
  });
}

export function handleBackup(request: Request, ctx: AdminHttpContext): Promise<Response> {
  return guarded(request, ctx, async (form) => {
    if (form.get("confirm") !== "yes") return redirect(`${ctx.config.basePath}/exports?error=confirm`);
    const { filename, bytes } = await ctx.service.createBackup();
    return attachment(filename, "application/vnd.sqlite3", bytes);
  });
}
