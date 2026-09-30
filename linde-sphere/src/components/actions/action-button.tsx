import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

type ActionProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  children: ReactNode;
  /** Icon placed after the label (e.g. an arrow for "continue"). */
  icon?: ReactNode;
  /** "lg" = 64 px min height (default), "xl" = 80 px for hero actions, "md" = 56 px for secondary rows. */
  size?: "md" | "lg" | "xl";
  fullWidth?: boolean;
};

const sizes = {
  md: "min-h-14 px-6 text-label",
  lg: "min-h-touch px-8 text-lead",
  xl: "min-h-touch-lg px-10 text-title",
};

const base =
  "focus-ring inline-flex min-w-touch items-center justify-center gap-3 rounded-control font-semibold " +
  "transition-[background-color,box-shadow,transform] duration-(--duration-fast) ease-standard " +
  "motion-safe:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50";

function ActionButton({
  variant,
  size = "lg",
  fullWidth,
  icon,
  className,
  type = "button",
  children,
  ...props
}: ActionProps & { variant: "primary" | "secondary" }) {
  return (
    <button
      type={type}
      data-variant={variant}
      className={cn(
        base,
        sizes[size],
        fullWidth && "w-full",
        variant === "primary"
          ? "bg-primary text-on-primary shadow-card active:shadow-none"
          : "border-primary bg-surface text-primary active:bg-surface-muted border-2",
        className,
      )}
      {...props}
    >
      <span>{children}</span>
      {icon}
    </button>
  );
}

/** The one main action on a screen: filled, high contrast, ≥ 64 px tall. */
export function PrimaryAction(props: ActionProps) {
  return <ActionButton variant="primary" {...props} />;
}

/** Alternative action next to a PrimaryAction: outlined, same touch size. */
export function SecondaryAction(props: ActionProps) {
  return <ActionButton variant="secondary" {...props} />;
}
