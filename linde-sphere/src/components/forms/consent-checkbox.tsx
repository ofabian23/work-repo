"use client";

import { useId } from "react";
import { CheckIcon, ErrorIcon } from "@/components/icons";
import { cn } from "@/lib/cn";
import { useLanguage } from "@/lib/i18n/language-provider";

/**
 * One consent choice. Consents are always separate checkboxes, unchecked by default, and the wording
 * comes from configurable content (content/consent.json), so it is passed in as `label`.
 * A native checkbox keeps keyboard/screen-reader behavior; the whole row (≥ 64 px) is the tap target.
 */
export function ConsentCheckbox({
  label,
  checked,
  onChange,
  required = false,
  error,
  name,
  testId,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  required?: boolean;
  error?: string;
  name?: string;
  testId?: string;
}) {
  const { t } = useLanguage();
  const id = useId();
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={id}
        className={cn(
          "rounded-card min-h-touch flex cursor-pointer items-start gap-4 border-2 p-4",
          error ? "border-danger" : checked ? "border-primary bg-primary/5" : "border-line bg-surface",
        )}
      >
        <input
          id={id}
          name={name}
          type="checkbox"
          data-testid={testId}
          className="peer sr-only"
          checked={checked}
          required={required}
          aria-required={required || undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span
          aria-hidden
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-lg border-2",
            "peer-focus-visible:outline-focus peer-focus-visible:outline-4 peer-focus-visible:outline-offset-2",
            checked
              ? "border-primary bg-primary text-on-primary"
              : "border-ink-muted bg-surface text-transparent",
          )}
        >
          <CheckIcon size="size-7" />
        </span>
        <span className="flex flex-col gap-1">
          <span className="text-body text-ink">{label}</span>
          <span className={cn("text-caption font-semibold", required ? "text-ink" : "text-ink-muted")}>
            {required ? t("ui.required") : t("ui.optional")}
          </span>
        </span>
      </label>
      {error && (
        <p id={errorId} className="text-body text-danger flex items-center gap-2 font-medium">
          <ErrorIcon size="size-6" />
          {error}
        </p>
      )}
    </div>
  );
}
