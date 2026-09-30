import type { ReadinessSettings } from "../content/engine-settings";
import type { Scene } from "../content/scene";
import type { SessionSignals } from "../session/visitor-session";

/**
 * RecommendationReadiness service (ADR-050): decides when the visitor has shared enough for meaningful
 * recommendations, so "Ver mis recomendaciones" and the conversion prompt can appear. Any one condition
 * is enough; visitors never have to complete every route. Pure: signals and content in, a state out.
 */

export type ReadinessCondition =
  /** A role plus at least `personaPlusChallenges` challenges. */
  | "persona-and-challenges"
  /** At least `challengesAlone` challenges. */
  | "challenges"
  /** Meaningful interaction in at least `distinctScenes` different scenes. */
  | "distinct-scenes"
  /** At least `uniqueHotspots` different meaningful hotspots. */
  | "unique-hotspots";

export type ReadinessState = {
  ready: boolean;
  /** Every condition currently met, in the order above. */
  conditionsMet: ReadinessCondition[];
  progress: { challenges: number; meaningfulHotspots: number; meaningfulScenes: number };
  required: ReadinessSettings;
  /** Meaningful hotspots still needed for the hotspot condition (an upper bound; 0 once ready). */
  hotspotsRemaining: number;
};

/**
 * A meaningful interaction is opening an information or solution hotspot: the visitor looked at content.
 * Navigation hotspots only move between scenes, and repeated opens of the same hotspot count once.
 */
export function meaningfulInteractions(
  signals: Pick<SessionSignals, "openedHotspotIds">,
  scenes: Pick<Scene, "id" | "hotspots">[],
): { hotspotIds: string[]; sceneIds: string[] } {
  const sceneOf = new Map<string, string>();
  for (const scene of scenes) {
    for (const h of scene.hotspots) if (h.type !== "navigation") sceneOf.set(h.id, scene.id);
  }
  const hotspotIds = [...new Set(signals.openedHotspotIds)].filter((id) => sceneOf.has(id));
  const sceneIds = [...new Set(hotspotIds.map((id) => sceneOf.get(id)!))];
  return { hotspotIds, sceneIds };
}

function assess(
  signals: SessionSignals,
  content: { scenes: Pick<Scene, "id" | "hotspots">[]; settings: { readiness: ReadinessSettings } },
  settings: ReadinessSettings = content.settings.readiness,
): ReadinessState {
  const challenges = new Set(signals.challengeIds).size;
  const { hotspotIds, sceneIds } = meaningfulInteractions(signals, content.scenes);
  const met: [ReadinessCondition, boolean][] = [
    ["persona-and-challenges", signals.personaId !== null && challenges >= settings.personaPlusChallenges],
    ["challenges", challenges >= settings.challengesAlone],
    ["distinct-scenes", sceneIds.length >= settings.distinctScenes],
    ["unique-hotspots", hotspotIds.length >= settings.uniqueHotspots],
  ];
  const conditionsMet = met.filter(([, ok]) => ok).map(([condition]) => condition);
  const ready = conditionsMet.length > 0;
  return {
    ready,
    conditionsMet,
    progress: { challenges, meaningfulHotspots: hotspotIds.length, meaningfulScenes: sceneIds.length },
    required: settings,
    hotspotsRemaining: ready ? 0 : Math.max(settings.uniqueHotspots - hotspotIds.length, 0),
  };
}

export const RecommendationReadiness = { assess, meaningfulInteractions } as const;
