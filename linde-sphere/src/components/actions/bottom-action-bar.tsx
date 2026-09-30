import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Sticks primary actions to the bottom of the screen, in comfortable thumb/arm reach on a tall portrait
 * display. Put the PrimaryAction last so it sits on the right on wide layouts and first in reading order
 * for secondary actions.
 */
export function BottomActionBar({
  children,
  label,
  className,
}: {
  children: ReactNode;
  /** Accessible name for the action region, e.g. t("ui.actions"). */
  label: string;
  className?: string;
}) {
  return (
    <div
      role="region"
      aria-label={label}
      className={cn(
        "border-line bg-surface/95 px-gutter sticky bottom-0 z-10 border-t py-5",
        "pb-[max(1.25rem,env(safe-area-inset-bottom))]",
        className,
      )}
    >
      <div className="flex flex-col-reverse gap-4 sm:flex-row sm:items-center sm:justify-end">{children}</div>
    </div>
  );
}
