"use client";

import type { CSSProperties } from "react";
import { ArrowRightIcon, CheckIcon, InfoIcon, PlusIcon } from "@/components/icons";
import type { HotspotType, VisualImportance } from "@/domain/content/scene";
import { cn } from "@/lib/cn";
import { useLanguage } from "@/lib/i18n/language-provider";

const markerSize: Record<VisualImportance, string> = {
  primary: "size-20", // ≈ 80 px on phones, larger on the kiosk
  secondary: "size-16", // 64 px
  tertiary: "size-14", // 56 px (still above the 48 px minimum)
};

const typeIcon: Record<HotspotType, typeof InfoIcon> = {
  navigation: ArrowRightIcon,
  information: InfoIcon,
  solution: PlusIcon,
};

/**
 * Marker positioned on a scene art box (the parent must be `position: relative`). x/y are the center,
 * in 0–100 % of the art box. The label is always visible (no hover), the pulse stops for reduced motion
 * and after the hotspot has been visited.
 */
export function HotspotButton({
  x,
  y,
  width,
  height,
  type,
  label,
  accessibleLabel,
  importance = "primary",
  visited = false,
  onActivate,
  testId,
}: {
  x: number;
  y: number;
  width?: number;
  height?: number;
  type: HotspotType;
  label: string;
  accessibleLabel: string;
  importance?: VisualImportance;
  visited?: boolean;
  onActivate: () => void;
  testId?: string;
}) {
  const { t } = useLanguage();
  const Icon = typeIcon[type];
  // Keep the always-visible label inside the art box near its edges.
  const labelAlign = x < 25 ? "left-0" : x > 75 ? "right-0" : "left-1/2 -translate-x-1/2";
  const style: CSSProperties = {
    left: `${x}%`,
    top: `${y}%`,
    ...(width ? { width: `${width}%` } : {}),
    ...(height ? { height: `${height}%` } : {}),
  };

  return (
    <button
      type="button"
      data-testid={testId}
      data-hotspot-type={type}
      data-visited={visited || undefined}
      aria-label={visited ? `${accessibleLabel} (${t("ui.hotspotVisited")})` : accessibleLabel}
      onClick={onActivate}
      style={style}
      className="focus-ring group min-h-touch min-w-touch absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full"
    >
      <span className={cn("relative flex items-center justify-center", markerSize[importance])}>
        {!visited && (
          <span
            aria-hidden
            data-testid="hotspot-pulse"
            className="bg-primary motion-safe:animate-pulse-ring absolute inset-0 rounded-full"
          />
        )}
        <span
          aria-hidden
          className={cn(
            "border-surface shadow-raised relative flex size-full items-center justify-center rounded-full border-4",
            visited ? "bg-surface text-primary" : "bg-primary text-on-primary",
            "ease-standard transition-transform duration-(--duration-fast) motion-safe:group-active:scale-95",
          )}
        >
          {visited ? <CheckIcon size="size-8" /> : <Icon size="size-8" />}
        </span>
      </span>
      <span
        aria-hidden
        className={cn(
          "bg-surface text-ink text-label shadow-card border-line absolute top-full mt-2 rounded-full border px-4 py-1.5 font-semibold whitespace-nowrap",
          labelAlign,
        )}
      >
        {label}
      </span>
    </button>
  );
}
