"use client";

/* eslint-disable @next/next/no-img-element -- small local WebP portraits with their own srcset (ADR-064) */
import { PersonIcon } from "@/components/icons";
import { PERSONA_ART, PERSONA_ART_SIZES } from "@/domain/content/persona-art";
import type { PublicPersona as Persona } from "@/domain/content/visibility";
import { cn } from "@/lib/cn";
import { useLanguage } from "@/lib/i18n/language-provider";
import { TouchCard } from "./touch-card";

/**
 * Persona portrait (ADR-064): the approved 2:3 illustration in a column on the card's left, or a neutral tile
 * when the persona has none, so every card in the grid lines up. The illustrations have a white background;
 * `mix-blend-multiply` lets it take the card's own color (also when selected). Decorative (`alt=""`, hidden
 * from assistive technology): the card's title already names the role.
 */
export function PersonaPortrait({
  illustration,
  selected,
}: {
  illustration: Persona["illustration"];
  selected: boolean;
}) {
  if (!illustration) {
    return (
      <span
        aria-hidden
        data-testid="persona-portrait"
        data-illustrated="false"
        className={cn(
          "rounded-control flex aspect-[2/3] w-[3.5rem] items-center justify-center",
          selected ? "bg-primary text-on-primary" : "bg-primary/10 text-primary",
        )}
      >
        <PersonIcon size="size-7" />
      </span>
    );
  }
  return (
    <img
      aria-hidden
      data-testid="persona-portrait"
      data-illustrated="true"
      src={illustration.src}
      srcSet={illustration.srcSet.map((c) => `${c.src} ${c.width}w`).join(", ")}
      sizes={PERSONA_ART_SIZES}
      alt=""
      width={PERSONA_ART.width}
      height={PERSONA_ART.height}
      decoding="async"
      draggable={false}
      className="aspect-[2/3] h-auto w-[3.5rem] object-contain mix-blend-multiply select-none"
    />
  );
}

/** "I work in…" choice. Single-select: pass `selected` for the chosen persona only. */
export function PersonaCard({
  persona,
  selected,
  onSelect,
  density,
}: {
  persona: Pick<Persona, "id" | "label" | "description" | "illustration">;
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
      media={<PersonaPortrait illustration={persona.illustration} selected={selected} />}
      selected={selected}
      onSelect={() => onSelect(persona.id)}
      indicator="check"
      density={density}
    />
  );
}
