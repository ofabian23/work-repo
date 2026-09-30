"use client";

import { SecondaryAction } from "@/components/actions/action-button";
import { StatusBanner } from "@/components/feedback/status-banner";
import { CheckIcon, ShieldIcon } from "@/components/icons";
import { useLanguage } from "@/lib/i18n/language-provider";
import { ScreenFrame } from "./screen-frame";

const ITEMS = ["priorities", "recommendations", "areas", "resources", "nextSteps"] as const;

/**
 * "Enviarme mi resumen personalizado": explains what the summary contains and how contact details and
 * consent are handled before any form appears (value first). The form itself is Phase 7.
 */
export function SummaryRequestScreen({ onBack }: { onBack: () => void }) {
  const { t } = useLanguage();
  return (
    <ScreenFrame
      testId="summary-request-screen"
      title={t("summary.title")}
      subtitle={t("summary.intro")}
      actions={
        <SecondaryAction data-testid="summary-back" onClick={onBack}>
          {t("summary.back")}
        </SecondaryAction>
      }
    >
      <section className="flex flex-col gap-4">
        <h2 className="text-title text-ink font-semibold">{t("summary.includesLabel")}</h2>
        <ul className="flex flex-col gap-3" data-testid="summary-includes">
          {ITEMS.map((key) => (
            <li key={key} className="text-lead text-ink flex items-center gap-3">
              <CheckIcon className="text-success" />
              {t(`summary.items.${key}`)}
            </li>
          ))}
        </ul>
      </section>
      <p className="text-body text-ink-muted flex items-start gap-3">
        <ShieldIcon className="text-primary mt-1" />
        {t("summary.privacy")}
      </p>
      <StatusBanner tone="info" title={t("summary.comingNext")} />
    </ScreenFrame>
  );
}
