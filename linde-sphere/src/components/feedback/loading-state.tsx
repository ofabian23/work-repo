"use client";

import { useLanguage } from "@/lib/i18n/language-provider";
import { StateLayout } from "./state-layout";

/** Spinner + label. The spinner stops rotating under reduced motion; the label always shows. */
export function LoadingState({ label, headingLevel }: { label?: string; headingLevel?: 1 | 2 | 3 }) {
  const { t } = useLanguage();
  return (
    <StateLayout
      testId="loading-state"
      role="status"
      headingLevel={headingLevel}
      title={label ?? t("status.loading")}
      icon={
        <span
          aria-hidden
          className="border-line border-t-primary size-16 rounded-full border-[6px] motion-safe:animate-spin"
        />
      }
    />
  );
}
