"use client";

import { useId, type InputHTMLAttributes } from "react";
import { ErrorIcon } from "@/components/icons";
import { cn } from "@/lib/cn";
import { useLanguage } from "@/lib/i18n/language-provider";

type FormFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "size"> & {
  label: string;
  hint?: string;
  /** Localized validation message; sets aria-invalid and is announced with the field. */
  error?: string;
  type?: "text" | "email" | "tel";
};

/**
 * Labeled text input for the lead form: 64 px tall, large text, visible label (never placeholder-only),
 * hint and error wired through aria-describedby. Autofill is off by default on the shared kiosk.
 */
export function FormField({
  label,
  hint,
  error,
  required,
  type = "text",
  autoComplete = "off",
  className,
  ...props
}: FormFieldProps) {
  const { t } = useLanguage();
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label htmlFor={id} className="text-label text-ink flex items-baseline gap-2 font-semibold">
        {label}
        {!required && <span className="text-caption text-ink-muted font-normal">({t("ui.optional")})</span>}
      </label>
      {hint && (
        <p id={hintId} className="text-caption text-ink-muted">
          {hint}
        </p>
      )}
      <input
        id={id}
        type={type}
        required={required}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        autoComplete={autoComplete}
        spellCheck={false}
        className={cn(
          "focus-ring rounded-control bg-surface text-ink text-lead min-h-touch w-full border-2 px-5",
          error ? "border-danger" : "border-line focus-visible:border-focus",
        )}
        {...props}
      />
      {error && (
        <p id={errorId} className="text-body text-danger flex items-center gap-2 font-medium">
          <ErrorIcon size="size-6" />
          {error}
        </p>
      )}
    </div>
  );
}
