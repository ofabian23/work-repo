"use client";

import { PrimaryAction, SecondaryAction } from "@/components/actions/action-button";
import { ArrowRightIcon } from "@/components/icons";
import { ProgressIndicator } from "@/components/navigation/progress-indicator";
import type { PublicChallenge as Challenge } from "@/domain/content/visibility";
import { useLanguage } from "@/lib/i18n/language-provider";
import { ChallengePicker } from "./challenge-picker";
import { ScreenFrame } from "./screen-frame";

/** Path B "Necesito…" step 1: the challenges to solve (up to `max`, or "Something else"). */
export function ChallengesPathScreen({
  challenges,
  selectedIds,
  max,
  otherSelected,
  onToggle,
  onToggleOther,
  onContinue,
  onBack,
}: {
  challenges: Challenge[];
  selectedIds: string[];
  max: number;
  otherSelected: boolean;
  onToggle: (challengeId: string) => void;
  onToggleOther: () => void;
  onContinue: () => void;
  onBack: () => void;
}) {
  const { t } = useLanguage();
  const steps = [t("journey.steps.priorities"), t("journey.steps.role")];
  return (
    <ScreenFrame
      testId="challenges-path-screen"
      title={t("challengesPath.title")}
      subtitle={t("challengesPath.subtitle", { max })}
      progress={<ProgressIndicator current={1} total={2} steps={steps} />}
      actions={
        <>
          <SecondaryAction data-testid="challenges-back" onClick={onBack}>
            {t("journey.back")}
          </SecondaryAction>
          <PrimaryAction
            data-testid="challenges-continue"
            disabled={selectedIds.length === 0 && !otherSelected}
            icon={<ArrowRightIcon />}
            onClick={onContinue}
          >
            {t("journey.continue")}
          </PrimaryAction>
        </>
      }
    >
      <ChallengePicker
        label={t("refine.listLabel")}
        challenges={challenges}
        selectedIds={selectedIds}
        max={max}
        otherSelected={otherSelected}
        onToggle={onToggle}
        onToggleOther={onToggleOther}
        columns={2}
      />
    </ScreenFrame>
  );
}
