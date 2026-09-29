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
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
