import type { LocalizedText } from "../content/primitives";
import { extractPlaceholders } from "../content/primitives";
import type { RecommendationRule, SignalType } from "../content/recommendation-rule";
import type { Hotspot } from "../content/scene";
import type { PublicContentBundle, PublicRecommendationRule, PublicSolution } from "../content/visibility";
import type { SessionSignals } from "../session/visitor-session";
import {
  DEFAULT_MAX_RESULTS,
  ENGAGED_HOTSPOT_BONUS,
  ENGINE_VERSION,
  HOTSPOT_CAP,
  HOTSPOT_SOLUTION_AFFINITY,
  IMPLIED_CHALLENGE_CAP,
  IMPLIED_CHALLENGE_FACTOR,
  SCENE_CAP,
} from "./engine-config";
import { FALLBACK_WHY, buildWhyThisAppeared, type LabelIndex } from "./explanations";
import {
  MAX_RECOMMENDATIONS,
  type MatchedSignal,
  type RecommendationItem,
  type RecommendationResult,
} from "./recommendation-result";

/**
 * Deterministic, explainable recommendation engine (ADR-008, ADR-041).
 * Pure function: no I/O, no clock, no randomness. The same signals and content always produce the
 * same ordered result. Used by the kiosk for live display and by the server for recomputation.
 */

export type RecommendOptions = { maxResults?: number };

type NormalizedSignals = {
  personaId: string | null;
  challengeIds: string[];
  facilityTypeId: string | null;
  visitedSceneIds: string[];
  openedHotspots: Hotspot[];
  engagedHotspotIds: Set<string>;
  explicitInterestIds: string[];
};

type Candidate = {
  rule: PublicRecommendationRule;
  solution: PublicSolution;
  score: number;
  explicitScore: number;
  matches: MatchedSignal[];
};

const round = (n: number) => Math.round(n * 100) / 100;
const sum = (matches: MatchedSignal[]) => round(matches.reduce((total, m) => total + m.weight, 0));

/** Keeps the strongest matches until the cap is reached (the last one may be partially counted). */
function applyCap(matches: MatchedSignal[], cap: number): MatchedSignal[] {
  const sorted = [...matches].sort(
    (a, b) => b.weight - a.weight || (a.signalId < b.signalId ? -1 : a.signalId > b.signalId ? 1 : 0),
  );
  const kept: MatchedSignal[] = [];
  let remaining = cap;
  for (const m of sorted) {
    if (remaining <= 0) break;
    const weight = round(Math.min(m.weight, remaining));
    kept.push({ ...m, weight });
    remaining = round(remaining - weight);
  }
  return kept;
}

function buildIndex(content: PublicContentBundle): LabelIndex & { hotspots: Map<string, Hotspot> } {
  const hotspots = new Map<string, Hotspot>();
  for (const scene of content.scenes) for (const h of scene.hotspots) hotspots.set(h.id, h);
  return {
    personas: new Map(content.personas.map((p) => [p.id, p.label])),
    challenges: new Map(content.challenges.map((c) => [c.id, c.label])),
    facilityTypes: new Map(content.facilityTypes.map((f) => [f.id, f.label])),
    scenes: new Map(content.scenes.map((s) => [s.id, s.title])),
    hotspotLabels: new Map([...hotspots].map(([id, h]) => [id, h.label])),
    solutions: new Map(content.solutions.map((s) => [s.id, s.title])),
    hotspots,
  };
}

/** Drops unknown or hidden ids and duplicates, preserving the visitor's order. */
function normalize(signals: SessionSignals, idx: ReturnType<typeof buildIndex>): NormalizedSignals {
  const keep = (ids: string[], known: Map<string, unknown>) =>
    [...new Set(ids)].filter((id) => known.has(id));
  const opened = keep(signals.openedHotspotIds, idx.hotspots);
  return {
    personaId: signals.personaId && idx.personas.has(signals.personaId) ? signals.personaId : null,
    challengeIds: keep(signals.challengeIds, idx.challenges),
    facilityTypeId:
      signals.facilityTypeId && idx.facilityTypes.has(signals.facilityTypeId) ? signals.facilityTypeId : null,
    visitedSceneIds: keep(signals.visitedSceneIds, idx.scenes),
    openedHotspots: opened.map((id) => idx.hotspots.get(id)!),
    engagedHotspotIds: new Set(signals.engagedHotspotIds.filter((id) => opened.includes(id))),
    explicitInterestIds: keep(signals.explicitInterestIds, idx.solutions),
  };
}

