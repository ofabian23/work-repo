import { LANGUAGES, MAX_SELECTED_CHALLENGES, type Language } from "@/domain/content/primitives";
import { MAX_RECOMMENDATIONS } from "@/domain/recommendations/recommendation-result";

/**
 * Centralized, client-safe application configuration. Never put secrets or environment-dependent
 * server values here (those live in `src/server/env.ts`).
 */
export const appConfig = {
  /** Inlined at build time from package.json (see next.config.ts). */
  version: process.env.NEXT_PUBLIC_APP_VERSION ?? "0.0.0",
  defaultLanguage: "es" satisfies Language,
  supportedLanguages: LANGUAGES,
  kiosk: {
    /** Primary design target: portrait touchscreen. */
    designViewport: { width: 1080, height: 1920 },
    /** WCAG 2.2 minimum; primary actions use the larger size. */
    minTouchTargetPx: 48,
    primaryTouchTargetPx: 64,
    idle: {
      warningAfterMs: 60_000,
      countdownMs: 15_000,
      leadFormWarningAfterMs: 120_000,
      leadFormCountdownMs: 20_000,
      confirmationResetMs: 15_000,
    },
  },
  recommendations: {
    maxSelectedChallenges: MAX_SELECTED_CHALLENGES,
    maxResults: MAX_RECOMMENDATIONS,
  },
  routes: {
    home: "/",
    health: "/api/health",
  },
} as const;

export type AppConfig = typeof appConfig;
