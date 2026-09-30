"use client";

import { useState } from "react";
import { ResetIcon } from "@/components/icons";
import { Modal } from "@/components/overlay/dialog";
import { useLanguage } from "@/lib/i18n/language-provider";
import { PrimaryAction, SecondaryAction } from "./action-button";

/**
 * Discreet "Start over" control (≥ 56 px). Asks for confirmation first so an accidental tap never
 * wipes a visitor's progress; `onReset` performs the privacy reset (Phase 4: hard reload).
 */
export function ResetExperienceButton({
  onReset,
  requireConfirmation = true,
}: {
  onReset: () => void;
  requireConfirmation?: boolean;
}) {
  const { t } = useLanguage();
  const [confirming, setConfirming] = useState(false);

  return (
    <>
      <button
        type="button"
        data-testid="reset-experience"
        onClick={() => (requireConfirmation ? setConfirming(true) : onReset())}
        className="focus-ring border-line text-ink-muted text-label active:bg-surface-muted inline-flex min-h-14 min-w-14 items-center justify-center gap-2 rounded-full border px-4 font-semibold sm:px-5"
      >
        <ResetIcon size="size-6" />
        {/* Icon-only on narrow screens (label kept for assistive tech); full label on the kiosk. */}
        <span className="max-sm:sr-only sm:not-sr-only">{t("reset.button")}</span>
      </button>
      <Modal
        open={confirming}
        onClose={() => setConfirming(false)}
        testId="reset-confirmation"
        title={t("reset.confirmTitle")}
        description={t("reset.confirmBody")}
        footer={
          <>
            <SecondaryAction onClick={() => setConfirming(false)} data-autofocus>
              {t("reset.cancel")}
            </SecondaryAction>
            <PrimaryAction
              onClick={() => {
                setConfirming(false);
                onReset();
              }}
            >
              {t("reset.confirm")}
            </PrimaryAction>
          </>
        }
      />
    </>
  );
}
