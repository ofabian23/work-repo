"use client";

import type { ReactNode } from "react";
import { CheckIcon } from "@/components/icons";
import { cn } from "@/lib/cn";
import { useLanguage } from "@/lib/i18n/language-provider";

export type TouchCardProps = {
  title: string;
  description?: string;
  icon?: ReactNode;
  /** When provided the card is a toggle button (aria-pressed); omit for a static information card. */
  selected?: boolean;
  onSelect?: () => void;
  /** Disabled cards stay focusable (aria-disabled) so the reason can be read out. */
  disabled?: boolean;
  /** Extra explanation announced with the card, e.g. why it is disabled. */
  hint?: string;
  /** Visual indicator for selected state: "check" (single choice) or "checkbox" (multi-select). */
  indicator?: "check" | "checkbox";
  testId?: string;
  className?: string;
};

/**
 * Large tappable card (≥ 96 px tall): the building block for personas, challenges and other choices.
 * Operable with touch, mouse, Enter and Space; selection is shown by border, fill, icon and text.
 */
export function TouchCard({
  title,
  description,
  icon,
  selected,
  onSelect,
  disabled = false,
  hint,
  indicator = "check",
  testId,
  className,
}: TouchCardProps) {
  const { t } = useLanguage();
  const interactive = onSelect !== undefined;
  const content = (
    <>
      {icon && (
        <span
          className={cn(
            "rounded-control flex size-16 shrink-0 items-center justify-center",
            selected ? "bg-primary text-on-primary" : "bg-primary/10 text-primary",
          )}
        >
          {icon}
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-col gap-1 text-left">
        <span className="text-lead text-ink font-semibold text-balance">{title}</span>
        {description && <span className="text-body text-ink-muted text-pretty">{description}</span>}
        {hint && <span className="text-caption text-notice font-medium">{hint}</span>}
      </span>
      {interactive && (
        <span
          aria-hidden
          className={cn(
            "flex size-10 shrink-0 items-center justify-center border-2",
            indicator === "checkbox" ? "rounded-lg" : "rounded-full",
            selected
              ? "border-primary bg-primary text-on-primary"
              : "border-line bg-surface text-transparent",
          )}
        >
          <CheckIcon size="size-6" />
        </span>
      )}
      {selected && <span className="sr-only">{t("ui.selected")}</span>}
    </>
  );

  const classes = cn(
    "rounded-card flex min-h-24 w-full items-center gap-5 border-2 p-5 text-left",
    "transition-[border-color,background-color,box-shadow] duration-(--duration-fast) ease-standard",
    selected ? "border-primary bg-primary/5 shadow-card" : "border-line bg-surface",
    className,
  );

  if (!interactive) {
    return (
      <div data-testid={testId} className={classes}>
        {content}
      </div>
    );
  }

  return (
    <button
      type="button"
      data-testid={testId}
      aria-pressed={selected ?? false}
      aria-disabled={disabled || undefined}
      onClick={() => {
        if (!disabled) onSelect();
      }}
      className={cn(
        classes,
        "focus-ring",
        disabled ? "cursor-not-allowed opacity-60" : "active:bg-surface-muted",
      )}
    >
      {content}
    </button>
  );
}
