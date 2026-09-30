"use client";

import { ChallengeCard } from "@/components/cards/challenge-card";
import { TouchCard } from "@/components/cards/touch-card";
import type { PublicChallenge as Challenge } from "@/domain/content/visibility";
import { useLanguage } from "@/lib/i18n/language-provider";

/**
 * Multi-select challenge list (up to `max`) followed by "Something else", which records that the
 * visitor's priority is not listed without asking for any text. It does not count toward the limit.
 */
export function ChallengePicker({
  challenges,
  selectedIds,
  max,
  otherSelected,
  onToggle,
  onToggleOther,
  label,
  columns = 1,
}: {
  challenges: Challenge[];
  selectedIds: string[];
  max: number;
  otherSelected: boolean;
  onToggle: (challengeId: string) => void;
  onToggleOther: () => void;
  label: string;
  columns?: 1 | 2;
}) {
  const { t } = useLanguage();
  const limitReached = selectedIds.length >= max;
  return (
    <div className="flex flex-col gap-4">
      <p aria-live="polite" data-testid="challenge-count" className="text-label text-ink-muted font-semibold">
        {t("roleChallenges.selectedCount", { count: selectedIds.length, max })}
      </p>
      <ul aria-label={label} className={columns === 2 ? "grid gap-4 sm:grid-cols-2" : "flex flex-col gap-4"}>
        {challenges.map((challenge) => (
          <li key={challenge.id} className="flex">
            <ChallengeCard
              challenge={challenge}
              selected={selectedIds.includes(challenge.id)}
              limitReached={limitReached}
              maxSelections={max}
              onToggle={onToggle}
            />
          </li>
        ))}
        <li className="flex">
          <TouchCard
            testId="challenge-something-else"
            title={t("somethingElse.title")}
            description={t("somethingElse.description")}
            selected={otherSelected}
            onSelect={onToggleOther}
            indicator="checkbox"
          />
        </li>
      </ul>
    </div>
  );
}
