"use client";

import { PrimaryAction, SecondaryAction } from "@/components/actions/action-button";
import { useLanguage } from "@/lib/i18n/language-provider";
import { Modal } from "./dialog";

/**
 * "Are you still there?" countdown before an automatic privacy reset. Presentational: the idle timer
 * (Phase 4) owns the countdown. Any dismissal (Esc, backdrop tap) counts as activity → onContinue.
 */
export function InactivityWarning({
  open,
  secondsRemaining,
  onContinue,
  onReset,
}: {
  open: boolean;
  secondsRemaining: number;
  onContinue: () => void;
  onReset: () => void;
}) {
  const { t } = useLanguage();
  return (
    <Modal
      open={open}
      onClose={onContinue}
      hideCloseButton
      testId="inactivity-warning"
      title={t("inactivity.title")}
      description={t("inactivity.body", { seconds: secondsRemaining })}
      footer={
        <>
          <SecondaryAction onClick={onReset}>{t("inactivity.startOver")}</SecondaryAction>
          <PrimaryAction onClick={onContinue} data-autofocus>
            {t("inactivity.continue")}
          </PrimaryAction>
        </>
      }
    >
      <p
        aria-hidden
        className="text-primary text-center text-[clamp(4rem,14vmin,8rem)] leading-none font-bold tabular-nums"
      >
        {secondsRemaining}
      </p>
    </Modal>
  );
}