function isExcluded(rule: PublicRecommendationRule, s: NormalizedSignals): boolean {
  const visitor: Record<SignalType, string[]> = {
    personas: s.personaId ? [s.personaId] : [],
    challenges: s.challengeIds,
    facilityTypes: s.facilityTypeId ? [s.facilityTypeId] : [],
    scenes: s.visitedSceneIds,
    hotspots: s.openedHotspots.map((h) => h.id),
    explicitInterests: s.explicitInterestIds,
  };
  return rule.exclusions.some((ex) => ex.ids.some((id) => visitor[ex.signalType].includes(id)));
}

function scoreRule(rule: PublicRecommendationRule, s: NormalizedSignals): MatchedSignal[] {
  const w = rule.weights;
  const direct = (signalType: SignalType, id: string): MatchedSignal[] => {
    const weight = w[signalType][id];
    return weight ? [{ signalType, signalId: id, kind: "direct", weight }] : [];
  };

  const matches: MatchedSignal[] = [];
  if (s.personaId) matches.push(...direct("personas", s.personaId));
  for (const id of s.challengeIds) matches.push(...direct("challenges", id));
  if (s.facilityTypeId) matches.push(...direct("facilityTypes", s.facilityTypeId));
  matches.push(
    ...applyCap(
      s.visitedSceneIds.flatMap((id) => direct("scenes", id)),
      SCENE_CAP,
    ),
  );

  const hotspotMatches: MatchedSignal[] = [];
  for (const h of s.openedHotspots) {
    const directWeight = w.hotspots[h.id];
    const contribution: MatchedSignal | null = directWeight
      ? { signalType: "hotspots", signalId: h.id, kind: "direct", weight: directWeight }
      : h.recommendationSignals.solutionIds.includes(rule.solutionId)
        ? {
            signalType: "hotspots",
            signalId: h.id,
            kind: "hotspot-affinity",
            weight: HOTSPOT_SOLUTION_AFFINITY,
          }
        : null;
    if (!contribution) continue;
    hotspotMatches.push(contribution);
    if (s.engagedHotspotIds.has(h.id)) {
      hotspotMatches.push({
        signalType: "hotspots",
        signalId: h.id,
        kind: "engaged-bonus",
        weight: ENGAGED_HOTSPOT_BONUS,
      });
    }
  }
  matches.push(...applyCap(hotspotMatches, HOTSPOT_CAP));

  const selected = new Set(s.challengeIds);
  const implied = [...new Set(s.openedHotspots.flatMap((h) => h.recommendationSignals.challengeIds))]
    .filter((id) => !selected.has(id) && w.challenges[id])
    .map<MatchedSignal>((id) => ({
      signalType: "challenges",
      signalId: id,
      kind: "implied-challenge",
      weight: round(w.challenges[id]! * IMPLIED_CHALLENGE_FACTOR),
    }));
  matches.push(...applyCap(implied, IMPLIED_CHALLENGE_CAP));

  for (const id of s.explicitInterestIds) matches.push(...direct("explicitInterests", id));
  return matches;
}

