import { LANGUAGES, MAX_SELECTED_CHALLENGES, type Language } from "@/domain/content/primitives";

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
    /** Attract screen: interval between rotating value phrases. */
    attractRotationMs: 4_500,
    /** "We are tailoring the experience…" transition shown after the role journey. */
    tailoringTransitionMs: 1_800,
    /** A hotspot panel kept open this long counts as "engaged" (a stronger, anonymous signal). */
    hotspotEngagementMs: 6_000,
    /** Contextual conversion prompt shown once recommendations are ready (ADR-050). */
    conversionPrompt: {
      /** Never shown again within this interval after it was last shown. */
      minIntervalMs: 120_000,
      /** Quiet time after a scene change before the prompt may appear. */
      afterSceneChangeMs: 2_500,
      /** Quiet time after a dialog closes or a form field loses focus. */
      afterInterruptionMs: 1_500,
      /** The prompt hides itself after this long if the visitor does not respond. */
      visibleMs: 15_000,
      /** Screens where the prompt may appear (never on forms, selections, results or the attract loop). */
      screens: ["explore"] as readonly string[],
    },
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
      /** On the attract screen, a language changed by a passer-by reverts to Spanish after this idle time. */
      attractRevertMs: 30_000,
    },
  },
  recommendations: {
    maxSelectedChallenges: MAX_SELECTED_CHALLENGES,
  },
  /** Lead form (ADR-053). */
  leadForm: {
    /** A submission that takes longer is treated as failed (safe to retry: same request token). */
    requestTimeoutMs: 15_000,
    /** After the lead is stored, the delivery state is checked this many times… */
    statusPollAttempts: 3,
    /** …this far apart, before the confirmation is shown. */
    statusPollIntervalMs: 1_200,
  },
  routes: {
    home: "/",
    health: "/api/health",
  },
} as const;

export type AppConfig = typeof appConfig;
