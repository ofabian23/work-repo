"use client";

import { SecondaryAction } from "@/components/actions/action-button";
import { BottomActionBar } from "@/components/actions/bottom-action-bar";
import { StatusBanner } from "@/components/feedback/status-banner";
import type { EntryPath } from "@/domain/session/visitor-session";
import { useLanguage } from "@/lib/i18n/language-provider";
import { useScreenHeading } from "./use-screen-heading";

/**
 * Placeholder for the path still to be built (path B, "Necesito…", in Phase 5): confirms the chosen path
 * and offers the way back to the welcome screen.
 */
export function PathScreen({ path, onBack }: { path: EntryPath; onBack: () => void }) {
  const { t } = useLanguage();
  const heading = useScreenHeading();
  return (
    <section data-testid={`path-screen-${path}`} className="flex flex-1 flex-col">
      <div className="px-gutter flex flex-1 flex-col gap-6 py-[clamp(2rem,4vh,5rem)]">
        <h1 ref={heading} tabIndex={-1} className="text-headline text-ink font-bold outline-none">
          {t(`welcome.paths.${path}.title`)}
        </h1>
        <p className="text-lead text-ink-muted">{t(`welcome.paths.${path}.description`)}</p>
        <StatusBanner tone="info" title={t("pathScreen.comingNext")} />
      </div>
      <BottomActionBar label={t("ui.actions")}>
        <SecondaryAction data-testid="back-to-welcome" onClick={onBack}>
          {t("pathScreen.backToWelcome")}
        </SecondaryAction>
      </BottomActionBar>
    </section>
  );
}
