"use client";

import { SecondaryAction } from "@/components/actions/action-button";
import { RecommendationCard } from "@/components/cards/recommendation-card";
import { EmptyState } from "@/components/feedback/empty-state";
import { HospitalIcon } from "@/components/icons";
import type { PublicContentBundle } from "@/domain/content/visibility";
import {
  primaryItems,
  secondaryItems,
  type RecommendationItem,
  type RecommendationResult,
} from "@/domain/recommendations/recommendation-result";
import { useLanguage } from "@/lib/i18n/language-provider";
import { labelsFor } from "./journey-view";
import { ScreenFrame } from "./screen-frame";

/**
 * Preliminary recommendations: up to three primary cards, then up to three secondary ones. Every card
 * explains "Why this appeared" from the visitor's own choices and states its relevance in words; scores
 * are never shown, and unvalidated content carries the pending-validation badge.
 */
export function RecommendationsScreen({
  result,
  content,
  onRefine,
  onExplore,
  onViewScene,
  onBack,
}: {
  result: RecommendationResult | null;
  content: PublicContentBundle;
  onRefine: () => void;
  onExplore: () => void;
  onViewScene: (sceneId: string) => void;
  onBack: () => void;
}) {
  const { t, localize } = useLanguage();
  const solutions = new Map(content.solutions.map((s) => [s.id, s]));
  const scenes = new Map(content.scenes.map((s) => [s.id, s]));
  const assets = new Map(content.digitalAssets.map((a) => [a.id, a]));
  const withSolution = (items: RecommendationItem[]) =>
    items.flatMap((item) => {
      const solution = solutions.get(item.solutionId);
      return solution ? [{ item, solution }] : [];
    });
  const primary = withSolution(primaryItems(result));
  const secondary = withSolution(secondaryItems(result));
  const relevanceLabel = (item: RecommendationItem) => t(`recommendations.relevance.${item.relevanceLevel}`);
  const viewScene = (item: RecommendationItem) => {
    const scene = item.sceneId ? scenes.get(item.sceneId) : undefined;
    return scene ? (
      <SecondaryAction
        size="md"
        data-testid={`view-scene-${item.solutionId}`}
        icon={<HospitalIcon size="size-6" />}
        onClick={() => onViewScene(scene.id)}
      >
        {t("recommendations.viewScene", { scene: localize(scene.title) })}
      </SecondaryAction>
    ) : null;
  };

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
      {primary.length === 0 ? (
        <EmptyState title={t("ui.emptyTitle")} body={t("recommendations.empty")} />
      ) : (
        <ol aria-label={t("recommendations.listLabel")} className="flex flex-col gap-6">
          {primary.map(({ item, solution }) => (
            <li key={item.solutionId}>
              <RecommendationCard
                testId={`recommendation-${item.solutionId}`}
                rank={item.rank}
                title={localize(solution.title)}
                summary={localize(solution.summary)}
                relevanceLabel={relevanceLabel(item)}
                whyThisAppeared={localize(item.whyThisAppeared)}
                relevance={localize(item.relevance)}
                nextStep={localize(item.nextStep)}
                relatedAreas={labelsFor(item.relatedSceneIds, content.scenes).map(localize)}
                resources={item.digitalAssetIds.flatMap((id) => {
                  const asset = assets.get(id);
                  return asset ? [localize(asset.title)] : [];
                })}
                pendingValidation={item.pendingValidation}
                actions={viewScene(item)}
              />
            </li>
          ))}
        </ol>
      )}

      {secondary.length > 0 && (
        <section data-testid="secondary-recommendations" className="flex flex-col gap-4">
          <h2 className="text-title text-ink font-bold">{t("recommendations.secondaryTitle")}</h2>
          <ol start={primary.length + 1} className="flex flex-col gap-4">
            {secondary.map(({ item, solution }) => (
              <li
                key={item.solutionId}
                data-testid={`recommendation-${item.solutionId}`}
                aria-label={`${t("ui.recommendationRank", { rank: item.rank })}: ${localize(solution.title)}`}
                className="rounded-card border-line bg-surface-muted flex flex-col gap-2 border p-5"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="text-lead text-ink font-bold">{localize(solution.title)}</h3>
                  <span
                    data-testid="relevance-label"
                    className="bg-surface text-ink-muted text-label border-line rounded-full border px-3 py-0.5 font-semibold"
                  >
                    {relevanceLabel(item)}
                  </span>
                </div>
                <p className="text-body text-ink">{localize(item.whyThisAppeared)}</p>
              </li>
            ))}
          </ol>
        </section>
      )}
    </ScreenFrame>
  );
}
