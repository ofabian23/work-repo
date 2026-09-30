"use client";

import type { CSSProperties } from "react";
import { ArrowRightIcon, CheckIcon, InfoIcon, PlusIcon, SparkIcon } from "@/components/icons";
import type { HotspotType, VisualImportance } from "@/domain/content/scene";
import { cn } from "@/lib/cn";
import { useLanguage } from "@/lib/i18n/language-provider";

/** Marker diameters; keep in sync with `MARKER_REM` in features/explorer/hotspot-layout.ts. */
const markerSize: Record<VisualImportance, string> = {
  primary: "size-20", // 5rem: ≈ 80 px on phones, larger on the kiosk
  secondary: "size-16", // 4rem
  tertiary: "size-14", // 3.5rem (still above the 48 px minimum)
};
/** Smaller markers for small art boxes (phones, short laptop screens); never below 48 px (3rem). */
const compactMarkerSize: Record<VisualImportance, string> = {
  primary: "size-14", // 3.5rem
  secondary: "size-12", // 3rem
  tertiary: "size-12",
};

const typeIcon: Record<HotspotType, typeof InfoIcon> = {
  navigation: ArrowRightIcon,
  information: InfoIcon,
  solution: PlusIcon,
};

const alignClass = {
  center: "left-1/2 -translate-x-1/2 text-center",
  start: "left-0 text-left",
  end: "right-0 text-right",
} as const;

/**
 * Marker positioned on a scene art box (the parent must be `position: relative`). x/y are the center,
 * in 0–100 % of the art box. Labels are either always visible ("always", for the main hotspots) or shown
 * on touch, focus, hover and while the hotspot's panel is open ("interactive"), so a scene never gets
 * crowded with text. The pulse stops for reduced motion and after the hotspot has been visited.
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
  active = false,
  highlighted = false,
  highlightLabel,
  labelMode = "always",
  labelPlacement = "below",
  labelAlign,
  compact = false,
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
  /** The hotspot whose panel is open: label shown and marker emphasized. */
  active?: boolean;
  /** Relevant to the visitor's choices (e.g. an area behind their recommendations). */
  highlighted?: boolean;
  /** Announced with the accessible name when highlighted, e.g. "Relevante para usted". */
  highlightLabel?: string;
  labelMode?: "always" | "interactive";
  labelPlacement?: "below" | "above";
  labelAlign?: "center" | "start" | "end";
  /** Use the smaller marker sizes (decided by the viewer from the art box size). */
  compact?: boolean;
  onActivate: () => void;
  testId?: string;
}) {
  const { t } = useLanguage();
  const Icon = typeIcon[type];
  // Without a computed layout, keep the label inside the art box near its edges.
  const align = labelAlign ?? (x < 25 ? "start" : x > 75 ? "end" : "center");
  const style: CSSProperties = {
    left: `${x}%`,
    top: `${y}%`,
    ...(width ? { width: `${width}%` } : {}),
    ...(height ? { height: `${height}%` } : {}),
  };
  // e.g. "Ir a la UCI · Relevante para usted (Visitado)"
  const name =
    accessibleLabel +
    (highlighted && highlightLabel ? ` · ${highlightLabel}` : "") +
    (visited ? ` (${t("ui.hotspotVisited")})` : "");

  return (
    <button
      type="button"
      data-testid={testId}
      data-hotspot-type={type}
      data-visited={visited || undefined}
      data-highlighted={highlighted || undefined}
      data-x={x}
      data-y={y}
      aria-label={name}
      onClick={onActivate}
      style={style}
      className={cn(
        "focus-ring group absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full",
        // The button is at least the marker; compact markers are themselves ≥ 48 px (WCAG 2.2 minimum).
        compact ? "min-h-touch-min min-w-touch-min" : "min-h-touch min-w-touch",
        active ? "z-30" : "z-10 focus-visible:z-30 active:z-30",
      )}
    >
      <span
        className={cn(
          "relative flex items-center justify-center",
          (compact ? compactMarkerSize : markerSize)[importance],
        )}
      >
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
            active && "ring-focus ring-4",
            "ease-standard transition-transform duration-(--duration-fast) motion-safe:group-active:scale-95",
          )}
        >
          {visited ? (
            <CheckIcon size={compact ? "size-6" : "size-8"} />
          ) : (
            <Icon size={compact ? "size-6" : "size-8"} />
          )}
        </span>
        {highlighted && (
          <span
            aria-hidden
            data-testid="hotspot-highlight"
            className="bg-accent text-on-primary border-surface absolute -top-2 -right-2 flex size-8 items-center justify-center rounded-full border-2"
          >
            <SparkIcon size="size-5" />
          </span>
        )}
      </span>
      <span
        aria-hidden
        data-testid="hotspot-label"
        data-label-placement={labelPlacement}
        className={cn(
          "bg-surface text-ink text-label shadow-card border-line pointer-events-none absolute w-max max-w-[min(20rem,70cqw)] rounded-2xl border px-4 py-1.5 leading-snug font-semibold",
          labelPlacement === "below" ? "top-full mt-2" : "bottom-full mb-2",
          alignClass[align],
          labelMode === "always" || active
            ? "opacity-100"
            : "opacity-0 transition-opacity duration-(--duration-fast) group-hover:opacity-100 group-focus-visible:opacity-100 group-active:opacity-100",
        )}
      >
        {label}
      </span>
    </button>
  );
}
