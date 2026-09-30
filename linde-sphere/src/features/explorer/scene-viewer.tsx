"use client";

/* eslint-disable @next/next/no-img-element -- local, pre-sized SVG scene layers; no optimization needed */
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { HotspotButton } from "@/components/explorer/hotspot-button";
import type { Hotspot, Scene } from "@/domain/content/scene";
import { SCENE_ART, SCENE_ART_RATIO } from "@/domain/content/scene-art";
import { cn } from "@/lib/cn";
import { useLanguage } from "@/lib/i18n/language-provider";
import { layoutHotspots, metricsFor, type LayoutMetrics } from "./hotspot-layout";

export type TransitionMode = "none" | "zoom-in" | "zoom-out" | "pan";

/** How the current scene was reached; a new `id` starts a new transition. */
export type SceneTransition = {
  id: number;
  fromSceneId: string | null;
  mode: TransitionMode;
  /** Point (% of the art box) the zoom is anchored to, e.g. the hotspot that was touched. */
  origin: { x: number; y: number };
  /** Pan direction: 1 = new scene comes from the right, -1 = from the left. */
  panDirection: 1 | -1;
};

export const NO_TRANSITION: SceneTransition = {
  id: 0,
  fromSceneId: null,
  mode: "none",
  origin: { x: 50, y: 50 },
  panDirection: 1,
};

export const SCENE_TRANSITION_MS = 560;

export type CalibrationPoint = { x: number; y: number };

const EXIT_CLASS: Record<Exclude<TransitionMode, "none">, string> = {
  "zoom-in": "motion-safe:animate-scene-zoom-in-exit",
  "zoom-out": "motion-safe:animate-scene-zoom-out-exit",
  pan: "motion-safe:animate-scene-pan-exit",
};
const ENTER_CLASS: Record<Exclude<TransitionMode, "none">, string> = {
  "zoom-in": "motion-safe:animate-scene-zoom-in-enter",
  "zoom-out": "motion-safe:animate-scene-zoom-out-enter",
  pan: "motion-safe:animate-scene-pan-enter",
};

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Layer URLs already requested in this page load (the browser cache keeps them). */
const prefetched = new Set<string>();

/**
 * After the current scene is shown, warm the cache with the scenes one touch away (navigation targets and
 * the parent) while the browser is idle, so the next zoom/pan starts with its art already decoded.
 */
function usePrefetchNeighbors(scene: Scene, scenesById: ReadonlyMap<string, Scene>) {
  useEffect(() => {
    const neighbors = [
      ...scene.hotspots.flatMap((h) => (h.type === "navigation" ? [h.targetSceneId] : [])),
      ...(scene.parentSceneId ? [scene.parentSceneId] : []),
    ];
    const urls = neighbors
      .map((id) => scenesById.get(id))
      .flatMap((s) => (s ? [s.background.src, ...s.foregroundLayers.map((l) => l.src)] : []))
      .filter((url) => !prefetched.has(url));
    if (urls.length === 0) return;
    const run = () =>
      urls.forEach((url) => {
        prefetched.add(url);
        const img = new Image();
        img.decoding = "async";
        img.src = url;
      });
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(run, { timeout: 2_000 });
      return () => window.cancelIdleCallback(id);
    }
    const timer = setTimeout(run, 300);
    return () => clearTimeout(timer);
  }, [scene, scenesById]);
}

const labelAlways = (h: Hotspot, metrics: LayoutMetrics | null) =>
  !metrics?.compact && (h.visualImportance === "primary" || h.type === "navigation");

/**
 * Illustrated 2D scene with hotspots (ADR-049). No 3D, WebGL or free camera: a fixed-ratio art box
 * (SCENE_ART) scaled to fit its container, a background and optional foreground layers, and hotspots
 * positioned by percentages so they stay on the same features at every size. Overlapping markers are
 * nudged apart for the measured size. Scene changes are short zoom / pan illusions (instant with reduced
 * motion). With `calibration`, touches on the art report normalized coordinates instead (developer tool).
 */
