"use client";

import { AlertIcon } from "@/components/icons";
import { cn } from "@/lib/cn";
import { useLanguage } from "@/lib/i18n/language-provider";

/** Discreet but readable marker for assumed offering content in demo mode (CONTENT_VALIDATION.md §4). */
export function PendingValidationBadge({ className }: { className?: string }) {
  const { t } = useLanguage();
  return (
    <span
      data-testid="pending-validation"
      className={cn(
        "bg-notice-surface text-notice text-caption inline-flex items-center gap-2 rounded-full px-3 py-1 font-medium",
        className,
      )}
    >
      <AlertIcon size="size-5" />
      {t("ui.pendingValidation")}
    </span>
  );
}
