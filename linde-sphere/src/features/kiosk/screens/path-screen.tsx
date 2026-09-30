"use client";

import { SecondaryAction } from "@/components/actions/action-button";
import { BottomActionBar } from "@/components/actions/bottom-action-bar";
import { StatusBanner } from "@/components/feedback/status-banner";
import type { EntryPath } from "@/domain/session/visitor-session";
import { useLanguage } from "@/lib/i18n/language-provider";
import { useScreenHeading } from "./use-screen-heading";

/**
 * Placeholder for the flows still to be built (path B in Phase 5, the explorer in Phase 6): confirms the
 * chosen path, lists the areas relevant to the visitor when known, and offers the way back.
 */
export function PathScreen({
  path,
  onBack,
  relevantAreas = [],
  backLabel,
}: {
  path: EntryPath;
  onBack: () => void;
  relevantAreas?: string[];
  backLabel?: string;
}) {
  const { t } = useLanguage();
  const heading = useScreenHeading();
  return (
    <section data-testid={`path-screen-${path}`} className="flex flex-1 flex-col">
      <div className="px-gutter flex flex-1 flex-col gap-6 py-[clamp(2rem,4vh,5rem)]">
        <h1 ref={heading} tabIndex={-1} className="text-headline text-ink font-bold outline-none">
          {t(`welcome.paths.${path}.title`)}
        </h1>
        <p className="text-lead text-ink-muted">{t(`welcome.paths.${path}.description`)}</p>
        {relevantAreas.length > 0 && (
          <section className="flex flex-col gap-3" data-testid="relevant-areas">
            <h2 className="text-title text-ink font-semibold">{t("explorePreview.relevantAreas")}</h2>
            <ul className="flex flex-wrap gap-3">
              {relevantAreas.map((area) => (
                <li
                  key={area}
                  className="bg-info-surface text-info text-label rounded-full px-5 py-2 font-semibold"
                >
                  {area}
                </li>
              ))}
            </ul>
          </section>
        )}
        <StatusBanner tone="info" title={t("pathScreen.comingNext")} />
      </div>
      <BottomActionBar label={t("ui.actions")}>
        <SecondaryAction data-testid="back-to-welcome" onClick={onBack}>
          {backLabel ?? t("pathScreen.backToWelcome")}
        </SecondaryAction>
      </BottomActionBar>
    </section>
  );
}
