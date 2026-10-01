/**
 * Runs once when the Next.js server starts. Validates the environment (variable names only, never values)
 * and the content bundle, so misconfiguration or broken content fails fast with a clear message, then starts
 * the email retry worker when the follow-up mode sends email.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { getServerEnv } = await import("@/server/env");
    const { getPublicContent } = await import("@/server/content/public-content");
    const env = getServerEnv();
    // Refuse to start with invalid content rather than serving a broken experience.
    getPublicContent(env.CONTENT_MODE, { previewPlaceholders: env.CONTENT_PREVIEW_PLACEHOLDERS });
    // Email retries (ADR-054), only in the email follow-up modes: LOCAL_PACKAGE (the default) never attempts
    // email, so the worker does not run (ADR-062). Deliveries are only attempted for stored leads.
    const { usesEmailOutbox } = await import("@/domain/follow-up/follow-up-mode");
    if (usesEmailOutbox(env.FOLLOW_UP_MODE)) {
      const { startEmailWorker } = await import("@/server/email");
      startEmailWorker();
    }
  }
}
