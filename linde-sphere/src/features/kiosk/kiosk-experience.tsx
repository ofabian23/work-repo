"use client";

import { useEffect } from "react";
import { InactivityWarning } from "@/components/overlay/inactivity-warning";
import type { PublicContentBundle } from "@/domain/content/visibility";
import { appConfig } from "@/lib/config/app-config";
import { useHydrated } from "@/lib/use-hydrated";
import { AttractScreen } from "./screens/attract-screen";
import { PathScreen } from "./screens/path-screen";
import { WelcomeScreen } from "./screens/welcome-screen";
import { useKioskSession } from "./state/kiosk-session-provider";
import { useIdleTimer, type IdleConfig } from "./state/use-idle-timer";

/**
 * The visitor experience on the single kiosk route (ADR-004): renders the current screen from the
 * session store and runs the inactivity timer whenever a session is active.
 */
export function KioskExperience({
  content,
  idle = appConfig.kiosk.idle,
  attractTimings,
}: {
  content: PublicContentBundle;
  idle?: IdleConfig;
  attractTimings?: { rotationMs?: number; revertMs?: number };
}) {
  const { state, startSession, choosePath, goToWelcome, reset } = useKioskSession();
  const ready = useHydrated();
  const idleTimer = useIdleTimer({
    enabled: state.session !== null,
    warningAfterMs: idle.warningAfterMs,
    countdownMs: idle.countdownMs,
    onTimeout: () => reset("timeout"),
  });

  // Each screen starts at the top: on shorter displays the previous screen may have been scrolled
  // (for example, to reach the attract call to action).
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [state.screen]);

  let screen;
  switch (state.screen) {
    case "attract":
      screen = <AttractScreen onStart={startSession} {...attractTimings} />;
      break;
    case "welcome":
      screen = <WelcomeScreen onChoosePath={choosePath} privacyNotice={content.consent.privacyNotice} />;
      break;
    case "role":
      screen = <PathScreen path="role" onBack={goToWelcome} />;
      break;
    case "challenges":
      screen = <PathScreen path="challenge" onBack={goToWelcome} />;
      break;
    case "explore":
      screen = <PathScreen path="explore" onBack={goToWelcome} />;
      break;
  }

  return (
    <div
      className="flex flex-1 flex-col"
      data-testid="kiosk-experience"
      data-screen={state.screen}
      data-ready={ready || undefined}
      // Remount everything on reset so each visitor starts from the initial visual state.
      key={state.resetCount}
    >
      {screen}
      <InactivityWarning
        open={idleTimer.warningOpen}
        secondsRemaining={idleTimer.secondsRemaining}
        onContinue={idleTimer.keepAlive}
        onReset={() => {
          idleTimer.stop();
          reset("explicit");
        }}
      />
    </div>
  );
}
