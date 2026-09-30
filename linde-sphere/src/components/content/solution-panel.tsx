"use client";

import { CheckIcon, PlusIcon } from "@/components/icons";
import { cn } from "@/lib/cn";
import { useLanguage } from "@/lib/i18n/language-provider";
import { PendingValidationBadge } from "./pending-validation-badge";

export type SolutionPanelItem = {
  id: string;
  title: string;
  summary: string;
  nextStep?: string;
  pendingValidation: boolean;
};

/**
 * Body of a solution hotspot's Sheet: one block per solution with an "Add to my interests" toggle
 * (an explicit interest is the strongest recommendation signal).
 */
export function SolutionPanel({
  solutions,
  interestIds,
  onToggleInterest,
}: {
  solutions: SolutionPanelItem[];
  interestIds: string[];
  onToggleInterest: (solutionId: string) => void;
}) {
  const { t } = useLanguage();
  return (
    <ul className="flex flex-col gap-5" data-testid="solution-panel">
      {solutions.map((s) => {
        const added = interestIds.includes(s.id);
        return (
          <li key={s.id} className="rounded-card border-line bg-surface-muted flex flex-col gap-4 border p-5">
            <div className="flex flex-col gap-2">
              <h3 className="text-title text-ink font-bold">{s.title}</h3>
              {s.pendingValidation && <PendingValidationBadge className="self-start" />}
            </div>
            <p className="text-body text-ink">{s.summary}</p>
            {s.nextStep && (
              <p className="text-body text-ink-muted">
                <span className="text-ink font-semibold">{t("ui.nextStep")}: </span>
                {s.nextStep}
              </p>
            )}
            <button
              type="button"
              aria-pressed={added}
              onClick={() => onToggleInterest(s.id)}
              data-testid={`interest-${s.id}`}
              className={cn(
                "focus-ring rounded-control text-label min-h-touch inline-flex items-center justify-center gap-3 self-start border-2 px-6 font-semibold",
                added
                  ? "border-success bg-success-surface text-success"
                  : "border-primary bg-surface text-primary",
              )}
            >
              {added ? <CheckIcon /> : <PlusIcon />}
              {added ? t("ui.addedToInterests") : t("ui.addToInterests")}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
