"use client";

import { useId, type SelectHTMLAttributes } from "react";
import { ChevronDownIcon, ErrorIcon } from "@/components/icons";
import { cn } from "@/lib/cn";

/**
 * Labeled native select (64 px): on the Android kiosk it opens the system picker, which is easier to use
 * by touch than a custom dropdown. Error text is wired through aria-describedby like FormField.
 */
export function SelectField({
  label,
  error,
  placeholder,
  options,
  className,
  ...props
}: Omit<SelectHTMLAttributes<HTMLSelectElement>, "id" | "children"> & {
  label: string;
  error?: string;
  placeholder: string;
  options: { value: string; label: string }[];
}) {
  const id = useId();
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label htmlFor={id} className="text-label text-ink font-semibold">
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId}
          className={cn(
            "focus-ring rounded-control bg-surface text-ink text-lead min-h-touch w-full appearance-none border-2 pr-14 pl-5",
            error ? "border-danger" : "border-line focus-visible:border-focus",
          )}
          {...props}
        >
          <option value="" disabled>
            {placeholder}
          </option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDownIcon className="text-ink-muted pointer-events-none absolute top-1/2 right-5 -translate-y-1/2" />
      </div>
      {error && (
        <p id={errorId} className="text-body text-danger flex items-center gap-2 font-medium">
          <ErrorIcon size="size-6" />
          {error}
        </p>
      )}
    </div>
  );
}
