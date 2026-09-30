"use client";

import { PrimaryAction, SecondaryAction } from "@/components/actions/action-button";
import { PersonaCard } from "@/components/cards/persona-card";
import { EmptyState } from "@/components/feedback/empty-state";
import { ArrowRightIcon } from "@/components/icons";
import { ProgressIndicator } from "@/components/navigation/progress-indicator";
import type { Persona } from "@/domain/content/taxonomy";
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
}: {
  personas: Persona[];
  selectedId: string | null;
  onSelect: (personaId: string) => void;
  onContinue: () => void;
  onBack: () => void;
}) {
  const { t } = useLanguage();
  const { single, multiple } = splitPersonas(personas);

  return (
    <ScreenFrame
      testId="persona-screen"
      title={t("role.title")}
      subtitle={t("role.subtitle")}
      progress={<ProgressIndicator current={1} total={2} />}
      actions={
        <>
          <SecondaryAction data-testid="persona-back" onClick={onBack}>
            {t("journey.back")}
          </SecondaryAction>
          <PrimaryAction
            data-testid="persona-continue"
            disabled={selectedId === null}
            icon={<ArrowRightIcon />}
            onClick={onContinue}
          >
            {t("journey.continue")}
          </PrimaryAction>
        </>
      }
    >
      {single.length === 0 && !multiple ? (
        <EmptyState title={t("ui.emptyTitle")} body={t("role.empty")} />
      ) : (
        <div className="flex flex-col gap-3">
          <ul aria-label={t("role.listLabel")} className="grid gap-4 sm:grid-cols-2">
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
