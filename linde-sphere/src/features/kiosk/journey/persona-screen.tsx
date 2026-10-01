"use client";

import { PrimaryAction, SecondaryAction } from "@/components/actions/action-button";
import { PersonaCard } from "@/components/cards/persona-card";
import { EmptyState } from "@/components/feedback/empty-state";
import { ArrowRightIcon } from "@/components/icons";
import { ProgressIndicator } from "@/components/navigation/progress-indicator";
import type { PublicPersona as Persona } from "@/domain/content/visibility";
import { useLanguage } from "@/lib/i18n/language-provider";
import { splitPersonas } from "./journey-view";
import { ScreenFrame } from "./screen-frame";

/**
 * "Trabajo en…" step 1: one primary area, chosen from plain-language cards, or "My role spans several
 * areas". Selecting a card only marks it; "Continuar" moves on, so a mis-tap is easy to correct.
 */
export function PersonaScreen({
  personas,
  selectedId,
  onSelect,
  onContinue,
  onBack,
  optional = false,
}: {
  personas: Persona[];
  selectedId: string | null;
  onSelect: (personaId: string) => void;
  onContinue: () => void;
  onBack: () => void;
  /** Path B: the role is step 2 of 2 and may be skipped. */
  optional?: boolean;
}) {
  const { t } = useLanguage();
  const { single, multiple } = splitPersonas(personas);

  return (
    <ScreenFrame
      testId="persona-screen"
      title={t("role.title")}
      subtitle={optional ? t("challengeRole.subtitle") : t("role.subtitle")}
      progress={<ProgressIndicator current={optional ? 2 : 1} total={2} />}
      actions={
        <>
          <SecondaryAction data-testid="persona-back" onClick={onBack}>
            {t("journey.back")}
          </SecondaryAction>
          <PrimaryAction
            data-testid="persona-continue"
            disabled={!optional && selectedId === null}
            icon={<ArrowRightIcon />}
            onClick={onContinue}
          >
            {optional && selectedId === null ? t("challengeRole.skip") : t("journey.continue")}
          </PrimaryAction>
        </>
      }
    >
      {single.length === 0 && !multiple ? (
        <EmptyState title={t("ui.emptyTitle")} body={t("role.empty")} />
      ) : (
        <div className="flex flex-col gap-3">
          <ul aria-label={t("role.listLabel")} className="grid gap-3 sm:grid-cols-2">
            {single.map((persona) => (
              <li key={persona.id} className="flex">
                <PersonaCard
                  persona={persona}
                  selected={persona.id === selectedId}
                  onSelect={onSelect}
                  density="compact"
                />
              </li>
            ))}
          </ul>
          {multiple && (
            <>
              <p aria-hidden className="text-label text-ink-muted flex items-center gap-4">
                <span className="bg-line h-px flex-1" />
                {t("role.or")}
                <span className="bg-line h-px flex-1" />
              </p>
              <PersonaCard
                persona={multiple}
                selected={multiple.id === selectedId}
                onSelect={onSelect}
                density="compact"
              />
            </>
          )}
        </div>
      )}
    </ScreenFrame>
  );
}
