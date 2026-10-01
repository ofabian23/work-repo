import { fireEvent, render, screen } from "@testing-library/react";
import { Fragment, StrictMode, type ComponentProps } from "react";
import { vi } from "vitest";
import { AppShell } from "@/components/shell/app-shell";
import { visibleContent, type PublicContentBundle } from "@/domain/content/visibility";
import { KioskExperience } from "@/features/kiosk/kiosk-experience";
import { KioskHeaderActions } from "@/features/kiosk/kiosk-header-actions";
import { KioskSessionProvider, useKioskSession } from "@/features/kiosk/state/kiosk-session-provider";
import { LanguageProvider } from "@/lib/i18n/language-provider";
import { loadSeedBundle } from "../helpers/schema";

export const demoContent = visibleContent(loadSeedBundle(), "demo");

/** Test-only window into the session store (never rendered in the app). */
function SessionProbe() {
  const { state, reset } = useKioskSession();
  return (
    <>
      <output data-testid="probe" data-screen={state.screen}>
        {JSON.stringify(state.session)}
      </output>
      {/* Programmatic reset request, e.g. an inactivity timeout arriving at an unlucky moment. */}
      <button type="button" hidden data-testid="probe-reset" onClick={() => reset("timeout")} />
    </>
  );
}
export const session = () => JSON.parse(screen.getByTestId("probe").textContent || "null");

let counter = 0;

/** The whole kiosk (shell, header actions, experience) with an injected hard reset and ids. */
export function renderKiosk({
  content = demoContent,
  idle = { warningAfterMs: 60_000, countdownMs: 15_000 },
  attractTimings = { rotationMs: 1_000, revertMs: 5_000 },
  tailoringMs = 1_800,
  conversionPrompt,
  leadApi,
  leadStatusPoll = { attempts: 1, intervalMs: 0 },
  confirmationResetMs,
  followUp,
  strict = false,
}: {
  content?: PublicContentBundle;
  idle?: { warningAfterMs: number; countdownMs: number };
  attractTimings?: { rotationMs: number; revertMs: number };
  tailoringMs?: number;
  conversionPrompt?: ComponentProps<typeof KioskExperience>["conversionPrompt"];
  leadApi?: ComponentProps<typeof KioskExperience>["leadApi"];
  leadStatusPoll?: { attempts: number; intervalMs: number };
  confirmationResetMs?: number;
  followUp?: ComponentProps<typeof KioskExperience>["followUp"];
  /** Wrap in React StrictMode, as `next dev` does (reactStrictMode: effects mount, clean up and mount again). */
  strict?: boolean;
} = {}) {
  const onHardReset = vi.fn();
  const Wrapper = strict ? StrictMode : Fragment;
  const utils = render(
    <Wrapper>
      <LanguageProvider>
        <KioskSessionProvider
          onHardReset={onHardReset}
          createId={() => `00000000-0000-4000-8000-00000000000${++counter % 10}`}
        >
          <AppShell contentMode={content.mode} headerActions={<KioskHeaderActions />}>
            <KioskExperience
              content={content}
              idle={idle}
              attractTimings={attractTimings}
              tailoringMs={tailoringMs}
              conversionPrompt={conversionPrompt}
              leadApi={leadApi}
              leadStatusPoll={leadStatusPoll}
              confirmationResetMs={confirmationResetMs}
              followUp={followUp}
            />
          </AppShell>
          <SessionProbe />
        </KioskSessionProvider>
      </LanguageProvider>
    </Wrapper>,
  );
  return { ...utils, onHardReset };
}

export const startSession = () => fireEvent.click(screen.getByTestId("attract-start"));
