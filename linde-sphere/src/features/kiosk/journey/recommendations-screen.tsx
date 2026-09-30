"use client";

import type { ReactNode } from "react";
import { PrimaryAction, SecondaryAction } from "@/components/actions/action-button";
import { ResetExperienceButton } from "@/components/actions/reset-experience-button";
import { RecommendationCard } from "@/components/cards/recommendation-card";
import { EmptyState } from "@/components/feedback/empty-state";
import { StatusBanner } from "@/components/feedback/status-banner";
import { ArrowRightIcon, HospitalIcon } from "@/components/icons";
import type { LocalizedText } from "@/domain/content/primitives";
import type { PublicContentBundle } from "@/domain/content/visibility";
import { primaryItems, secondaryItems } from "@/domain/recommendations/recommendation-items";
import type {
  RecommendationItem,
  RecommendationResult,
} from "@/domain/recommendations/recommendation-result";
import type { RecommendationChanges } from "@/domain/recommendations/recommendation-stability";
import { useLanguage } from "@/lib/i18n/language-provider";
import { labelsFor } from "./journey-view";
import { ScreenFrame } from "./screen-frame";

export type RecommendationSummary = {
  personaLabel: LocalizedText | null;
  challengeLabels: LocalizedText[];
  /** Areas where the visitor looked at content (meaningful interaction). */
  exploredLabels: LocalizedText[];
};

/**
 * The value screen (ADR-051): what we found, why it is relevant and what to do next, before any form.
 * Calm and honest: no pressure language, no claim of a complete assessment or clinical advice, demo
 * content clearly marked, relevance in words (never scores). "Enviarme mi resumen personalizado" is the
 * one primary action; exploring, reviewing priorities and starting over are always available.
 */
export function RecommendationsScreen({
  result,
  content,
  summary,
  changes,
  onSendSummary,
  onContinueExploring,
  onReviewPriorities,
  onStartOver,
  onViewScene,
}: {
  result: RecommendationResult | null;
  content: PublicContentBundle;
  summary: RecommendationSummary;
  /** What changed since the visitor last saw their recommendations. */
  changes: RecommendationChanges;
  /** Omitted when lead capture is unavailable (production without approved consent/report copy). */
  onSendSummary?: () => void;
  onContinueExploring: () => void;
  onReviewPriorities: () => void;
  onStartOver: () => void;
  onViewScene: (sceneId: string) => void;
}) {
  const { t, localize, language } = useLanguage();
  const join = (labels: LocalizedText[]) =>
    new Intl.ListFormat(language, { type: "conjunction" }).format(labels.map(localize));
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
  const anyPending = (result?.items ?? []).some((i) => i.pendingValidation);
  const relevanceLabel = (item: RecommendationItem) => t(`recommendations.relevance.${item.relevanceLevel}`);
  const newBadge = (item: RecommendationItem): ReactNode =>
    changes.newIds.includes(item.solutionId) ? (
      <span
        data-testid="new-badge"
        className="bg-primary text-on-primary text-caption rounded-full px-3 py-0.5 font-semibold"
      >
        {t("recommendations.newBadge")}
      </span>
    ) : null;
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

  const summaryLines = [
    summary.personaLabel && t("recommendations.summaryArea", { persona: localize(summary.personaLabel) }),
    summary.challengeLabels.length > 0 &&
      t("recommendations.summaryPriorities", { challenges: join(summary.challengeLabels) }),
    summary.exploredLabels.length > 0 &&
      t("recommendations.summaryExplored", { areas: join(summary.exploredLabels) }),
  ].filter((line): line is string => Boolean(line));

  return (
    <ScreenFrame
      testId="recommendations-screen"
      title={t("recommendations.title")}
      subtitle={
        <span className="flex flex-col gap-1" data-testid="recommendations-summary">
          {summaryLines.length > 0
            ? summaryLines.map((line) => <span key={line}>{line}</span>)
            : t("recommendations.summaryNone")}
        </span>
      }
      actions={
        <div className="flex w-full flex-col gap-3">
          {onSendSummary && (
            <PrimaryAction
              fullWidth
              data-testid="send-summary"
              icon={<ArrowRightIcon />}
              onClick={onSendSummary}
              disabled={primary.length === 0}
            >
              {t("recommendations.sendSummary")}
            </PrimaryAction>
          )}
          <div className="grid gap-3 sm:grid-cols-3">
            <SecondaryAction size="md" data-testid="continue-exploring" onClick={onContinueExploring}>
              {t("recommendations.continueExploring")}
            </SecondaryAction>
            <SecondaryAction size="md" data-testid="review-priorities" onClick={onReviewPriorities}>
              {t("recommendations.reviewPriorities")}
            </SecondaryAction>
            <ResetExperienceButton
              variant="action"
              testId="recommendations-start-over"
              onReset={onStartOver}
            />
          </div>
        </div>
      }
    >
      <p data-testid="recommendations-disclaimer" className="text-body text-ink-muted max-w-3xl text-pretty">
        {t("recommendations.disclaimer")}
      </p>
      {anyPending && <StatusBanner tone="warning" title={t("recommendations.demoNotice")} />}
      {changes.changed && <StatusBanner tone="info" title={t("recommendations.updated")} />}

      {primary.length === 0 ? (
        <EmptyState title={t("ui.emptyTitle")} body={t("recommendations.empty")} />
      ) : (
        <ol aria-label={t("recommendations.listLabel")} className="flex flex-col gap-6">
          {primary.map(({ item, solution }) => (
            <li key={item.solutionId} className="relative">
              {newBadge(item) && <div className="absolute -top-3 right-6 z-10">{newBadge(item)}</div>}
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
                  return asset
                    ? [{ title: localize(asset.title), pending: asset.validationStatus !== "validated" }]
                    : [];
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
                  {newBadge(item)}
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
