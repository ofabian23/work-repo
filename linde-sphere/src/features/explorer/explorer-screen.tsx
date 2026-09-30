"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PrimaryAction, SecondaryAction } from "@/components/actions/action-button";
import { BottomActionBar } from "@/components/actions/bottom-action-bar";
import { SolutionPanel } from "@/components/content/solution-panel";
import { ArrowRightIcon, SparkIcon } from "@/components/icons";
import { SceneBreadcrumb } from "@/components/navigation/scene-breadcrumb";
import { Sheet } from "@/components/overlay/dialog";
import type { Hotspot, Scene } from "@/domain/content/scene";
import type { PublicContentBundle } from "@/domain/content/visibility";
import { useLanguage } from "@/lib/i18n/language-provider";
import { NO_TRANSITION, SceneViewer, type SceneTransition } from "./scene-viewer";
import { transitionBetween } from "./scene-navigation";

/**
 * Hospital explorer (path C, and "Explore relevant areas" from the role journey). Breadcrumbs and "Volver"
 * move up the scene tree; navigation hotspots move between scenes; information and solution hotspots open
 * a bottom sheet. "Ver mis recomendaciones" appears once recommendations are ready (RecommendationReadiness).
 */
export function ExplorerScreen({
  content,
  sceneId,
  visitedHotspotIds,
  interestIds,
  highlightedSceneIds,
  recommendationsAvailable,
  hotspotsRemaining,
  reducedMotion,
  engagementMs,
  onNavigate,
  onOpenHotspot,
  onEngageHotspot,
  onToggleInterest,
  onViewRecommendations,
  onExit,
}: {
  content: PublicContentBundle;
  sceneId: string;
  visitedHotspotIds: string[];
  interestIds: string[];
  highlightedSceneIds: string[];
  /** Ready (RecommendationReadiness) or already shown to this visitor. */
  recommendationsAvailable: boolean;
  /** Meaningful hotspots still needed, for the progress line. */
  hotspotsRemaining: number;
  reducedMotion: boolean;
  engagementMs: number;
  onNavigate: (sceneId: string) => void;
  onOpenHotspot: (hotspotId: string) => void;
  onEngageHotspot: (hotspotId: string) => void;
  onToggleInterest: (solutionId: string) => void;
  onViewRecommendations: () => void;
  onExit: () => void;
}) {
  const { t, localize } = useLanguage();
  const scenesById = useMemo(() => new Map(content.scenes.map((s) => [s.id, s])), [content.scenes]);
  const scene = scenesById.get(sceneId) as Scene;
  const [transition, setTransition] = useState<SceneTransition>(NO_TRANSITION);
  const [panel, setPanel] = useState<Hotspot | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  // Each scene is a new "page": move focus to its title (keyboard and screen-reader users).
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, [sceneId]);

  // A panel kept open for a while counts as engagement (anonymous signal; no timing is stored).
  const panelId = panel?.id;
  useEffect(() => {
    if (!panelId) return;
    const timer = setTimeout(() => onEngageHotspot(panelId), engagementMs);
    return () => clearTimeout(timer);
  }, [panelId, engagementMs, onEngageHotspot]);

  const go = (targetId: string, origin?: { x: number; y: number }) => {
    if (targetId === sceneId || !scenesById.has(targetId)) return;
    setTransition((prev) => transitionBetween(prev.id + 1, scene, targetId, scenesById, origin));
    onNavigate(targetId);
  };

  const activate = (h: Hotspot) => {
    onOpenHotspot(h.id);
    if (h.type === "navigation") go(h.targetSceneId, { x: h.x, y: h.y });
    else setPanel(h);
  };

  const solutions = new Map(content.solutions.map((s) => [s.id, s]));
  const breadcrumb = scene.breadcrumb.flatMap((id) => {
    const s = scenesById.get(id);
    return s ? [{ id, label: localize(s.title) }] : [];
  });
  const remaining = hotspotsRemaining;

  return (
    <section data-testid="explorer-screen" data-scene={scene.id} className="flex flex-1 flex-col">
      <div className="px-gutter flex flex-col gap-3 pt-[clamp(1rem,2vh,2rem)] pb-3">
        <div className="flex flex-wrap items-center gap-3">
          <SecondaryAction
            size="md"
            data-testid="explorer-back"
            onClick={() => (scene.parentSceneId ? go(scene.parentSceneId) : onExit())}
            icon={null}
          >
            <span className="inline-flex items-center gap-2">
              <ArrowRightIcon aria-hidden className="rotate-180" size="size-6" />
              {t("explorer.back")}
            </span>
          </SecondaryAction>
          {breadcrumb.length > 1 && (
            <SceneBreadcrumb items={breadcrumb} onNavigate={(id) => go(id)} currentVisuallyHidden />
          )}
        </div>
        <h1 ref={heading} tabIndex={-1} className="text-title text-ink font-bold outline-none">
          {localize(scene.title)}
        </h1>
        <p className="text-body text-ink-muted max-w-3xl text-pretty">
          {localize(scene.description)} {t("explorer.hint")}
        </p>
      </div>

      {/* Fills the remaining height on the portrait kiosk; on short or narrow screens it is at least tall
          enough for the art to span the full width (the page then scrolls). */}
      <div
        className="px-gutter relative flex-1 pb-3"
        style={{ minHeight: "min(calc((min(100vw, 1080px) - 2 * var(--spacing-gutter)) * 1.18), 78dvh)" }}
      >
        <div
          className="relative size-full"
          aria-label={t("explorer.sceneLabel", { scene: localize(scene.title) })}
        >
          <SceneViewer
            scene={scene}
            scenesById={scenesById}
            transition={transition}
            reducedMotion={reducedMotion}
            visitedHotspotIds={visitedHotspotIds}
            activeHotspotId={panel?.id ?? null}
            highlightedSceneIds={highlightedSceneIds}
            highlightLabel={t("explorer.relevant")}
            onHotspot={activate}
          />
        </div>
      </div>

      <BottomActionBar label={t("ui.actions")}>
        <p
          aria-live="polite"
          data-testid="explorer-progress"
          className={recommendationsAvailable ? "sr-only" : "text-label text-ink-muted mr-auto font-medium"}
        >
          {recommendationsAvailable
            ? t("explorer.ready")
            : remaining === 1
              ? t("explorer.progressOne")
              : t("explorer.progressMany", { remaining })}
        </p>
        {recommendationsAvailable && (
          <PrimaryAction
            data-testid="view-my-recommendations"
            icon={<SparkIcon />}
            onClick={onViewRecommendations}
            className="motion-safe:animate-phrase-in"
          >
            {t("explorer.viewRecommendations")}
          </PrimaryAction>
        )}
      </BottomActionBar>

      <Sheet
        open={panel !== null}
        onClose={() => setPanel(null)}
        testId="hotspot-sheet"
        title={panel ? localize(panel.type === "information" ? panel.panel.title : panel.label) : ""}
        description={panel?.type === "information" ? localize(panel.panel.body) : undefined}
      >
        {panel?.type === "information" && panel.panel.bullets.length > 0 && (
          <ul className="text-body text-ink flex list-disc flex-col gap-2 pl-6">
            {panel.panel.bullets.map((b) => (
              <li key={b.es}>{localize(b)}</li>
            ))}
          </ul>
        )}
        {panel?.type === "solution" && (
          <SolutionPanel
            solutions={panel.targetSolutionIds.flatMap((id) => {
              const s = solutions.get(id);
              return s
                ? [
                    {
                      id: s.id,
                      title: localize(s.title),
                      summary: localize(s.summary),
                      nextStep: localize(s.nextStep),
                      pendingValidation: s.validationStatus !== "validated",
                    },
                  ]
                : [];
            })}
            interestIds={interestIds}
            onToggleInterest={onToggleInterest}
          />
        )}
      </Sheet>
    </section>
  );
}
