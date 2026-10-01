"use client";

import { PrimaryAction, SecondaryAction } from "@/components/actions/action-button";
import { ArrowRightIcon, CheckIcon, ShieldIcon } from "@/components/icons";
import { useLanguage } from "@/lib/i18n/language-provider";
import { useVisitorFollowUp } from "../follow-up/follow-up-context";
import { ScreenFrame } from "./screen-frame";

const ITEMS = ["priorities", "recommendations", "areas", "resources", "nextSteps"] as const;

/**
 * "Solicitar mi resumen personalizado": explains what the summary contains and how contact details and
 * consent are handled before any form appears (value first), then opens the lead form (ADR-053).
 */
export function SummaryRequestScreen({ onContinue, onBack }: { onContinue: () => void; onBack: () => void }) {
  const { t } = useLanguage();
  // LOCAL_PACKAGE: no automatic email, so the intro does not promise one (ADR-062).
  const followUp = useVisitorFollowUp();
  return (
    <ScreenFrame
      testId="summary-request-screen"
      title={t("summary.title")}
      subtitle={t(followUp === "package" ? "summary.introPackage" : "summary.intro")}
      actions={
        <div className="flex w-full flex-col gap-3">
          <PrimaryAction
            fullWidth
            data-testid="summary-continue"
            icon={<ArrowRightIcon />}
            onClick={onContinue}
          >
            {t("summary.continue")}
          </PrimaryAction>
          <SecondaryAction data-testid="summary-back" onClick={onBack}>
            {t("summary.back")}
          </SecondaryAction>
        </div>
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
    </ScreenFrame>
  );
}
