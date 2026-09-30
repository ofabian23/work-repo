import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);
/** Second server on the same production build with the dev tools (gallery, calibration) explicitly enabled. */
export const GALLERY_PORT = PORT + 1;

/**
 * Uses a pre-installed Chromium when available (cloud dev container); otherwise the browser installed
 * by `npx playwright install chromium`.
 */
const preinstalledChromium = ["/opt/pw-browsers/chromium", process.env.PLAYWRIGHT_CHROMIUM_PATH].find(
  (p): p is string => typeof p === "string" && existsSync(p),
);

export default defineConfig({
  testDir: "tests/e2e",
  outputDir: "test-results",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    launchOptions: preinstalledChromium ? { executablePath: preinstalledChromium } : {},
  },
  projects: [
    {
      name: "kiosk-portrait",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1080, height: 1920 }, hasTouch: true },
    },
    { name: "laptop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    {
      name: "mobile",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 390, height: 844 },
        hasTouch: true,
        isMobile: true,
      },
    },
  ],
  webServer: [
    {
      // Production build, bound to localhost only, gallery disabled (default production behavior).
      command: `npm run build && npx next start -H localhost -p ${PORT}`,
      url: `http://localhost:${PORT}/api/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
    {
      // Starts after the first server is ready (it reuses the same build).
      command: `npx next start -H localhost -p ${GALLERY_PORT}`,
      url: `http://localhost:${GALLERY_PORT}/api/health`,
      env: { ENABLE_COMPONENT_GALLERY: "true", ENABLE_SCENE_CALIBRATION: "true" },
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
});