export function SceneViewer({
  scene,
  scenesById,
  transition = NO_TRANSITION,
  reducedMotion = false,
  visitedHotspotIds = [],
  activeHotspotId = null,
  highlightedSceneIds = [],
  highlightLabel,
  onHotspot,
  calibration,
  transitionMs = SCENE_TRANSITION_MS,
}: {
  scene: Scene;
  scenesById: ReadonlyMap<string, Scene>;
  transition?: SceneTransition;
  reducedMotion?: boolean;
  visitedHotspotIds?: string[];
  activeHotspotId?: string | null;
  /** Navigation hotspots leading to these scenes are marked as relevant to the visitor. */
  highlightedSceneIds?: string[];
  highlightLabel?: string;
  onHotspot: (hotspot: Hotspot) => void;
  calibration?: { point: CalibrationPoint | null; onPick: (point: CalibrationPoint) => void };
  transitionMs?: number;
}) {
  const { localize } = useLanguage();
  const boxRef = useRef<HTMLDivElement>(null);
  const [metrics, setMetrics] = useState<LayoutMetrics | null>(null);
  const [finishedTransition, setFinishedTransition] = useState(0);
  usePrefetchNeighbors(scene, scenesById);

  // Measure the art box so markers can be laid out for the real screen size.
  useEffect(() => {
    const box = boxRef.current;
    if (!box || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const rootFont = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      const { width, height } = entry.contentRect;
      setMetrics((prev) =>
        prev && prev.width === width && prev.height === height && prev.labelOffset === 0.5 * rootFont
          ? prev
          : metricsFor(width, height, rootFont),
      );
    });
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  // The outgoing scene is kept only for the length of the transition.
  useEffect(() => {
    if (transition.fromSceneId === null) return;
    const timer = setTimeout(() => setFinishedTransition(transition.id), transitionMs);
    return () => clearTimeout(timer);
  }, [transition.id, transition.fromSceneId, transitionMs]);

  const animate = !reducedMotion && transition.mode !== "none" && transition.fromSceneId !== null;
  const outgoing =
    animate && finishedTransition !== transition.id
      ? scenesById.get(transition.fromSceneId ?? "")
      : undefined;
  const mode = transition.mode === "none" ? null : transition.mode;
  const origin = `${transition.origin.x}% ${transition.origin.y}%`;
  const motionStyle = {
    transformOrigin: origin,
    "--pan-direction": transition.panDirection,
  } as CSSProperties;

  const placed = useMemo(() => {
    const items = scene.hotspots.map((h) => ({
      id: h.id,
      x: h.x,
      y: h.y,
      importance: h.visualImportance,
      label: localize(h.label),
      labelAlways: labelAlways(h, metrics),
    }));
    return new Map((metrics ? layoutHotspots(items, metrics) : []).map((p) => [p.id, p]));
  }, [scene, metrics, localize]);

  const hotspots: ReactNode = scene.hotspots.map((h) => {
    const p = placed.get(h.id);
    const highlighted = h.type === "navigation" && highlightedSceneIds.includes(h.targetSceneId);
    return (
      <HotspotButton
        key={h.id}
        testId={`hotspot-${h.id}`}
        x={p?.x ?? h.x}
        y={p?.y ?? h.y}
        width={h.width}
        height={h.height}
        type={h.type}
        label={localize(h.label)}
        accessibleLabel={localize(h.accessibleLabel)}
        importance={h.visualImportance}
        visited={visitedHotspotIds.includes(h.id)}
        active={activeHotspotId === h.id}
        highlighted={highlighted}
        highlightLabel={highlightLabel}
        // Main hotspots and wayfinding always show their label on large art; small art boxes (phones)
        // would be covered in text, so there every label shows on touch, focus or hover.
        labelMode={labelAlways(h, metrics) || (highlighted && !metrics?.compact) ? "always" : "interactive"}
        compact={metrics?.compact ?? false}
        labelPlacement={p?.labelPlacement}
        labelAlign={p?.labelAlign}
        onActivate={() => onHotspot(h)}
      />
    );
  });

  return (
    <div className="absolute inset-0" style={{ containerType: "size" }} data-testid="scene-viewer">
      <div
        ref={boxRef}
        data-testid="scene-art-box"
        data-scene={scene.id}
        data-layout-ready={metrics ? "true" : undefined}
        // overflow-clip, not hidden: a hidden box can still be scrolled (e.g. when a focused hotspot's label
        // reaches the edge), which would shift every marker off its feature.
        // pan-x pan-y: scrolling still works, but a pinch that starts on the scene does not zoom the page.
        className="rounded-card bg-surface-muted absolute inset-0 m-auto [touch-action:pan-x_pan-y] overflow-clip"
        style={{
          width: `min(100cqw, calc(100cqh * ${SCENE_ART_RATIO}))`,
          height: `min(100cqh, calc(100cqw / ${SCENE_ART_RATIO}))`,
        }}
      >
        {outgoing && mode && (
          <SceneLayers
            key={`out-${transition.id}`}
            scene={outgoing}
            className={cn("pointer-events-none", EXIT_CLASS[mode])}
            style={motionStyle}
            inert
          />
        )}
        <SceneLayers
          key={scene.id}
          scene={scene}
          className={animate && mode ? ENTER_CLASS[mode] : undefined}
          style={animate ? motionStyle : undefined}
          settle={animate}
        >
          {!calibration && hotspots}
        </SceneLayers>
        {calibration && <CalibrationOverlay scene={scene} {...calibration} />}
      </div>
    </div>
  );
}

function SceneLayers({
  scene,
  className,
  style,
  inert,
  settle = false,
  children,
}: {
  scene: Scene;
  className?: string;
  style?: CSSProperties;
  inert?: boolean;
  settle?: boolean;
  children?: ReactNode;
}) {
  const { localize } = useLanguage();
  return (
    <div
      className={cn("absolute inset-0", className)}
      style={style}
      inert={inert}
      aria-hidden={inert || undefined}
      data-testid={inert ? "scene-layers-outgoing" : "scene-layers"}
    >
      {/* Intrinsic size avoids layout work while loading; the current background is the page's key image. */}
      <img
        src={scene.background.src}
        alt={localize(scene.background.alt)}
        width={SCENE_ART.width}
        height={SCENE_ART.height}
        decoding="async"
        fetchPriority={inert ? "low" : "high"}
        draggable={false}
        className="absolute inset-0 size-full select-none"
      />
      {scene.foregroundLayers.map((layer) => (
        <img
          key={layer.src}
          src={layer.src}
          alt=""
          aria-hidden
          width={SCENE_ART.width}
          height={SCENE_ART.height}
          decoding="async"
          draggable={false}
          data-testid="scene-foreground"
          className={cn(
            "pointer-events-none absolute inset-0 size-full select-none",
            settle && "motion-safe:animate-layer-settle",
          )}
          style={{ "--layer-depth": layer.depth } as CSSProperties}
        />
      ))}
      {children}
    </div>
  );
}

/** Developer calibration: shows a 10 % grid, the authored hotspot centers and the touched point. */
function CalibrationOverlay({
  scene,
  point,
  onPick,
}: {
  scene: Scene;
  point: CalibrationPoint | null;
  onPick: (point: CalibrationPoint) => void;
}) {
  return (
    <div
      data-testid="calibration-overlay"
      className="absolute inset-0 z-40 cursor-crosshair touch-none"
      onPointerDown={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        onPick({
          x: round1(Math.min(Math.max(((event.clientX - rect.left) / rect.width) * 100, 0), 100)),
          y: round1(Math.min(Math.max(((event.clientY - rect.top) / rect.height) * 100, 0), 100)),
        });
      }}
    >
      <svg
        aria-hidden
        className="absolute inset-0 size-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        {Array.from({ length: 9 }, (_, i) => (i + 1) * 10).map((v) => (
          <g key={v} stroke="#1B4FD1" strokeOpacity={v === 50 ? 0.5 : 0.2} strokeWidth={0.15}>
            <line x1={v} y1={0} x2={v} y2={100} />
            <line x1={0} y1={v} x2={100} y2={v} />
          </g>
        ))}
      </svg>
      {scene.hotspots.map((h) => (
        <span
          key={h.id}
          className="bg-ink/75 text-caption absolute -translate-x-1/2 -translate-y-1/2 rounded px-2 py-0.5 whitespace-nowrap text-white"
          style={{ left: `${h.x}%`, top: `${h.y}%` }}
        >
          {h.id} ({h.x}, {h.y})
        </span>
      ))}
      {point && (
        <>
          <span className="bg-focus absolute inset-y-0 w-0.5" style={{ left: `${point.x}%` }} />
          <span className="bg-focus absolute inset-x-0 h-0.5" style={{ top: `${point.y}%` }} />
          <span
            data-testid="calibration-marker"
            className="border-focus absolute size-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 bg-white"
            style={{ left: `${point.x}%`, top: `${point.y}%` }}
          />
        </>
      )}
    </div>
  );
}
