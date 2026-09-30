import type { NextConfig } from "next";
import packageJson from "./package.json" with { type: "json" };

/**
 * Hostnames allowed to request dev-only assets when the dev server is opened from another device
 * (e.g. the Android kiosk at http://192.168.137.1:3000). `*` matches one hostname label.
 * Applies to `npm run dev:network` only; production (`next start`) is unaffected.
 */
const privateLanOrigins = ["192.168.*.*", "10.*.*.*", "172.*.*.*", "*.local"];
const extraOrigins = (process.env.DEV_ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

/**
 * Content Security Policy (ADR-057). Everything is served by this laptop: no remote scripts, styles, fonts,
 * images, frames or analytics. `unsafe-inline` is needed for Next's inline bootstrap scripts and the brand
 * CSS variables; `next dev` additionally needs eval and a websocket for hot reload.
 */
const isDev = process.env.NODE_ENV !== "production";
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
  "media-src 'self'",
  "object-src 'none'",
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
].join("; ");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  allowedDevOrigins: [...privateLanOrigins, ...extraOrigins],
  env: {
    NEXT_PUBLIC_APP_VERSION: packageJson.version,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "no-referrer" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
          },
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
          { key: "X-DNS-Prefetch-Control", value: "off" },
          // No Strict-Transport-Security: the kiosk is served over plain HTTP on the local network.
        ],
      },
      {
        // Static assets (scene art, documents) can never run script, even if opened directly.
        source: "/assets/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox",
          },
        ],
      },
      {
        // The kiosk page is never stored by the browser, so Back/Forward cannot bring back a previous
        // visitor's screen (ADR-055; a pageshow handler also reloads pages restored from bfcache).
        source: "/",
        headers: [{ key: "Cache-Control", value: "no-store, max-age=0" }],
      },
    ];
  },
};

export default nextConfig;
