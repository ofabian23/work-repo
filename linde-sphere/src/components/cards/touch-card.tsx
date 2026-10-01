"use client";

import type { ReactNode } from "react";
import { CheckIcon } from "@/components/icons";
import { cn } from "@/lib/cn";
import { useLanguage } from "@/lib/i18n/language-provider";

export type TouchCardProps = {
  title: string;
  description?: string;
  icon?: ReactNode;
  /** Leading visual drawn as-is (e.g. a persona portrait), instead of the tinted `icon` square. */
  media?: ReactNode;
  /** When provided the card is a toggle button (aria-pressed); omit for a static information card. */
  selected?: boolean;
  onSelect?: () => void;
  /** Disabled cards stay focusable (aria-disabled) so the reason can be read out. */
  disabled?: boolean;
  /** Extra explanation announced with the card, e.g. why it is disabled. */
  hint?: string;
  /** Visual indicator for selected state: "check" (single choice) or "checkbox" (multi-select). */
  indicator?: "check" | "checkbox";
  /** "compact" tightens spacing for long lists that must fit one screen (still ≥ 80 px tall). */
  density?: "comfortable" | "compact";
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
  media,
  selected,
  onSelect,
  disabled = false,
  hint,
  indicator = "check",
  density = "comfortable",
  testId,
  className,
}: TouchCardProps) {
  const { t } = useLanguage();
  const interactive = onSelect !== undefined;
  const compact = density === "compact";
  // With a leading visual on a compact card, the selection mark sits on the visual's corner, so the text
  // keeps the width the corner mark would otherwise reserve (long role names wrap less).
  const markOnMedia = compact && media !== undefined;
  const mark = interactive && (
    <span
      aria-hidden
      data-testid="selection-mark"
      className={cn(
        "flex shrink-0 items-center justify-center border-2",
        markOnMedia
          ? "absolute -right-2 bottom-0 size-7"
          : compact
            ? "absolute top-3 right-3 size-8"
            : "size-10",
        indicator === "checkbox" ? "rounded-lg" : "rounded-full",
        selected ? "border-primary bg-primary text-on-primary" : "border-line bg-surface text-transparent",
      )}
    >
      <CheckIcon size={markOnMedia ? "size-4" : compact ? "size-5" : "size-6"} />
    </span>
  );
  const content = (
    <>
      {media && (
        <span className="relative flex shrink-0 items-center self-stretch">
          {media}
          {markOnMedia && mark}
        </span>
      )}
      {!media && icon && (
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
        <span className={cn("text-ink font-semibold text-balance", compact ? "text-label" : "text-lead")}>
          {title}
        </span>
        {description && (
          <span className={cn("text-ink-muted text-pretty", compact ? "text-caption" : "text-body")}>
            {description}
          </span>
        )}
        {hint && <span className="text-caption text-notice font-medium">{hint}</span>}
      </span>
      {/* Compact cards put the mark in the corner so the text can use the full width. */}
      {!markOnMedia && mark}
      {selected && <span className="sr-only">{t("ui.selected")}</span>}
    </>
  );

  const classes = cn(
    "rounded-card flex w-full items-center border-2 text-left",
    compact
      ? markOnMedia
        ? "relative min-h-20 gap-3 py-1.5 pr-4 pl-3"
        : "relative min-h-20 gap-4 py-3 pr-14 pl-5"
      : "min-h-24 gap-5 p-5",
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
