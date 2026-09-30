import type { LocalizedText } from "@/domain/content/primitives";
import type { Persona } from "@/domain/content/taxonomy";
import type { PublicContentBundle } from "@/domain/content/visibility";
import type { RecommendationResult } from "@/domain/recommendations/recommendation-result";

/** At most this many challenges are suggested after choosing a role (quick to scan on the kiosk). */
export const MAX_SUGGESTED_CHALLENGES = 4;

/** Areas mentioned on the next-steps screen and listed as relevant to explore. */
export const MAX_RELEVANT_AREAS = 3;

/** Personas split into the professional areas list and the optional "several areas" option. */
export function splitPersonas(personas: Persona[]): { single: Persona[]; multiple: Persona | null } {
  const sorted = [...personas].sort((a, b) => a.sortOrder - b.sortOrder);
  return {
    single: sorted.filter((p) => p.scope === "single"),
    multiple: sorted.find((p) => p.scope === "multiple") ?? null,
  };
}

/**
 * The small, role-relevant challenge set: the persona's suggestions (capped), plus any challenge the
 * visitor already chose elsewhere so a selection is never hidden.
 */
export function suggestedChallengeIds(
  persona: Persona | null,
  selectedIds: string[],
  content: PublicContentBundle,
): string[] {
  const known = new Set(content.challenges.map((c) => c.id));
  const suggested = (persona?.suggestedChallengeIds ?? [])
    .filter((id) => known.has(id))
    .slice(0, MAX_SUGGESTED_CHALLENGES);
  return [...suggested, ...selectedIds.filter((id) => known.has(id) && !suggested.includes(id))];
}

/**
 * Hospital areas related to the recommendations, in recommendation order. The campus (root scene) is
 * the explorer's starting point, not an area, so it is left out.
 */
export function relevantSceneIds(
  result: RecommendationResult | null,
  content: PublicContentBundle,
  max = MAX_RELEVANT_AREAS,
): string[] {
  const areas = new Set(content.scenes.filter((s) => s.parentSceneId !== null).map((s) => s.id));
  const ids = new Set<string>();
  for (const item of result?.items ?? []) {
    for (const id of item.relatedSceneIds) if (areas.has(id)) ids.add(id);
  }
  return [...ids].slice(0, max);
}

export function labelsFor(
  ids: string[],
  records: { id: string; title?: LocalizedText; label?: LocalizedText }[],
) {
  const byId = new Map(records.map((r) => [r.id, r.title ?? r.label]));
  return ids.flatMap((id) => {
    const label = byId.get(id);
    return label ? [label] : [];
  });
}
