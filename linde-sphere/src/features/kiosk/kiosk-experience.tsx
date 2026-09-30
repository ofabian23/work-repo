"use client";

import { useEffect, useMemo } from "react";
import { InactivityWarning } from "@/components/overlay/inactivity-warning";
import type { PublicContentBundle } from "@/domain/content/visibility";
import { recommend } from "@/domain/recommendations/engine";
import type { NextStep } from "@/domain/session/session-event";
import { EMPTY_SIGNALS } from "@/domain/session/visitor-session";
import { appConfig } from "@/lib/config/app-config";
import { useLanguage } from "@/lib/i18n/language-provider";
import { useHydrated } from "@/lib/use-hydrated";
import { labelsFor, relevantSceneIds, suggestedChallengeIds } from "./journey/journey-view";
import { NextStepsScreen } from "./journey/next-steps-screen";
import { PersonaScreen } from "./journey/persona-screen";
import { RecommendationsScreen } from "./journey/recommendations-screen";
import { RefineChallengesScreen } from "./journey/refine-challenges-screen";
import { RoleChallengesScreen } from "./journey/role-challenges-screen";
import { TailoringScreen } from "./journey/tailoring-screen";
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
  tailoringMs = appConfig.kiosk.tailoringTransitionMs,
}: {
  content: PublicContentBundle;
  idle?: IdleConfig;
  attractTimings?: { rotationMs?: number; revertMs?: number };
  tailoringMs?: number;
}) {
  const { state, dispatch, startSession, choosePath, goToWelcome, reset } = useKioskSession();
  const { localize, t } = useLanguage();
  const ready = useHydrated();
  const session = state.session;
  const signals = session?.signals ?? EMPTY_SIGNALS;
  const maxChallenges = appConfig.recommendations.maxSelectedChallenges;

  // Preliminary recommendations are recalculated as soon as a selection changes (pure, deterministic).
  // `signals` keeps its identity until a signal changes, so unrelated actions do not recalculate.
  const hasSession = session !== null;
  const preliminary = useMemo(
    () => (hasSession ? recommend(signals, content) : null),
    [hasSession, signals, content],
  );
  const persona = content.personas.find((p) => p.id === signals.personaId) ?? null;
  const areaIds = relevantSceneIds(preliminary, content);

  /** Stores the current calculation in the session (and its event) before showing it, once per change. */
  const commitRecommendations = () => {
    if (session?.recommendations !== preliminary)
      dispatch({ type: "SET_RECOMMENDATIONS", result: preliminary });
  };
  const chooseNextStep = (step: NextStep) => {
    if (step === "view-recommendations") commitRecommendations();
    dispatch({ type: "CHOOSE_NEXT_STEP", step });
  };
  const toggleChallenge = (challengeId: string) =>
    dispatch({ type: "TOGGLE_CHALLENGE", challengeId, max: maxChallenges });
  const toggleOther = () => dispatch({ type: "TOGGLE_OTHER_CHALLENGE" });
  const challengesById = (ids: string[]) =>
    ids.flatMap((id) => content.challenges.find((c) => c.id === id) ?? []);
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
      screen = (
        <PersonaScreen
          personas={content.personas}
          selectedId={persona?.id ?? null}
          onSelect={(personaId) => dispatch({ type: "SELECT_PERSONA", personaId })}
          onContinue={() => dispatch({ type: "GO_TO", screen: "role-challenges" })}
          onBack={goToWelcome}
        />
      );
      break;
    case "role-challenges":
      screen = persona && (
        <RoleChallengesScreen
          persona={persona}
          challenges={challengesById(suggestedChallengeIds(persona, signals.challengeIds, content))}
          selectedIds={signals.challengeIds}
          max={maxChallenges}
          otherSelected={session?.otherChallengeSelected ?? false}
          onToggle={toggleChallenge}
          onToggleOther={toggleOther}
          onContinue={() => {
            commitRecommendations();
            dispatch({ type: "GO_TO", screen: "tailoring" });
          }}
          onBack={() => dispatch({ type: "GO_TO", screen: "role" })}
        />
      );
      break;
    case "tailoring":
      screen = (
        <TailoringScreen
          durationMs={tailoringMs}
          onDone={() => dispatch({ type: "GO_TO", screen: "next-steps" })}
        />
      );
      break;
    case "next-steps":
      screen = (
        <NextStepsScreen
          personaLabel={persona?.label ?? null}
          challengeLabels={labelsFor(signals.challengeIds, content.challenges)}
          recommendationCount={preliminary?.items.length ?? 0}
          areaLabels={labelsFor(areaIds, content.scenes)}
          maxChallenges={maxChallenges}
          onChoose={chooseNextStep}
          onChangeRole={() => dispatch({ type: "GO_TO", screen: "role" })}
        />
      );
      break;
    case "recommendations":
      screen = (
        <RecommendationsScreen
          result={preliminary}
          content={content}
          onRefine={() => chooseNextStep("refine-challenges")}
          onExplore={() => chooseNextStep("explore-areas")}
          onBack={() => dispatch({ type: "GO_TO", screen: "next-steps" })}
        />
      );
      break;
    case "refine-challenges":
      screen = (
        <RefineChallengesScreen
          challenges={[...content.challenges].sort((a, b) => a.sortOrder - b.sortOrder)}
          selectedIds={signals.challengeIds}
          max={maxChallenges}
          otherSelected={session?.otherChallengeSelected ?? false}
          onToggle={toggleChallenge}
          onToggleOther={toggleOther}
          onContinue={() => {
            commitRecommendations();
            dispatch({ type: "GO_TO", screen: "recommendations" });
          }}
          onBack={() => dispatch({ type: "GO_TO", screen: "next-steps" })}
        />
      );
      break;
    case "challenges":
      screen = <PathScreen path="challenge" onBack={goToWelcome} />;
      break;
    case "explore": {
      // Once recommendations exist, it lists the areas behind them and returns to the next steps.
      const fromRole = session?.recommendations != null;
      screen = (
        <PathScreen
          path="explore"
          relevantAreas={fromRole ? labelsFor(areaIds, content.scenes).map(localize) : []}
          backLabel={fromRole ? t("journey.back") : undefined}
          onBack={fromRole ? () => dispatch({ type: "GO_TO", screen: "next-steps" }) : goToWelcome}
        />
      );
      break;
    }
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
