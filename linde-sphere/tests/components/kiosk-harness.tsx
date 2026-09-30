import { fireEvent, render, screen } from "@testing-library/react";
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
  const { state } = useKioskSession();
  return (
    <output data-testid="probe" data-screen={state.screen}>
      {JSON.stringify(state.session)}
    </output>
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
}: {
  content?: PublicContentBundle;
  idle?: { warningAfterMs: number; countdownMs: number };
  attractTimings?: { rotationMs: number; revertMs: number };
  tailoringMs?: number;
} = {}) {
  const onHardReset = vi.fn();
  const utils = render(
    <LanguageProvider>
      <KioskSessionProvider
        onHardReset={onHardReset}
        createId={() => `00000000-0000-4000-8000-00000000000${++counter % 10}`}
      >
        <AppShell contentMode="demo" headerActions={<KioskHeaderActions />}>
          <KioskExperience
            content={content}
            idle={idle}
            attractTimings={attractTimings}
            tailoringMs={tailoringMs}
          />
        </AppShell>
        <SessionProbe />
      </KioskSessionProvider>
    </LanguageProvider>,
  );
  return { ...utils, onHardReset };
}

export const startSession = () => fireEvent.click(screen.getByTestId("attract-start"));