/** Renders the rule's relevance template; placeholders use the visitor's matched labels. */
function renderRelevance(
  rule: Pick<RecommendationRule, "explanationTemplate" | "fallbackExplanation">,
  matches: MatchedSignal[],
  solution: PublicSolution,
  idx: LabelIndex,
): LocalizedText {
  const directIds = (type: SignalType) => [
    ...new Set(matches.filter((m) => m.signalType === type && m.kind === "direct").map((m) => m.signalId)),
  ];
  const labelSource: Record<string, { ids: string[]; labels: Map<string, LocalizedText> }> = {
    persona: { ids: directIds("personas"), labels: idx.personas },
    challenges: { ids: directIds("challenges"), labels: idx.challenges },
    facilityType: { ids: directIds("facilityTypes"), labels: idx.facilityTypes },
    scenes: { ids: directIds("scenes"), labels: idx.scenes },
    hotspots: { ids: directIds("hotspots"), labels: idx.hotspotLabels },
    interests: { ids: directIds("explicitInterests"), labels: idx.solutions },
    solution: { ids: [solution.id], labels: idx.solutions },
  };
  const placeholders = [
    ...new Set([
      ...extractPlaceholders(rule.explanationTemplate.es),
      ...extractPlaceholders(rule.explanationTemplate.en),
    ]),
  ];
  if (placeholders.some((p) => (labelSource[p]?.ids.length ?? 0) === 0)) {
    return rule.fallbackExplanation ?? rule.explanationTemplate;
  }
  const render = (language: "es" | "en") => {
    const join = language === "es" ? " y " : " and ";
    return rule.explanationTemplate[language].replace(/\{(\w+)\}/g, (_, name: string) => {
      const source = labelSource[name]!;
      return source.ids.map((id) => source.labels.get(id)![language]).join(join);
    });
  };
  return { es: render("es"), en: render("en") };
}

export function recommend(
  signals: SessionSignals,
  content: PublicContentBundle,
  options: RecommendOptions = {},
): RecommendationResult | null {
  const maxResults = Math.min(Math.max(options.maxResults ?? DEFAULT_MAX_RESULTS, 1), MAX_RECOMMENDATIONS);
  const idx = buildIndex(content);
  const s = normalize(signals, idx);
  const solutions = new Map(content.solutions.map((sol) => [sol.id, sol]));

  const candidates: Candidate[] = [];
  for (const rule of content.recommendationRules) {
    const solution = solutions.get(rule.solutionId);
    if (!solution || solution.isFallback || isExcluded(rule, s)) continue;
    const matches = scoreRule(rule, s);
    const score = sum(matches);
    if (matches.length === 0 || score < rule.minimumScore) continue;
    const explicitScore = sum(
      matches.filter(
        (m) => m.kind === "direct" && (m.signalType === "challenges" || m.signalType === "explicitInterests"),
      ),
    );
    candidates.push({ rule, solution, score, explicitScore, matches });
  }

  candidates.sort(
    (a, b) =>
      b.score - a.score ||
      b.explicitScore - a.explicitScore ||
      b.rule.priority - a.rule.priority ||
      (a.solution.id < b.solution.id ? -1 : a.solution.id > b.solution.id ? 1 : 0),
  );

  const base = {
    engineVersion: ENGINE_VERSION,
    contentVersion: content.manifest.contentVersion,
    contentMode: content.mode,
  };

  if (candidates.length === 0) {
    const fallback = content.solutions.find((sol) => sol.isFallback);
    if (!fallback) return null;
    const item: RecommendationItem = {
      solutionId: fallback.id,
      ruleId: null,
      rank: 1,
      score: 0,
      matchedSignals: [],
      whyThisAppeared: FALLBACK_WHY,
      relevance: fallback.summary,
      relatedSceneIds: fallback.relatedSceneIds,
      digitalAssetIds: fallback.digitalAssetIds,
      nextStep: fallback.nextStep,
      pendingValidation: fallback.validationStatus !== "validated",
      isFallback: true,
    };
    return { ...base, items: [item] };
  }

  const items = candidates.slice(0, maxResults).map<RecommendationItem>((c, i) => ({
    solutionId: c.solution.id,
    ruleId: c.rule.id,
    rank: i + 1,
    score: c.score,
    matchedSignals: c.matches,
    whyThisAppeared: buildWhyThisAppeared(c.matches, idx),
    relevance: renderRelevance(c.rule, c.matches, c.solution, idx),
    relatedSceneIds: c.solution.relatedSceneIds,
    digitalAssetIds: c.solution.digitalAssetIds,
    nextStep: c.solution.nextStep,
    pendingValidation: c.solution.validationStatus !== "validated",
    isFallback: false,
  }));
  return { ...base, items };
}
