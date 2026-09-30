"use client";

import { PrimaryAction, SecondaryAction } from "@/components/actions/action-button";
import { ArrowRightIcon } from "@/components/icons";
import type { Challenge } from "@/domain/content/taxonomy";
import { useLanguage } from "@/lib/i18n/language-provider";
import { ChallengePicker } from "./challenge-picker";
import { ScreenFrame } from "./screen-frame";

/** "Refine by selecting challenges": the full challenge list, up to `max`, then updated recommendations. */
export function RefineChallengesScreen({
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
  return (
    <ScreenFrame
      testId="refine-challenges-screen"
      title={t("refine.title")}
      subtitle={t("refine.subtitle", { max })}
      actions={
        <>
          <SecondaryAction data-testid="refine-back" onClick={onBack}>
            {t("journey.back")}
          </SecondaryAction>
          <PrimaryAction data-testid="refine-continue" icon={<ArrowRightIcon />} onClick={onContinue}>
            {t("refine.continue")}
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
