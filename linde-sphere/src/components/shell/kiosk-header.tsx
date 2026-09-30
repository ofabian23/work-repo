"use client";

import type { ReactNode } from "react";
import { useLanguage } from "@/lib/i18n/language-provider";
import { BrandWordmark } from "./brand-wordmark";
import { LanguageToggle } from "./language-toggle";

/**
 * Top bar: product wordmark (configured, no logo unless approved), language toggle and an optional
 * slot for session controls such as ResetExperienceButton.
 */
export function KioskHeader({ actions }: { actions?: ReactNode }) {
  const { t } = useLanguage();
  return (
    <header
      aria-label={t("shell.header")}
      className="border-line px-gutter flex flex-col gap-3 border-b py-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <BrandWordmark />
        <LanguageToggle />
      </div>
      {/* Session controls get their own row; it collapses when no session is active. */}
      <div className="flex flex-wrap items-center justify-end gap-3 empty:hidden">{actions}</div>
    </header>
  );
}
