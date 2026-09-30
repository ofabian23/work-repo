"use client";

import { cn } from "@/lib/cn";
import { useLanguage } from "@/lib/i18n/language-provider";

/**
 * "Step 2 of 4" text plus a segmented bar (text carries the meaning; segments are visual support).
 * Optional step labels mark the current step with aria-current="step".
 */
export function ProgressIndicator({
  current,
  total,
  steps,
  className,
}: {
  /** 1-based index of the current step. */
  current: number;
  total: number;
  steps?: string[];
  className?: string;
}) {
  const { t } = useLanguage();
  const safeCurrent = Math.min(Math.max(current, 1), total);
  return (
    <div
      role="group"
      aria-label={t("ui.progressLabel")}
      className={cn("flex flex-col gap-3", className)}
      data-testid="progress"
    >
      <p className="text-label text-ink-muted font-semibold">
        {t("ui.stepOf", { current: safeCurrent, total })}
      </p>
      <div aria-hidden className="flex gap-2">
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className={cn(
              "ease-standard h-2.5 flex-1 rounded-full transition-colors duration-(--duration-base)",
              i < safeCurrent ? "bg-primary" : "bg-line",
            )}
          />
        ))}
      </div>
      {steps && steps.length === total && (
        <ol className="hidden gap-2 sm:flex">
          {steps.map((label, i) => (
            <li
              key={label}
              aria-current={i + 1 === safeCurrent ? "step" : undefined}
              className={cn(
                "text-caption flex-1",
                i + 1 === safeCurrent ? "text-ink font-semibold" : "text-ink-muted",
              )}
            >
              {label}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
