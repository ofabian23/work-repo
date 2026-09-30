import "server-only";
import { appConfig } from "@/lib/config/app-config";
import type { ServerEnv } from "@/server/env";

/** Kiosk inactivity and completion timings from the environment, falling back to app-config (ADR-055). */
export type KioskTiming = {
  idle: {
    warningAfterMs: number;
    countdownMs: number;
    leadFormWarningAfterMs: number;
    leadFormCountdownMs: number;
  };
  completionMs: number;
};

export function kioskTiming(env: ServerEnv): KioskTiming {
  const d = appConfig.kiosk.idle;
  const ms = (seconds: number | undefined, fallback: number) =>
    seconds === undefined ? fallback : seconds * 1000;
  return {
    idle: {
      warningAfterMs: ms(env.KIOSK_IDLE_WARNING_SECONDS, d.warningAfterMs),
      countdownMs: ms(env.KIOSK_IDLE_COUNTDOWN_SECONDS, d.countdownMs),
      leadFormWarningAfterMs: ms(env.KIOSK_FORM_IDLE_WARNING_SECONDS, d.leadFormWarningAfterMs),
      leadFormCountdownMs: ms(env.KIOSK_FORM_IDLE_COUNTDOWN_SECONDS, d.leadFormCountdownMs),
    },
    completionMs: ms(env.KIOSK_COMPLETION_SECONDS, d.confirmationResetMs),
  };
}
