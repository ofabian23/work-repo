"use client";

import { useRef, useState } from "react";
import type { Scene } from "@/domain/content/scene";
import { SCENE_ART } from "@/domain/content/scene-art";
import { cn } from "@/lib/cn";
import { useHydrated } from "@/lib/use-hydrated";
import { SceneViewer, type CalibrationPoint } from "./scene-viewer";

/** `"x": 42.5, "y": 61.3` — ready to paste into a hotspot in content/scenes/*.json. */
export const coordinateSnippet = (p: CalibrationPoint) => `"x": ${p.x}, "y": ${p.y}`;

/**
 * Developer-only coordinate calibration (ADR-049). Tap or click the illustration to read the point as
 * normalized percentages of the art box, then copy it into the scene content. The overlay shows a 10 %
 * grid and every authored hotspot center. English only: this is not part of the visitor experience.
 */
export function SceneCalibrator({ scenes }: { scenes: Scene[] }) {
  const ready = useHydrated();
  const [sceneId, setSceneId] = useState(scenes[0]?.id ?? "");
  const [point, setPoint] = useState<CalibrationPoint | null>(null);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "manual">("idle");
  const snippetRef = useRef<HTMLInputElement>(null);
  const scenesById = new Map(scenes.map((s) => [s.id, s]));
  const scene = scenesById.get(sceneId);

  const copy = async () => {
    if (!point) return;
    const text = coordinateSnippet(point);
    try {
      // The Clipboard API needs a secure context (localhost or HTTPS); the kiosk LAN is plain HTTP.
      if (!navigator.clipboard) throw new Error("Clipboard API unavailable");
      await navigator.clipboard.writeText(text);
      setCopyStatus("copied");
    } catch {
      snippetRef.current?.select();
      const copied = typeof document.execCommand === "function" && document.execCommand("copy");
      setCopyStatus(copied ? "copied" : "manual");
    }
  };

  return (
    <div
      className="px-gutter flex flex-1 flex-col gap-5 py-8"
      data-testid="scene-calibrator"
      data-ready={ready || undefined}
    >
      <header className="flex flex-col gap-2">
        <p className="text-caption text-notice font-semibold tracking-wide uppercase">Development tool</p>
        <h1 className="text-headline text-ink font-bold">Scene calibration</h1>
        <p className="text-body text-ink-muted max-w-3xl">
          Tap the illustration to read normalized coordinates (0–100 % of the {SCENE_ART.width} ×{" "}
          {SCENE_ART.height} art box). Hotspot centers use the same values, so they stay aligned at every
          screen size.
        </p>
      </header>

      <nav aria-label="Scenes" className="flex flex-wrap gap-2">
        {scenes.map((s) => (
          <button
            key={s.id}
            type="button"
            data-testid={`calibrate-scene-${s.id}`}
            aria-pressed={s.id === sceneId}
            onClick={() => {
              setSceneId(s.id);
              setPoint(null);
              setCopyStatus("idle");
            }}
            className={cn(
              "focus-ring text-label min-h-touch-min rounded-full border-2 px-4 font-semibold",
              s.id === sceneId
                ? "border-primary bg-primary text-on-primary"
                : "border-line bg-surface text-ink",
            )}
          >
            {s.id}
          </button>
        ))}
      </nav>

      <div className="flex flex-wrap items-center gap-4" aria-live="polite">
        <p data-testid="calibration-readout" className="text-lead text-ink font-mono font-semibold">
          {point ? `x: ${point.x} · y: ${point.y}` : "Tap the scene to measure"}
        </p>
        <input
          ref={snippetRef}
          readOnly
          aria-label="Coordinate snippet"
          data-testid="calibration-snippet"
          value={point ? coordinateSnippet(point) : ""}
          className="border-line bg-surface-muted text-body min-h-touch-min w-64 rounded-lg border px-3 font-mono"
        />
        <button
          type="button"
          data-testid="calibration-copy"
          disabled={!point}
          onClick={copy}
          className="focus-ring bg-primary text-on-primary text-label min-h-touch-min rounded-lg px-5 font-semibold disabled:opacity-50"
        >
          Copy coordinates
        </button>
        {copyStatus !== "idle" && (
          <span data-testid="calibration-copy-status" className="text-label text-ink-muted">
            {copyStatus === "copied" ? "Copied" : "Selected: press Ctrl+C to copy"}
          </span>
        )}
      </div>

      {scene && (
        <div className="relative h-[min(75dvh,70rem)] min-h-96">
          <SceneViewer
            scene={scene}
            scenesById={scenesById}
            onHotspot={() => undefined}
            calibration={{
              point,
              onPick: (p) => {
                setPoint(p);
                setCopyStatus("idle");
              },
            }}
          />
        </div>
      )}
    </div>
  );
}
