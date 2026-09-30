/**
 * Runs once when the Next.js server starts. Validates the environment (variable names only, never values)
 * and the content bundle, so misconfiguration or broken content fails fast with a clear message, then starts
 * the email retry worker.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { getServerEnv } = await import("@/server/env");
    const { getPublicContent } = await import("@/server/content/public-content");
    const env = getServerEnv();
    // Refuse to start with invalid content rather than serving a broken experience.
    getPublicContent(env.CONTENT_MODE, { previewPlaceholders: env.CONTENT_PREVIEW_PLACEHOLDERS });
    // WAL journal: reads no longer wait behind writes (ADR-058).
    const { enableWriteAheadLog } = await import("@/server/db/sqlite-pragmas");
    enableWriteAheadLog(env.DATABASE_URL);
    // Email retries (ADR-054). Deliveries are only attempted for stored leads; see src/server/email.
    const { startEmailWorker } = await import("@/server/email");
    startEmailWorker();
  }
}
