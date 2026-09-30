import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);
/** E2E servers use their own database so test leads never mix with development data. */
const E2E_DATABASE_URL = "file:./data/e2e.db";
/**
 * Local administration on the second server only (ADR-056). The passphrase is a dummy used by the E2E
 * tests ("prueba e2e frase de acceso"); only its hash is configured, as in production.
 */
export const E2E_ADMIN_PATH = "/gestion-local";
export const E2E_ADMIN_PASSPHRASE = "prueba e2e frase de acceso";
const E2E_ADMIN_PASSPHRASE_HASH =
  "scrypt:32768:8:1:-BdpZarNsBhD33dVJQ4MYw:kVItykXgWDF9eh-I3PtfdAo7C521uDhGnmLKSBfs5rE";
/** …and their own email preview folder (the preview provider never sends). */
const E2E_EMAIL_PREVIEW_DIR = "data/e2e-email-preview";
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
      command: `npm run db:deploy && npm run build && npx next start -H localhost -p ${PORT}`,
      url: `http://localhost:${PORT}/api/health`,
      env: {
        DATABASE_URL: E2E_DATABASE_URL,
        EMAIL_PROVIDER: "preview",
        EMAIL_PREVIEW_DIR: E2E_EMAIL_PREVIEW_DIR,
      },
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
    {
      // Starts after the first server is ready (it reuses the same build).
      command: `npx next start -H localhost -p ${GALLERY_PORT}`,
      url: `http://localhost:${GALLERY_PORT}/api/health`,
      env: {
        DATABASE_URL: E2E_DATABASE_URL,
        EMAIL_PROVIDER: "preview",
        EMAIL_PREVIEW_DIR: E2E_EMAIL_PREVIEW_DIR,
        ENABLE_COMPONENT_GALLERY: "true",
        ENABLE_SCENE_CALIBRATION: "true",
        // Short kiosk timings so session-management E2E tests can watch a warning and a reset (ADR-055).
        KIOSK_IDLE_WARNING_SECONDS: "10",
        KIOSK_IDLE_COUNTDOWN_SECONDS: "5",
        KIOSK_COMPLETION_SECONDS: "5",
        ADMIN_ENABLED: "true",
        ADMIN_PATH: E2E_ADMIN_PATH,
        ADMIN_PASSPHRASE_HASH: E2E_ADMIN_PASSPHRASE_HASH,
      },
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
});
