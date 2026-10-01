import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);
/** Origin of the main E2E server (API calls from the runner declare it, like the kiosk page does). */
export const E2E_ORIGIN = `http://localhost:${PORT}`;
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
/** Third server on the same build in production content mode: validated content only (ADR-060). */
export const PRODUCTION_CONTENT_PORT = PORT + 2;
/**
 * Fourth server: real SMTP provider pointed at a closed local port, so every email attempt genuinely
 * fails (critical journey 5). It has its own database, because each server's email worker processes
 * every due delivery in its database, and admin enabled for the retry.
 */
export const FAILING_EMAIL_PORT = PORT + 3;

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
      // FOLLOW_UP_MODE is left unset: the default LOCAL_PACKAGE stores leads and reports, never emails.
      command: `npm run db:deploy && npm run build && npx next start -H localhost -p ${PORT}`,
      url: `http://localhost:${PORT}/api/health`,
      env: {
        DATABASE_URL: E2E_DATABASE_URL,
        EMAIL_PROVIDER: "preview",
        EMAIL_PREVIEW_DIR: E2E_EMAIL_PREVIEW_DIR,
        // The suite submits many leads from one address; production keeps the default (10 per minute).
        LEAD_RATE_LIMIT_PER_MINUTE: "1000",
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
        LEAD_RATE_LIMIT_PER_MINUTE: "1000",
        // Email follow-up through the preview provider (writes local files, never sends; ADR-062).
        FOLLOW_UP_MODE: "SMTP_EMAIL",
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
    {
      // Production content mode on the same build: the kiosk must show nothing that is not validated.
      command: `npx next start -H localhost -p ${PRODUCTION_CONTENT_PORT}`,
      url: `http://localhost:${PRODUCTION_CONTENT_PORT}/api/health`,
      env: {
        DATABASE_URL: E2E_DATABASE_URL,
        EMAIL_PROVIDER: "preview",
        EMAIL_PREVIEW_DIR: E2E_EMAIL_PREVIEW_DIR,
        LEAD_RATE_LIMIT_PER_MINUTE: "1000",
        CONTENT_MODE: "production",
      },
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: `npm run db:deploy && npx next start -H localhost -p ${FAILING_EMAIL_PORT}`,
      url: `http://localhost:${FAILING_EMAIL_PORT}/api/health`,
      env: {
        DATABASE_URL: "file:./data/e2e-failing-email.db",
        FOLLOW_UP_MODE: "SMTP_EMAIL",
        EMAIL_PROVIDER: "smtp",
        // Nothing listens on the discard port locally: the connection is refused (a transient failure).
        SMTP_HOST: "127.0.0.1",
        SMTP_PORT: "9",
        EMAIL_FROM: "reportes@kiosk.test",
        // No automatic retry during a test run; only the immediate attempt and the admin's manual retry.
        EMAIL_WORKER_INTERVAL_MS: "3600000",
        LEAD_RATE_LIMIT_PER_MINUTE: "1000",
        ADMIN_ENABLED: "true",
        ADMIN_PATH: E2E_ADMIN_PATH,
        ADMIN_PASSPHRASE_HASH: E2E_ADMIN_PASSPHRASE_HASH,
      },
      reuseExistingServer: !process.env.CI,
      timeout: 90_000,
    },
  ],
});
