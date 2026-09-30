import type { EngineSettings } from "../content/engine-settings";
import type { LocalizedText } from "../content/primitives";
import { extractPlaceholders } from "../content/primitives";
import type { RecommendationRule, SignalType } from "../content/recommendation-rule";
import type { Hotspot } from "../content/scene";
import {
  isVisibleStatus,
  type PublicContentBundle,
  type PublicRecommendationRule,
  type PublicSolution,
} from "../content/visibility";
import type { SessionSignals } from "../session/visitor-session";
import { ENGINE_VERSION } from "./engine-config";
import { FALLBACK_WHY, buildWhyThisAppeared, type LabelIndex } from "./explanations";
import type {
  MatchedSignal,
  RecommendationItem,
  RecommendationResult,
  RelevanceLevel,
} from "./recommendation-result";

/**
 * Deterministic, explainable recommendation engine (ADR-008, ADR-041, ADR-050).
 *
 * Pure function: no I/O, no clock, no randomness, whole-number arithmetic only. The same signals and
 * content always produce the same ordered result, so the kiosk (live display) and the server
 * (recomputation at lead time) agree. The algorithm is described step by step in ARCHITECTURE.md §7.
 */

export type RecommendOptions = {
  /** Override the result sizes from engine-settings.json (e.g. coverage reports use primary only). */
  primary?: number;
  secondary?: number;
};

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

type Index = LabelIndex & {
  hotspots: Map<string, Hotspot>;
  hotspotScene: Map<string, string>;
  rootSceneId: string | null;
  approvedAssetIds: Set<string>;
};

const sum = (matches: MatchedSignal[]) => matches.reduce((total, m) => total + m.weight, 0);
const byId = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Keeps the strongest matches until the cap is reached; the last one may count partially. This is what
 * stops repeated or numerous exploration signals from inflating a recommendation indefinitely.
 */
function applyCap(matches: MatchedSignal[], cap: number): MatchedSignal[] {
  const sorted = [...matches].sort((a, b) => b.weight - a.weight || byId(a.signalId, b.signalId));
  const kept: MatchedSignal[] = [];
  let remaining = cap;
  for (const m of sorted) {
    if (remaining <= 0) break;
    const weight = Math.min(m.weight, remaining);
    kept.push({ ...m, weight });
    remaining -= weight;
  }
  return kept;
}

function buildIndex(content: PublicContentBundle): Index {
  const hotspots = new Map<string, Hotspot>();
  const hotspotScene = new Map<string, string>();
  for (const scene of content.scenes) {
    for (const h of scene.hotspots) {
      hotspots.set(h.id, h);
      hotspotScene.set(h.id, scene.id);
    }
  }
  return {
    personas: new Map(content.personas.map((p) => [p.id, p.label])),
    challenges: new Map(content.challenges.map((c) => [c.id, c.label])),
    facilityTypes: new Map(content.facilityTypes.map((f) => [f.id, f.label])),
    scenes: new Map(content.scenes.map((s) => [s.id, s.title])),
    hotspotLabels: new Map([...hotspots].map(([id, h]) => [id, h.label])),
    solutions: new Map(content.solutions.map((s) => [s.id, s.title])),
    hotspots,
    hotspotScene,
    rootSceneId: content.scenes.find((s) => s.parentSceneId === null)?.id ?? null,
    approvedAssetIds: new Set(
      content.digitalAssets.filter((a) => a.validationStatus === "validated").map((a) => a.id),
    ),
  };
}

/**
 * Step 1: clean the input. Unknown or hidden ids and duplicates are dropped (a hotspot opened ten times
 * counts once), the visitor's order is kept, and engagement only counts for opened hotspots.
 */
function normalize(signals: SessionSignals, idx: Index): NormalizedSignals {
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

/** Step 2: exclusions are checked before any scoring; an excluded solution never competes. */
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

/** Step 3: add up the rule's whole-number weights for every signal the visitor has. */
function scoreRule(rule: PublicRecommendationRule, s: NormalizedSignals, scoring: EngineSettings["scoring"]) {
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
      scoring.sceneCap,
    ),
  );

  const hotspotMatches: MatchedSignal[] = [];
  for (const h of s.openedHotspots) {
    const directWeight = w.hotspots[h.id];
    const contribution: MatchedSignal | null = directWeight
      ? { signalType: "hotspots", signalId: h.id, kind: "direct", weight: directWeight }
      : h.recommendationSignals.solutionIds.includes(rule.solutionId) && scoring.hotspotAffinityWeight > 0
        ? {
            signalType: "hotspots",
            signalId: h.id,
            kind: "hotspot-affinity",
            weight: scoring.hotspotAffinityWeight,
          }
        : null;
    if (!contribution) continue;
    hotspotMatches.push(contribution);
    if (s.engagedHotspotIds.has(h.id) && scoring.engagedHotspotBonus > 0) {
      hotspotMatches.push({
        signalType: "hotspots",
        signalId: h.id,
        kind: "engaged-bonus",
        weight: scoring.engagedHotspotBonus,
      });
    }
  }
  matches.push(...applyCap(hotspotMatches, scoring.hotspotCap));

  // Challenges suggested by what the visitor opened, when they did not choose them explicitly.
  const selected = new Set(s.challengeIds);
  const implied = [...new Set(s.openedHotspots.flatMap((h) => h.recommendationSignals.challengeIds))]
    .filter((id) => !selected.has(id) && w.challenges[id])
    .map<MatchedSignal>((id) => ({
      signalType: "challenges",
      signalId: id,
      kind: "implied-challenge",
      weight: Math.max(1, Math.floor(w.challenges[id]! / scoring.impliedChallengeDivisor)),
    }));
  matches.push(...applyCap(implied, scoring.impliedChallengeCap));

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

