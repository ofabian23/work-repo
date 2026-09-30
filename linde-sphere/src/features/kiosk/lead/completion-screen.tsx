"use client";

import { useEffect, useRef, useState } from "react";
import { PrimaryAction } from "@/components/actions/action-button";
import { ClockIcon, MailIcon } from "@/components/icons";
import { useLanguage } from "@/lib/i18n/language-provider";
import { useScreenHeading } from "../screens/use-screen-heading";
import type { DeliveryOutcome } from "./lead-api";

export type Consultation = {
  heading: string;
  body: string;
  contact: { name: string; email: string; phone: string | null } | null;
};

/**
 * Completion screen (ADR-055): report delivery status, the masked destination, an optional consultation
 * next step, a short countdown and "Finalizar ahora". When the countdown ends (or the visitor finishes),
 * the visit is reset and the kiosk returns to the attract screen with a fresh session.
 */
export function CompletionScreen({
  delivery,
  maskedEmail,
  followUp,
  consultation,
  seconds,
  onFinish,
}: {
  delivery: DeliveryOutcome;
  maskedEmail: string;
  followUp: boolean;
  consultation: Consultation | null;
  seconds: number;
  onFinish: () => void;
}) {
  const { t } = useLanguage();
  const heading = useScreenHeading();
  const [remaining, setRemaining] = useState(Math.max(1, seconds));
  const finished = useRef(false);
  const onFinishRef = useRef(onFinish);
  useEffect(() => {
    onFinishRef.current = onFinish;
  }, [onFinish]);

  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    onFinishRef.current();
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setRemaining((r) => {
        const next = r - 1;
        if (next <= 0) {
          clearInterval(timer);
          // Finish outside the state updater (it resets the whole store).
          queueMicrotask(finish);
        }
        return Math.max(next, 0);
      });
    }, 1000);
    return () => clearInterval(timer);
    // `finish` only reads refs, so the first render's instance is safe to keep.
  }, []);

  return (
    <section
      data-testid="lead-result"
      data-delivery={delivery}
      className="px-gutter flex flex-1 flex-col items-center justify-center gap-6 py-12 text-center"
    >
      {delivery === "delayed" ? (
        <ClockIcon size="size-16" className="text-notice" />
      ) : (
        <MailIcon size="size-16" className="text-success" />
      )}
      <h1
        ref={heading}
        tabIndex={-1}
        className="text-headline text-ink font-bold tracking-tight text-balance outline-none"
      >
        {t(`leadForm.result.${delivery}Title`)}
      </h1>
      <p
        role="status"
        data-testid="delivery-status"
        className="text-lead text-ink-muted max-w-2xl text-pretty"
      >
        {t(`leadForm.result.${delivery}Body`, { email: maskedEmail })}
      </p>
      <p className="text-body text-ink-muted max-w-2xl">
        {followUp ? t("leadForm.result.followUp") : t("leadForm.result.noFollowUp")}
      </p>

      {consultation && (
        <section
          data-testid="consultation-next-step"
          className="rounded-card bg-info-surface flex w-full max-w-2xl flex-col gap-2 p-6 text-left"
        >
          <p className="text-caption text-info font-semibold tracking-wide uppercase">
            {t("leadForm.result.optionalNextStep")}
          </p>
          <h2 className="text-title text-ink font-bold">{consultation.heading}</h2>
          <p className="text-body text-ink">{consultation.body}</p>
          {consultation.contact && (
            <p className="text-body text-ink font-semibold" data-testid="consultation-contact">
              {[consultation.contact.name, consultation.contact.email, consultation.contact.phone]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
        </section>
      )}

      <p role="timer" aria-live="off" data-testid="completion-countdown" className="text-body text-ink-muted">
        {t("leadForm.result.countdown", { seconds: remaining })}
      </p>
      <PrimaryAction data-testid="lead-finish" onClick={finish}>
        {t("leadForm.actions.finish")}
      </PrimaryAction>
    </section>
  );
}
