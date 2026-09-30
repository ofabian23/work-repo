import type { ReactNode } from "react";
import { ArrowRightIcon } from "@/components/icons";
import { cn } from "@/lib/cn";

/**
 * Large navigation card (≥ 128 px tall) for choosing where to go next, e.g. the three entry paths.
 * Unlike TouchCard it is an action, not a toggle: no aria-pressed, an arrow signals "go".
 */
export function ActionCard({
  title,
  description,
  icon,
  onActivate,
  testId,
  className,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  onActivate: () => void;
  testId?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onActivate}
      className={cn(
        "focus-ring rounded-card border-line bg-surface shadow-card flex min-h-32 w-full items-center gap-4 border-2 p-5 text-left sm:gap-6 sm:p-6",
        "active:border-primary active:bg-primary/5 ease-standard transition-[border-color,background-color,transform] duration-(--duration-fast) motion-safe:active:scale-[0.99]",
        className,
      )}
    >
      {icon && (
        <span className="bg-primary text-on-primary rounded-control flex size-14 shrink-0 items-center justify-center sm:size-20 [&>svg]:size-8 sm:[&>svg]:size-10">
          {icon}
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-title text-ink font-bold text-balance">{title}</span>
        {description && <span className="text-body text-ink-muted text-pretty">{description}</span>}
      </span>
      <ArrowRightIcon className="text-primary" size="size-8 sm:size-10" />
    </button>
  );
}