/** Relevance in words, from the score and the thresholds in engine-settings.json. */
export function relevanceLevel(score: number, settings: EngineSettings["relevance"]): RelevanceLevel {
  if (score >= settings.high) return "high";
  if (score >= settings.medium) return "medium";
  return "possible";
}

/**
 * The scene that best shows a recommendation: where the visitor met it (strongest opened hotspot, then
 * strongest visited scene), otherwise the solution's first related area (the campus only as a last resort).
 */
function relevantScene(matches: MatchedSignal[], solution: PublicSolution, idx: Index): string | null {
  const strongest = (kind: SignalType) =>
    matches
      .filter((m) => m.signalType === kind && m.kind !== "engaged-bonus")
      .sort((a, b) => b.weight - a.weight || byId(a.signalId, b.signalId))[0]?.signalId;
  const hotspot = strongest("hotspots");
  if (hotspot && idx.hotspotScene.has(hotspot)) return idx.hotspotScene.get(hotspot)!;
  const scene = strongest("scenes");
  if (scene) return scene;
  const related = solution.relatedSceneIds.filter((id) => idx.scenes.has(id));
  return related.find((id) => id !== idx.rootSceneId) ?? related[0] ?? null;
}

function toItem(
  solution: PublicSolution,
  rank: number,
  tier: RecommendationItem["tier"],
  idx: Index,
  settings: EngineSettings,
  scored?: Candidate,
): RecommendationItem {
  const matches = scored?.matches ?? [];
  const score = scored?.score ?? 0;
  return {
    solutionId: solution.id,
    ruleId: scored?.rule.id ?? null,
    rank,
    tier,
    score,
    relevanceLevel: scored ? relevanceLevel(score, settings.relevance) : "possible",
    matchedSignals: matches,
    whyThisAppeared: scored ? buildWhyThisAppeared(matches, idx) : FALLBACK_WHY,
    relevance: scored ? renderRelevance(scored.rule, matches, solution, idx) : solution.summary,
    sceneId: relevantScene(matches, solution, idx),
    relatedSceneIds: solution.relatedSceneIds.filter((id) => idx.scenes.has(id)),
    digitalAssetIds: solution.digitalAssetIds.filter((id) => idx.approvedAssetIds.has(id)),
    nextStep: solution.nextStep,
    validationStatus: solution.validationStatus,
    pendingValidation: solution.validationStatus !== "validated",
    isFallback: !scored,
  };
}

export function recommend(
  signals: SessionSignals,
  content: PublicContentBundle,
  options: RecommendOptions = {},
): RecommendationResult | null {
  const settings = content.settings;
  const primaryCount = Math.min(Math.max(options.primary ?? settings.results.primary, 1), 3);
  const secondaryCount = Math.min(Math.max(options.secondary ?? settings.results.secondary, 0), 3);
  const idx = buildIndex(content);
  const s = normalize(signals, idx);
  // Defensive: only solutions visible in this mode compete (unavailable never; assumed only in demo).
  const solutions = new Map(
    content.solutions
      .filter((sol) => isVisibleStatus(sol.validationStatus, content.mode))
      .map((sol) => [sol.id, sol]),
  );

  const candidates: Candidate[] = [];
  for (const rule of content.recommendationRules) {
    const solution = solutions.get(rule.solutionId);
    if (!solution || solution.isFallback || isExcluded(rule, s)) continue;
    const matches = scoreRule(rule, s, settings.scoring);
    const score = sum(matches);
    if (matches.length === 0 || score < rule.minimumScore) continue;
    const explicitScore = sum(
      matches.filter(
        (m) => m.kind === "direct" && (m.signalType === "challenges" || m.signalType === "explicitInterests"),
      ),
    );
    candidates.push({ rule, solution, score, explicitScore, matches });
  }

  // Step 4: deterministic order — score, then explicit choices, then rule priority, then solution id.
  candidates.sort(
    (a, b) =>
      b.score - a.score ||
      b.explicitScore - a.explicitScore ||
      b.rule.priority - a.rule.priority ||
      byId(a.solution.id, b.solution.id),
  );

  const base = {
    engineVersion: ENGINE_VERSION,
    contentVersion: content.manifest.contentVersion,
    contentMode: content.mode,
  };

  if (candidates.length === 0) {
    const fallback = [...solutions.values()].find((sol) => sol.isFallback);
    if (!fallback) return null;
    return { ...base, items: [toItem(fallback, 1, "primary", idx, settings)] };
  }

  const items = candidates
    .slice(0, primaryCount + secondaryCount)
    .map((c, i) => toItem(c.solution, i + 1, i < primaryCount ? "primary" : "secondary", idx, settings, c));
  return { ...base, items };
}
