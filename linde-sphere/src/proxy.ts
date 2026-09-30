import { NextResponse, type NextRequest } from "next/server";
import { isComponentGalleryEnabled } from "@/server/dev-tools";
import { parseServerEnv } from "@/server/env";

/**
 * Runs before rendering (Next 16 proxy, Node.js runtime). Development tools under /dev/* answer a real
 * HTTP 404 in production unless explicitly enabled (ADR-045). The page repeats the check (defense in depth).
 * Admin guards join here in Phase 9.
 */
export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/dev")) {
    const env = parseServerEnv(process.env);
    if (!env.ok || !isComponentGalleryEnabled(env.env)) {
      return new NextResponse("Not Found", {
        status: 404,
        headers: {
          "Cache-Control": "no-store",
          "X-Robots-Tag": "noindex",
          "Content-Type": "text/plain; charset=utf-8",
        },
      });
    }
  }
  return NextResponse.next();
}

export const config = { matcher: ["/dev/:path*"] };
