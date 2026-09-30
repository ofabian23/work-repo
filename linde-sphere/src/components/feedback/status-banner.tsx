import type { ReactNode } from "react";
import { AlertIcon, CheckIcon, ErrorIcon, InfoIcon } from "@/components/icons";
import { cn } from "@/lib/cn";

export type StatusTone = "info" | "success" | "warning" | "error";

const tones: Record<StatusTone, { box: string; icon: ReactNode }> = {
  info: { box: "bg-info-surface text-info border-info/30", icon: <InfoIcon /> },
  success: { box: "bg-success-surface text-success border-success/30", icon: <CheckIcon /> },
  warning: { box: "bg-notice-surface text-notice border-notice/30", icon: <AlertIcon /> },
  error: { box: "bg-danger-surface text-danger border-danger/30", icon: <ErrorIcon /> },
};

/**
 * Inline message with an icon and text (color is never the only signal). Errors use role="alert"
 * so they are announced immediately; other tones use a polite status region.
 */
export function StatusBanner({
  tone = "info",
  title,
  children,
  action,
  className,
}: {
  tone?: StatusTone;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      data-tone={tone}
      className={cn("rounded-card flex items-start gap-4 border-2 p-5", tones[tone].box, className)}
    >
      <span className="mt-0.5">{tones[tone].icon}</span>
      <div className="flex flex-1 flex-col gap-1">
        <p className="text-lead font-semibold">{title}</p>
        {children && <div className="text-body text-ink">{children}</div>}
      </div>
      {action}
    </div>
  );
}
