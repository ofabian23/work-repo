/**
 * Request guards for a kiosk that runs on a trusted local network (ADR-057). Pure functions (no
 * `server-only`) so the proxy and route handlers share them.
 */

/**
 * Hosts the app answers to: loopback, private IPv4 ranges (the laptop's hotspot or LAN address), `.local`
 * names, and any extra names in ALLOWED_HOSTS. Rejecting other Host headers blocks DNS-rebinding attacks,
 * where a public web page tries to reach the kiosk server through a hostname it controls.
 */
export function isAllowedHost(hostHeader: string | null, extraHosts: readonly string[] = []): boolean {
  if (!hostHeader) return false;
  const host = hostHeader
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, "")
    .replace(/^\[|\]$/g, "");
  if (!host) return false;
  if (host === "localhost" || host === "127.0.0.1" || host === "::1" || host.endsWith(".localhost"))
    return true;
  if (extraHosts.some((h) => h.trim().toLowerCase() === host)) return true;
  if (host.endsWith(".local")) return true;
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!ipv4) return false;
  const [a, b] = ipv4.slice(1).map(Number) as [number, number];
  return a === 10 || a === 127 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31);
}

/**
 * Blocks cross-site form posts and scripted cross-origin requests (CSRF): the Origin (or Referer) must
 * match the Host. Because the site sends `Referrer-Policy: no-referrer`, browsers submit same-origin forms
 * with `Origin: null`; then the browser-controlled `Sec-Fetch-Site: same-origin` header is accepted.
 */
export function isSameOrigin(request: Request): boolean {
  const host = request.headers.get("host");
  if (!host) return false;
  const source = request.headers.get("origin") ?? request.headers.get("referer");
  if (source && source !== "null") {
    try {
      return new URL(source).host === host;
    } catch {
      return false;
    }
  }
  return request.headers.get("sec-fetch-site") === "same-origin";
}

/** Client address as seen by the Node server (Next fills x-forwarded-for from the socket when absent). */
export function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for") ?? "";
  return forwarded.split(",")[0]?.trim().slice(0, 64) || "unknown";
}

/**
 * Fixed-window rate limiter, in memory: `perClient` requests per window for each client address and
 * `global` for everyone together (the address can be spoofed on a LAN, the global cap cannot). Sized for a
 * single kiosk plus the operator's laptop; it only needs to stop runaway loops and casual abuse.
 */
export function createRateLimiter({
  windowMs,
  perClient,
  global,
  now = () => Date.now(),
}: {
  windowMs: number;
  perClient: number;
  global: number;
  now?: () => number;
}) {
  let windowStart = now();
  let total = 0;
  const counts = new Map<string, number>();
  return {
    /** Records one request; returns false (and the seconds to wait) when a limit is exceeded. */
    take(key: string): { allowed: boolean; retryAfterSeconds: number } {
      const t = now();
      if (t - windowStart >= windowMs) {
        windowStart = t;
        total = 0;
        counts.clear();
      }
      const retryAfterSeconds = Math.max(1, Math.ceil((windowStart + windowMs - t) / 1000));
      const mine = counts.get(key) ?? 0;
      if (mine >= perClient || total >= global) return { allowed: false, retryAfterSeconds };
      counts.set(key, mine + 1);
      total += 1;
      return { allowed: true, retryAfterSeconds: 0 };
    },
  };
}

export type RateLimiter = ReturnType<typeof createRateLimiter>;
