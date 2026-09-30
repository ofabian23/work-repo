"use client";

import { brandConfig, type BrandConfig } from "@/lib/config/brand-config";
import { cn } from "@/lib/cn";
import { useLanguage } from "@/lib/i18n/language-provider";

/**
 * Product wordmark. A logo is shown only when brand-config.ts supplies one AND marks the branding as
 * approved; the logo path is always a local file under public/ (never a remote or copied asset).
 * Otherwise a neutral text wordmark with a generic ring glyph is rendered (ADR-001, ADR-036).
 */
export function BrandWordmark({
  className,
  brand = brandConfig,
}: {
  className?: string;
  brand?: BrandConfig;
}) {
  const { localize } = useLanguage();
  const showLogo = brand.logo !== null && brand.approvalStatus === "approved";

  return (
    <span className={cn("inline-flex items-center gap-3", className)} data-testid="brand-wordmark">
      {showLogo && brand.logo ? (
        // eslint-disable-next-line @next/next/no-img-element -- local, pre-sized SVG/PNG; no optimization needed
        <img src={brand.logo.src} alt={localize(brand.logo.alt)} className="h-10 w-auto" draggable={false} />
      ) : (
        <span
          aria-hidden
          className="border-primary inline-block size-7 shrink-0 rounded-full border-[5px] opacity-90"
        />
      )}
      <span className="text-ink text-title font-bold tracking-tight">{brand.productName}</span>
    </span>
  );
}
