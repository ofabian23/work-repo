"use client";

import type { ReactNode } from "react";
import { PendingValidationBadge } from "@/components/content/pending-validation-badge";
import { SparkIcon } from "@/components/icons";
import { useLanguage } from "@/lib/i18n/language-provider";

/**
 * One recommended solution category. The "Why this appeared" box is always visible (explainability
 * requirement); numeric scores are never shown. Strings arrive already localized by the caller.
 */
export function RecommendationCard({
  rank,
  title,
  summary,
  whyThisAppeared,
  relevance,
  nextStep,
  relatedAreas = [],
  relevanceLabel,
  resources = [],
  pendingValidation,
  actions,
  testId,
}: {
  rank: number;
  title: string;
  summary: string;
  whyThisAppeared: string;
  relevance?: string;
  nextStep?: string;
  relatedAreas?: string[];
  /** Relevance in words, e.g. "Muy relevante" (never a number or percentage). */
  relevanceLabel?: string;
  /** Resources for this recommendation; `pending` marks demo-status resources awaiting validation. */
  resources?: { title: string; pending: boolean }[];
  pendingValidation: boolean;
  actions?: ReactNode;
  testId?: string;
}) {
  const { t } = useLanguage();
  return (
    <article
      data-testid={testId}
      aria-label={`${t("ui.recommendationRank", { rank })}: ${title}`}
      className="rounded-card border-line bg-surface shadow-card flex flex-col gap-5 border-2 p-6"
    >
      <header className="flex items-start gap-4">
        <span
          aria-hidden
          className="bg-primary text-on-primary text-lead flex size-12 shrink-0 items-center justify-center rounded-full font-bold"
        >
          {rank}
        </span>
        <div className="flex flex-1 flex-col gap-2">
          <h3 className="text-title text-ink font-bold text-balance">{title}</h3>
          <div className="flex flex-wrap gap-2">
            {relevanceLabel && (
              <span
                data-testid="relevance-label"
                className="bg-success-surface text-success text-label rounded-full px-3 py-1 font-semibold"
              >
                {relevanceLabel}
              </span>
            )}
            {pendingValidation && <PendingValidationBadge className="self-start" />}
          </div>
        </div>
      </header>

      <p className="text-body text-ink">{summary}</p>

      <section
        aria-label={t("ui.whyThisAppeared")}
        className="bg-info-surface rounded-control flex gap-4 p-5"
      >
        <SparkIcon className="text-info mt-1" />
        <div className="flex flex-col gap-1">
          <h4 className="text-label text-info font-semibold">{t("ui.whyThisAppeared")}</h4>
          <p className="text-body text-ink">{whyThisAppeared}</p>
        </div>
      </section>

      {(relevance || nextStep || relatedAreas.length > 0 || resources.length > 0) && (
        <dl className="grid gap-4">
          {relevance && (
            <div>
              <dt className="text-label text-ink-muted font-semibold">{t("ui.relevance")}</dt>
              <dd className="text-body text-ink">{relevance}</dd>
            </div>
          )}
          {relatedAreas.length > 0 && (
            <div>
              <dt className="text-label text-ink-muted font-semibold">{t("ui.relatedAreas")}</dt>
              <dd className="mt-2 flex flex-wrap gap-2">
                {relatedAreas.map((area) => (
                  <span
                    key={area}
                    className="bg-surface-muted border-line text-caption rounded-full border px-3 py-1"
                  >
                    {area}
                  </span>
                ))}
              </dd>
            </div>
          )}
          {resources.length > 0 && (
            <div>
              <dt className="text-label text-ink-muted font-semibold">{t("recommendations.resources")}</dt>
              <dd className="text-body text-ink">
                <ul className="list-disc pl-6" data-testid="recommendation-resources">
                  {resources.map((r) => (
                    <li key={r.title}>
                      {r.title}
                      {r.pending && (
                        <span className="text-notice text-caption font-medium">
                          {" "}
                          ({t("recommendations.resourcePending")})
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
          )}
          {nextStep && (
            <div>
              <dt className="text-label text-ink-muted font-semibold">{t("ui.nextStep")}</dt>
              <dd className="text-body text-ink">{nextStep}</dd>
            </div>
          )}
        </dl>
      )}

      {actions && <div className="flex flex-wrap gap-4">{actions}</div>}
    </article>
  );
}
