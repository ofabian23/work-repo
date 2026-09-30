"use client";

import type { Persona } from "@/domain/content/taxonomy";
import { useLanguage } from "@/lib/i18n/language-provider";
import { TouchCard } from "./touch-card";

/** "I work in…" choice. Single-select: pass `selected` for the chosen persona only. */
export function PersonaCard({
  persona,
  selected,
  onSelect,
  density,
}: {
  persona: Pick<Persona, "id" | "label" | "description">;
  selected: boolean;
  onSelect: (personaId: string) => void;
  density?: "comfortable" | "compact";
}) {
  const { localize } = useLanguage();
  return (
    <TouchCard
      testId={`persona-${persona.id}`}
      title={localize(persona.label)}
      description={localize(persona.description)}
      selected={selected}
      onSelect={() => onSelect(persona.id)}
      indicator="check"
      density={density}
    />
  );
}
