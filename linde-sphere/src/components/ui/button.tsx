import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary";
type Size = "lg" | "md";

const variants: Record<Variant, string> = {
  primary: "bg-primary text-on-primary active:brightness-95",
  secondary: "border-2 border-primary bg-surface text-primary active:bg-surface-muted",
};

/** lg ≥ 64 px (primary actions), md ≥ 56 px — both above the 48 px minimum. */
const sizes: Record<Size, string> = {
  lg: "min-h-16 px-8 text-xl",
  md: "min-h-14 px-6 text-lg",
};

export function Button({
  variant = "primary",
  size = "lg",
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex min-w-16 items-center justify-center gap-3 rounded-2xl font-semibold",
        "focus-visible:outline-focus transition focus-visible:outline-4 focus-visible:outline-offset-4",
        "disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
}
