"use client";

import { useEffect, useRef } from "react";
import { useLanguage } from "@/lib/i18n/language-provider";
import { useScreenHeading } from "../screens/use-screen-heading";

/**
 * Brief transition after the role journey: "We are tailoring the experience to your priorities."
 * Recommendations are already calculated; this only gives the visitor a moment of feedback, then moves on.
 */
export function TailoringScreen({ durationMs, onDone }: { durationMs: number; onDone: () => void }) {
  const { t } = useLanguage();
  const heading = useScreenHeading<HTMLParagraphElement>();
  // Keep the latest callback without restarting the timer when the parent re-renders.
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  }, [onDone]);
  useEffect(() => {
    const timer = setTimeout(() => done.current(), durationMs);
    return () => clearTimeout(timer);
  }, [durationMs]);

  return (
    <section
      data-testid="tailoring-screen"
      className="px-gutter flex flex-1 flex-col items-center justify-center gap-10 py-16 text-center"
    >
      <span aria-hidden className="relative flex size-28 items-center justify-center">
        <span className="bg-primary/25 motion-safe:animate-pulse-ring absolute inset-0 rounded-full" />
        <span className="border-primary/25 border-t-primary size-24 rounded-full border-8 motion-safe:animate-spin" />
      </span>
      <p
        ref={heading}
        tabIndex={-1}
        role="status"
        className="text-headline text-ink max-w-3xl font-bold text-balance outline-none"
      >
        {t("tailoring.message")}
      </p>
    </section>
  );
}
