import type { VisualImportance } from "@/domain/content/scene";

/**
 * Pure hotspot layout for the scene viewer (ADR-049). Content places hotspots in percentages of the art
 * box; on a given screen the markers have a fixed physical size (touch targets), so on small screens two
 * nearby markers can collide. This nudges overlapping markers apart (deterministically, as little as
 * possible, never outside the art box) and chooses where each label goes so labels avoid markers and
 * each other where possible.
 */

export type LayoutItem = {
  id: string;
  /** Authored center, % of the art box. */
  x: number;
  y: number;
  importance: VisualImportance;
  label: string;
  /** Always-visible labels take part in collision checks; interactive ones only stay inside the box. */
  labelAlways: boolean;
};

export type LayoutMetrics = {
  /** Art box size in CSS px. */
  width: number;
  height: number;
  /** Compact markers are in use (small art box). */
  compact: boolean;
  /** Marker diameters in px. */
  marker: Record<VisualImportance, number>;
  /** Space kept between two markers, px. */
  gap: number;
  /** Approximate label geometry in px. */
  labelLineHeight: number;
  labelCharWidth: number;
  labelPaddingX: number;
  labelMaxWidth: number;
  /** Distance between marker edge and label, px. */
  labelOffset: number;
};

export type LabelPlacement = "below" | "above";
export type LabelAlign = "center" | "start" | "end";

export type PlacedHotspot = {
  id: string;
  /** Rendered center, % of the art box (equal to the authored one unless it had to move). */
  x: number;
  y: number;
  moved: boolean;
  labelPlacement: LabelPlacement;
  labelAlign: LabelAlign;
};

type Rect = { left: number; top: number; right: number; bottom: number };

const MAX_ITERATIONS = 60;
const round2 = (n: number) => Math.round(n * 100) / 100;
const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

function overlapArea(a: Rect, b: Rect): number {
  const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  return w > 0 && h > 0 ? w * h : 0;
}

/** Label box for a marker centered at (cx, cy) with diameter d. */
export function labelRect(
  label: string,
  cx: number,
  cy: number,
  d: number,
  placement: LabelPlacement,
  align: LabelAlign,
  m: LayoutMetrics,
): Rect {
  const textWidth = label.length * m.labelCharWidth;
  const innerMax = m.labelMaxWidth - 2 * m.labelPaddingX;
  const lines = Math.max(1, Math.ceil(textWidth / innerMax));
  const width = Math.min(textWidth, innerMax) + 2 * m.labelPaddingX;
  const height = lines * m.labelLineHeight + 2 * (m.labelLineHeight * 0.3);
  const top = placement === "below" ? cy + d / 2 + m.labelOffset : cy - d / 2 - m.labelOffset - height;
  const left = align === "center" ? cx - width / 2 : align === "start" ? cx - d / 2 : cx + d / 2 - width;
  return { left, top, right: left + width, bottom: top + height };
}

/** Horizontal alignment that keeps the label inside the art box. */
function alignFor(label: string, cx: number, d: number, m: LayoutMetrics): LabelAlign {
  const centered = labelRect(label, cx, 0, d, "below", "center", m);
  if (centered.left < 0) return "start";
  if (centered.right > m.width) return "end";
  return "center";
}

