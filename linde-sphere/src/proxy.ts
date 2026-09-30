import { NextResponse, type NextRequest } from "next/server";
import { adminConfig, isInternalAdminPath, toInternalAdminPath } from "@/server/admin/admin-config";
import { isDevToolPathEnabled } from "@/server/dev-tools";
import { isAllowedHost } from "@/server/http/request-guards";
import { parseServerEnv } from "@/server/env";

/**
 * Runs before rendering (Next 16 proxy, Node.js runtime).
 * - Development tools under /dev/* answer a real HTTP 404 in production unless explicitly enabled
 *   (ADR-045, ADR-049). The page repeats the check (defense in depth).
 * - Host allowlist (ADR-057): loopback, private LAN addresses, *.local and ALLOWED_HOSTS only.
 * - Local administration (ADR-056): the configured ADMIN_PATH is rewritten to the internal
 *   /admin-console segment when admin is enabled; the internal path itself always answers 404, so the
 *   pages can only be reached through the configured path. Admin responses are never cached or indexed.
 */
const notFound = () =>
  new NextResponse("Not Found", {
    status: 404,
    headers: {
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
      "Content-Type": "text/plain; charset=utf-8",
    },
  });

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const env = parseServerEnv(process.env);

  // Only answer to local names and addresses (ADR-057): blocks DNS rebinding from public web pages.
  if (!isAllowedHost(request.headers.get("host"), env.ok ? env.env.ALLOWED_HOSTS : [])) {
    return new NextResponse("Misdirected Request", {
      status: 421,
      headers: { "Cache-Control": "no-store", "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  if (isInternalAdminPath(pathname)) return notFound();

  if (env.ok) {
    const admin = adminConfig(env.env);
    const internal = admin.enabled ? toInternalAdminPath(pathname, admin.basePath) : null;
    if (internal) {
      const url = request.nextUrl.clone();
      url.pathname = internal;
      const response = NextResponse.rewrite(url);
      response.headers.set("Cache-Control", "no-store");
      response.headers.set("X-Robots-Tag", "noindex, nofollow");
      response.headers.set("Referrer-Policy", "no-referrer");
      return response;
    }
  }

  if (pathname.startsWith("/dev")) {
    if (!env.ok || !isDevToolPathEnabled(pathname, env.env)) return notFound();
  }
  return NextResponse.next();
}

// Every page and route except static assets: the admin path is configurable, so it cannot be listed here.
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|assets/).*)"] };
