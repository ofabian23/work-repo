"use client";

import { SecondaryAction } from "@/components/actions/action-button";
import { RecommendationCard } from "@/components/cards/recommendation-card";
import { EmptyState } from "@/components/feedback/empty-state";
import type { PublicContentBundle } from "@/domain/content/visibility";
import type { RecommendationResult } from "@/domain/recommendations/recommendation-result";
import { useLanguage } from "@/lib/i18n/language-provider";
import { labelsFor } from "./journey-view";
import { ScreenFrame } from "./screen-frame";

/**
 * Preliminary recommendations. Every card explains "Why this appeared" from the visitor's own choices;
 * scores are never shown, and unvalidated content carries the pending-validation badge.
 */
export function RecommendationsScreen({
  result,
  content,
  onRefine,
  onExplore,
  onBack,
}: {
  result: RecommendationResult | null;
  content: PublicContentBundle;
  onRefine: () => void;
  onExplore: () => void;
  onBack: () => void;
}) {
  const { t, localize } = useLanguage();
  const solutions = new Map(content.solutions.map((s) => [s.id, s]));
  const items = (result?.items ?? []).flatMap((item) => {
    const solution = solutions.get(item.solutionId);
    return solution ? [{ item, solution }] : [];
  });

  return (
    <ScreenFrame
      testId="recommendations-screen"
      title={t("recommendations.title")}
      subtitle={t("recommendations.subtitle")}
      actions={
        <>
          <SecondaryAction data-testid="recommendations-back" onClick={onBack}>
            {t("journey.back")}
          </SecondaryAction>
          <SecondaryAction data-testid="recommendations-explore" onClick={onExplore}>
            {t("recommendations.explore")}
          </SecondaryAction>
          <SecondaryAction data-testid="recommendations-refine" onClick={onRefine}>
            {t("recommendations.refine")}
          </SecondaryAction>
        </>
      }
    >
      {items.length === 0 ? (
        <EmptyState title={t("ui.emptyTitle")} body={t("recommendations.empty")} />
      ) : (
        <ol aria-label={t("recommendations.listLabel")} className="flex flex-col gap-6">
          {items.map(({ item, solution }) => (
            <li key={item.solutionId}>
              <RecommendationCard
                testId={`recommendation-${item.solutionId}`}
                rank={item.rank}
                title={localize(solution.title)}
                summary={localize(solution.summary)}
                whyThisAppeared={localize(item.whyThisAppeared)}
                relevance={localize(item.relevance)}
                nextStep={localize(item.nextStep)}
                relatedAreas={labelsFor(item.relatedSceneIds, content.scenes).map(localize)}
                pendingValidation={item.pendingValidation}
              />
            </li>
          ))}
        </ol>
      )}
    </ScreenFrame>
  );
}
