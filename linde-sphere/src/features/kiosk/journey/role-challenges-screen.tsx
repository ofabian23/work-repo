"use client";

import { PrimaryAction, SecondaryAction } from "@/components/actions/action-button";
import { ArrowRightIcon } from "@/components/icons";
import { ProgressIndicator } from "@/components/navigation/progress-indicator";
import type { Challenge, Persona } from "@/domain/content/taxonomy";
import { useLanguage } from "@/lib/i18n/language-provider";
import { ChallengePicker } from "./challenge-picker";
import { ScreenFrame } from "./screen-frame";

/** "Trabajo en…" step 2: a few challenges relevant to the chosen role, all optional. */
export function RoleChallengesScreen({
  persona,
  challenges,
  selectedIds,
  max,
  otherSelected,
  onToggle,
  onToggleOther,
  onContinue,
  onBack,
}: {
  persona: Persona;
  challenges: Challenge[];
  selectedIds: string[];
  max: number;
  otherSelected: boolean;
  onToggle: (challengeId: string) => void;
  onToggleOther: () => void;
  onContinue: () => void;
  onBack: () => void;
}) {
  const { t, localize } = useLanguage();
  const steps = [t("journey.steps.role"), t("journey.steps.priorities")];
  const subtitle =
    persona.scope === "multiple"
      ? t("roleChallenges.subtitleMultiple", { max })
      : t("roleChallenges.subtitle", { persona: localize(persona.label), max });

  return (
    <ScreenFrame
      testId="role-challenges-screen"
      title={t("roleChallenges.title")}
      subtitle={subtitle}
      progress={<ProgressIndicator current={2} total={2} steps={steps} />}
      actions={
        <>
          <SecondaryAction data-testid="role-challenges-back" onClick={onBack}>
            {t("journey.back")}
          </SecondaryAction>
          <PrimaryAction
            data-testid="role-challenges-continue"
            icon={<ArrowRightIcon />}
            onClick={onContinue}
          >
            {t("journey.continue")}
          </PrimaryAction>
        </>
      }
    >
      <ChallengePicker
        label={t("roleChallenges.listLabel")}
        challenges={challenges}
        selectedIds={selectedIds}
        max={max}
        otherSelected={otherSelected}
        onToggle={onToggle}
        onToggleOther={onToggleOther}
      />
    </ScreenFrame>
  );
}
