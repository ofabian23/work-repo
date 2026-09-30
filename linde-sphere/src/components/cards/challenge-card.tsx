"use client";

import type { PublicChallenge as Challenge } from "@/domain/content/visibility";
import { useLanguage } from "@/lib/i18n/language-provider";
import { TouchCard } from "./touch-card";

/**
 * "I need to…" choice. Multi-select up to a limit: when the limit is reached, unselected cards are
 * disabled but stay focusable and explain why.
 */
export function ChallengeCard({
  challenge,
  selected,
  limitReached,
  maxSelections,
  onToggle,
}: {
  challenge: Pick<Challenge, "id" | "label" | "description">;
  selected: boolean;
  limitReached: boolean;
  maxSelections: number;
  onToggle: (challengeId: string) => void;
}) {
  const { localize, t } = useLanguage();
  const disabled = limitReached && !selected;
  return (
    <TouchCard
      testId={`challenge-${challenge.id}`}
      title={localize(challenge.label)}
      description={localize(challenge.description)}
      selected={selected}
      disabled={disabled}
      hint={disabled ? t("ui.selectionLimit", { max: maxSelections }) : undefined}
      onSelect={() => onToggle(challenge.id)}
      indicator="checkbox"
    />
  );
}
