"use client";

import type { ReactNode } from "react";
import { SecondaryAction } from "@/components/actions/action-button";
import { ActionCard } from "@/components/cards/action-card";
import { HospitalIcon, SparkIcon, TargetIcon } from "@/components/icons";
import type { LocalizedText } from "@/domain/content/primitives";
import type { NextStep } from "@/domain/session/session-event";
import { useLanguage } from "@/lib/i18n/language-provider";
import { ScreenFrame } from "./screen-frame";

/**
 * After the tailoring transition: a short summary of what the visitor chose and the three ways forward
 * (view preliminary recommendations, refine with challenges, explore relevant hospital areas).
 */
export function NextStepsScreen({
  personaLabel,
  challengeLabels,
  recommendationCount,
  areaLabels,
  maxChallenges,
  onChoose,
  onChangeRole,
}: {
  personaLabel: LocalizedText | null;
  challengeLabels: LocalizedText[];
  recommendationCount: number;
  areaLabels: LocalizedText[];
  maxChallenges: number;
  onChoose: (step: NextStep) => void;
  onChangeRole: () => void;
}) {
  const { t, localize, language } = useLanguage();
  const join = (labels: LocalizedText[]) =>
    new Intl.ListFormat(language, { type: "conjunction" }).format(labels.map(localize));

  const options: { step: NextStep; title: string; description: string; icon: ReactNode }[] = [
    {
      step: "view-recommendations",
      title: t("nextSteps.view.title"),
      description:
        recommendationCount === 1
          ? t("nextSteps.view.descriptionOne")
          : t("nextSteps.view.descriptionMany", { count: recommendationCount }),
      icon: <SparkIcon />,
    },
    {
      step: "refine-challenges",
      title: t("nextSteps.refine.title"),
      description: t("nextSteps.refine.description", { max: maxChallenges }),
      icon: <TargetIcon />,
    },
    {
      step: "explore-areas",
      title: t("nextSteps.explore.title"),
      description:
        areaLabels.length > 0
          ? t("nextSteps.explore.description", { areas: join(areaLabels) })
          : t("nextSteps.explore.descriptionGeneric"),
      icon: <HospitalIcon />,
    },
  ];

  return (
    <ScreenFrame
      testId="next-steps-screen"
      title={t("nextSteps.title")}
      subtitle={
        <span className="flex flex-col gap-1" data-testid="next-steps-summary">
          {personaLabel && <span>{t("nextSteps.area", { persona: localize(personaLabel) })}</span>}
          <span>
            {challengeLabels.length > 0
              ? t("nextSteps.priorities", { challenges: join(challengeLabels) })
              : t("nextSteps.noPriorities")}
          </span>
        </span>
      }
      actions={
        <SecondaryAction data-testid="next-steps-change-role" onClick={onChangeRole}>
          {t("nextSteps.changeRole")}
        </SecondaryAction>
      }
    >
      <nav aria-label={t("nextSteps.optionsLabel")} className="flex flex-col gap-4">
        <h2 className="text-title text-ink font-semibold">{t("nextSteps.optionsLabel")}</h2>
        <ul className="flex flex-col gap-5">
          {options.map((option) => (
            <li key={option.step}>
              <ActionCard
                testId={`next-${option.step}`}
                icon={option.icon}
                title={option.title}
                description={option.description}
                onActivate={() => onChoose(option.step)}
              />
            </li>
          ))}
        </ul>
      </nav>
    </ScreenFrame>
  );
}
