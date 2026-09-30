import type { Language, LocalizedText } from "../content/primitives";
import { MAX_LABELS_PER_REASON, MAX_REASON_GROUPS } from "./engine-config";
import type { MatchedSignal } from "./recommendation-result";

/**
 * Builds the plain-language "Why this appeared" sentence from matched signals.
 * Labels are quoted verbatim («…» in Spanish, “…” in English) so no grammatical guessing is needed,
 * and implied signals are always phrased as "related to what you explored", never as a visitor choice.
 */

export type LabelIndex = {
  personas: Map<string, LocalizedText>;
  challenges: Map<string, LocalizedText>;
  facilityTypes: Map<string, LocalizedText>;
  scenes: Map<string, LocalizedText>;
  hotspotLabels: Map<string, LocalizedText>;
  solutions: Map<string, LocalizedText>;
};

type ReasonGroup = "interest" | "challenge" | "persona" | "hotspot" | "scene" | "facility" | "implied";

/** Tie-break order when two groups contribute the same weight: explicit choices first. */
const GROUP_ORDER: ReasonGroup[] = [
  "interest",
  "challenge",
  "persona",
  "hotspot",
  "scene",
  "facility",
  "implied",
];

function groupOf(m: MatchedSignal): ReasonGroup {
  if (m.kind === "implied-challenge") return "implied";
  switch (m.signalType) {
    case "explicitInterests":
      return "interest";
    case "challenges":
      return "challenge";
    case "personas":
      return "persona";
    case "facilityTypes":
      return "facility";
    case "scenes":
      return "scene";
    case "hotspots":
      return "hotspot";
  }
}

const quote = (label: string, language: Language) => (language === "es" ? `«${label}»` : `“${label}”`);

function joinList(items: string[], language: Language): string {
  const and = language === "es" ? " y " : " and ";
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")}${and}${items.at(-1)}`;
}

const PHRASES: Record<ReasonGroup, Record<Language, (list: string) => string>> = {
  interest: { es: () => "lo marcó como interés", en: () => "you marked it as an interest" },
  challenge: { es: (l) => `eligió ${l}`, en: (l) => `you chose ${l}` },
  persona: { es: (l) => `seleccionó ${l} como su área`, en: (l) => `you selected ${l} as your area` },
  hotspot: { es: (l) => `abrió ${l}`, en: (l) => `you opened ${l}` },
  scene: { es: (l) => `exploró ${l}`, en: (l) => `you explored ${l}` },
  facility: { es: (l) => `su organización es ${l}`, en: (l) => `your organization is ${l}` },
  implied: {
    es: (l) => `lo que exploró se relaciona con ${l}`,
    en: (l) => `what you explored relates to ${l}`,
  },
};

const LEAD: Record<Language, string> = { es: "Aparece porque", en: "This appeared because" };

export const FALLBACK_WHY: LocalizedText = {
  es: "Aún no identificamos una coincidencia específica con sus selecciones; un especialista puede ayudarle a explorar opciones.",
  en: "We have not identified a specific match for your selections yet; a specialist can help you explore options.",
};

export function buildWhyThisAppeared(matches: MatchedSignal[], idx: LabelIndex): LocalizedText {
  const groups = new Map<ReasonGroup, { weight: number; ids: Map<string, number> }>();
  for (const m of matches) {
    const group = groupOf(m);
    const entry = groups.get(group) ?? { weight: 0, ids: new Map<string, number>() };
    entry.weight += m.weight;
    entry.ids.set(m.signalId, (entry.ids.get(m.signalId) ?? 0) + m.weight);
    groups.set(group, entry);
  }

  const ranked = [...groups.entries()]
    .sort(([ga, a], [gb, b]) => b.weight - a.weight || GROUP_ORDER.indexOf(ga) - GROUP_ORDER.indexOf(gb))
    .slice(0, MAX_REASON_GROUPS);

  const labelsFor = (group: ReasonGroup): Map<string, LocalizedText> =>
    group === "persona"
      ? idx.personas
      : group === "facility"
        ? idx.facilityTypes
        : group === "scene"
          ? idx.scenes
          : group === "hotspot"
            ? idx.hotspotLabels
            : group === "interest"
              ? idx.solutions
              : idx.challenges;

  const render = (language: Language) => {
    const clauses = ranked.map(([group, entry]) => {
      const ids = [...entry.ids.entries()]
        .sort(([ia, a], [ib, b]) => b - a || (ia < ib ? -1 : ia > ib ? 1 : 0))
        .slice(0, MAX_LABELS_PER_REASON)
        .map(([id]) => id);
      const labels = ids.map((id) => quote(labelsFor(group).get(id)?.[language] ?? id, language));
      return PHRASES[group][language](joinList(labels, language));
    });
    // One reason: a single sentence. Several: a colon list, so labels joined with "y"/"and" never
    // collide with the clause separators.
    return clauses.length === 1
      ? `${LEAD[language]} ${clauses[0]}.`
      : `${LEAD[language]}: ${clauses.join("; ")}.`;
  };

  return { es: render("es"), en: render("en") };
}
