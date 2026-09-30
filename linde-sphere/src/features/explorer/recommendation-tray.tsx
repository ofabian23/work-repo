"use client";

import { useState } from "react";
import { PrimaryAction, SecondaryAction } from "@/components/actions/action-button";
import { PendingValidationBadge } from "@/components/content/pending-validation-badge";
import { SparkIcon } from "@/components/icons";
import { Sheet } from "@/components/overlay/dialog";
import type { PublicContentBundle } from "@/domain/content/visibility";
import { primaryItems, type RecommendationResult } from "@/domain/recommendations/recommendation-result";
import { recommendationChanges } from "@/domain/recommendations/recommendation-stability";
import { useLanguage } from "@/lib/i18n/language-provider";

/**
 * Optional compact "recommendation tray" in the explorer (ADR-051): a quick look at the current primary
 * recommendations without leaving the scene. New items since the visitor last looked are marked; opening
 * the tray counts as seeing them.
 */
export function RecommendationTray({
  result,
  seen,
  content,
  onOpen,
  onViewAll,
}: {
  result: RecommendationResult | null;
  /** What the visitor last saw (to mark what is new). */
  seen: RecommendationResult | null;
  content: PublicContentBundle;
  onOpen: () => void;
  onViewAll: () => void;
}) {
  const { t, localize } = useLanguage();
  const [open, setOpen] = useState(false);
  const [newIdsAtOpen, setNewIdsAtOpen] = useState<string[]>([]);
  const newCount = recommendationChanges(seen, result).newIds.length;
  const solutions = new Map(content.solutions.map((s) => [s.id, s]));
  const items = primaryItems(result);
  if (items.length === 0) return null;

  return (
    <>
      <SecondaryAction
        size="md"
        data-testid="recommendation-tray-button"
        icon={<SparkIcon size="size-6" />}
        onClick={() => {
          setNewIdsAtOpen(recommendationChanges(seen, result).newIds);
          setOpen(true);
          onOpen();
        }}
      >
        <span className="inline-flex items-center gap-2">
          {t("tray.button")}
          {newCount > 0 && (
            <span
              data-testid="recommendation-tray-new"
              className="bg-primary text-on-primary text-caption rounded-full px-2.5 py-0.5"
            >
              {t("tray.newCount", { count: newCount })}
            </span>
          )}
        </span>
      </SecondaryAction>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        testId="recommendation-tray"
        title={t("tray.title")}
        footer={
          <>
            <SecondaryAction data-autofocus onClick={() => setOpen(false)}>
              {t("tray.keepExploring")}
            </SecondaryAction>
            <PrimaryAction
              data-testid="recommendation-tray-view-all"
              onClick={() => {
                setOpen(false);
                onViewAll();
              }}
            >
              {t("tray.viewAll")}
            </PrimaryAction>
          </>
        }
      >
        <ol className="flex flex-col gap-3">
          {items.map((item) => {
            const solution = solutions.get(item.solutionId);
            if (!solution) return null;
            return (
              <li
                key={item.solutionId}
                data-testid={`tray-item-${item.solutionId}`}
                className="rounded-card border-line bg-surface-muted flex flex-col gap-2 border p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-lead text-ink font-bold">
                    {item.rank}. {localize(solution.title)}
                  </span>
                  <span className="bg-success-surface text-success text-caption rounded-full px-3 py-0.5 font-semibold">
                    {t(`recommendations.relevance.${item.relevanceLevel}`)}
                  </span>
                  {newIdsAtOpen.includes(item.solutionId) && (
                    <span className="bg-primary text-on-primary text-caption rounded-full px-3 py-0.5 font-semibold">
                      {t("recommendations.newBadge")}
                    </span>
                  )}
                  {item.pendingValidation && <PendingValidationBadge />}
                </div>
                <p className="text-body text-ink-muted">{localize(item.whyThisAppeared)}</p>
              </li>
            );
          })}
        </ol>
      </Sheet>
    </>
  );
}
