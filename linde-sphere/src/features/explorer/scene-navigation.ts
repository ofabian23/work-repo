import type { Scene } from "@/domain/content/scene";
import type { SceneTransition } from "./scene-viewer";

/**
 * Chooses the transition illusion for a move between scenes:
 * - into a child scene → zoom in, anchored at the hotspot that was touched;
 * - up to an ancestor (breadcrumb, "Volver") → zoom out, anchored where the child sits in the ancestor;
 * - anywhere else (a sibling) → a short pan, direction from the hotspot's side of the screen.
 */
export function transitionBetween(
  id: number,
  from: Scene,
  targetId: string,
  scenesById: ReadonlyMap<string, Scene>,
  origin?: { x: number; y: number },
): SceneTransition {
  const target = scenesById.get(targetId);
  const base = { id, fromSceneId: from.id, panDirection: 1 as const };
  if (!target) return { ...base, mode: "none", origin: { x: 50, y: 50 } };

  if (target.parentSceneId === from.id) {
    return { ...base, mode: "zoom-in", origin: origin ?? { x: 50, y: 50 } };
  }
  const depth = from.breadcrumb.indexOf(targetId);
  if (depth !== -1) {
    // The scene one level below the target on the way back, and its hotspot in the target.
    const childOnPath = from.breadcrumb[depth + 1];
    const entry = target.hotspots.find((h) => h.type === "navigation" && h.targetSceneId === childOnPath);
    return { ...base, mode: "zoom-out", origin: entry ? { x: entry.x, y: entry.y } : { x: 50, y: 50 } };
  }
  return {
    ...base,
    mode: "pan",
    origin: origin ?? { x: 50, y: 50 },
    panDirection: origin && origin.x < 50 ? -1 : 1,
  };
}
