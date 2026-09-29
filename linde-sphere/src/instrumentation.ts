/**
 * Runs once when the Next.js server starts. Validates the environment so misconfiguration fails fast
 * with a clear message (variable names only, never values).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { getServerEnv } = await import("@/server/env");
    getServerEnv();
  }
}