export function layoutHotspots(items: LayoutItem[], m: LayoutMetrics): PlacedHotspot[] {
  if (m.width <= 0 || m.height <= 0) {
    return items.map((i) => ({
      id: i.id,
      x: i.x,
      y: i.y,
      moved: false,
      labelPlacement: "below",
      labelAlign: "center",
    }));
  }

  // 1. Markers: push overlapping pairs apart along the line between their centers.
  const pts = items.map((i) => ({
    x: (i.x / 100) * m.width,
    y: (i.y / 100) * m.height,
    r: m.marker[i.importance] / 2,
  }));
  const keepInside = (p: (typeof pts)[number]) => {
    p.x = clamp(p.x, p.r, m.width - p.r);
    p.y = clamp(p.y, p.r, m.height - p.r);
  };
  pts.forEach(keepInside);

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    let collided = false;
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const a = pts[i]!;
        const b = pts[j]!;
        const min = a.r + b.r + m.gap;
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let dist = Math.hypot(dx, dy);
        if (dist >= min) continue;
        collided = true;
        if (dist < 0.01) {
          // Same point: separate along a fixed, index-based direction (deterministic).
          const angle = (j * 2.399963) % (2 * Math.PI);
          dx = Math.cos(angle);
          dy = Math.sin(angle);
          dist = 1;
        }
        const push = (min - dist) / 2 + 0.5;
        a.x -= (dx / dist) * push;
        a.y -= (dy / dist) * push;
        b.x += (dx / dist) * push;
        b.y += (dy / dist) * push;
        keepInside(a);
        keepInside(b);
      }
    }
    if (!collided) break;
  }

  // 2. Labels: below by default; above when below leaves the box or collides more.
  const markerRects: Rect[] = pts.map((p) => ({
    left: p.x - p.r,
    top: p.y - p.r,
    right: p.x + p.r,
    bottom: p.y + p.r,
  }));
  const placedLabels: Rect[] = [];
  const result: PlacedHotspot[] = items.map((item, index) => {
    const p = pts[index]!;
    const d = p.r * 2;
    const align = alignFor(item.label, p.x, d, m);
    const cost = (placement: LabelPlacement) => {
      const rect = labelRect(item.label, p.x, p.y, d, placement, align, m);
      const outside =
        Math.max(0, -rect.top) +
        Math.max(0, rect.bottom - m.height) +
        Math.max(0, -rect.left) +
        Math.max(0, rect.right - m.width);
      let cost = outside * 1000;
      if (item.labelAlways) {
        markerRects.forEach((r, k) => {
          if (k !== index) cost += overlapArea(rect, r);
        });
        placedLabels.forEach((r) => (cost += overlapArea(rect, r)));
      }
      return { rect, cost };
    };
    const below = cost("below");
    const above = cost("above");
    const choice =
      above.cost < below.cost
        ? { placement: "above" as const, ...above }
        : { placement: "below" as const, ...below };
    if (item.labelAlways) placedLabels.push(choice.rect);
    const x = round2((p.x / m.width) * 100);
    const y = round2((p.y / m.height) * 100);
    return {
      id: item.id,
      x,
      y,
      moved: Math.abs(x - item.x) > 0.05 || Math.abs(y - item.y) > 0.05,
      labelPlacement: choice.placement,
      labelAlign: align,
    };
  });
  return result;
}

/** Marker diameters in rem (HotspotButton's size classes), regular and compact. */
export const MARKER_REM: Record<"regular" | "compact", Record<VisualImportance, number>> = {
  regular: { primary: 5, secondary: 4, tertiary: 3.5 },
  compact: { primary: 3.5, secondary: 3, tertiary: 3 },
};

/** Art boxes narrower than this (in rem) use compact markers so scenes do not get crowded. */
export const COMPACT_BELOW_REM = 36;

export const isCompactBox = (width: number, rootFontPx: number) => width < COMPACT_BELOW_REM * rootFontPx;

/** Marker and label metrics from the root font size (all sizes are rem-based, like the CSS). */
export function metricsFor(width: number, height: number, rootFontPx: number): LayoutMetrics {
  const rem = rootFontPx;
  const sizes = MARKER_REM[isCompactBox(width, rem) ? "compact" : "regular"];
  return {
    width,
    height,
    compact: isCompactBox(width, rem),
    marker: {
      primary: sizes.primary * rem,
      secondary: sizes.secondary * rem,
      tertiary: sizes.tertiary * rem,
    },
    gap: 0.5 * rem,
    labelLineHeight: 1.125 * rem * 1.35,
    labelCharWidth: 1.125 * rem * 0.56,
    labelPaddingX: 1 * rem,
    labelMaxWidth: Math.min(20 * rem, width * 0.7),
    labelOffset: 0.5 * rem,
  };
}
