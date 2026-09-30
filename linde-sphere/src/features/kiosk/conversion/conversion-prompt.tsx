"use client";

import { PrimaryAction, SecondaryAction } from "@/components/actions/action-button";
import { SparkIcon } from "@/components/icons";
import { useLanguage } from "@/lib/i18n/language-provider";

/**
 * Non-modal, contextual prompt shown once recommendations are ready. It never takes focus or blocks the
 * screen; screen readers hear it through a polite live region.
 */
export function ConversionPrompt({
  visible,
  onAccept,
  onDismiss,
}: {
  visible: boolean;
  onAccept: () => void;
  onDismiss: () => void;
}) {
  const { t } = useLanguage();
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-36 z-40 flex justify-center px-4"
    >
      {visible && (
        <section
          data-testid="conversion-prompt"
          aria-label={t("conversion.label")}
          className="rounded-card border-primary bg-surface shadow-raised motion-safe:animate-sheet-in pointer-events-auto flex w-full max-w-[min(56rem,100%)] flex-col gap-4 border-2 p-5 sm:flex-row sm:items-center"
        >
          <p className="text-lead text-ink flex flex-1 items-center gap-3 font-semibold">
            <SparkIcon className="text-primary" />
            {t("conversion.message")}
          </p>
          <div className="flex flex-col-reverse gap-3 sm:flex-row">
            <SecondaryAction size="md" data-testid="conversion-prompt-dismiss" onClick={onDismiss}>
              {t("conversion.dismiss")}
            </SecondaryAction>
            <PrimaryAction size="md" data-testid="conversion-prompt-accept" onClick={onAccept}>
              {t("conversion.accept")}
            </PrimaryAction>
          </div>
        </section>
      )}
    </div>
  );
}
