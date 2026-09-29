import { brandConfig } from "@/lib/config/brand-config";
import { cn } from "@/lib/cn";

/**
 * Text wordmark for the product name. Deliberately not a logo: no corporate brand marks are used until
 * approved assets are configured in brand-config.ts (ADR-001).
 */
export function BrandWordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-3", className)}>
      <span
        aria-hidden
        className="border-primary inline-block size-7 shrink-0 rounded-full border-[5px] opacity-90"
      />
      <span className="text-ink text-2xl font-bold tracking-tight">{brandConfig.productName}</span>
    </span>
  );
}
