"use client";

import type { ReactNode } from "react";
import type { ContentMode } from "@/domain/content/primitives";
import { LanguageSwitcher } from "@/features/language/language-switcher";
import { useLanguage } from "@/features/language/language-provider";
import { appConfig } from "@/lib/config/app-config";
import { BrandWordmark } from "./brand-wordmark";

/**
 * Portrait-first kiosk frame: header (wordmark + language), flexible main area, discreet footer.
 * At 1080 × 1920 it fills the screen; on wider screens it becomes a centered portrait column.
 */
export function AppShell({ children, contentMode }: { children: ReactNode; contentMode: ContentMode }) {
  const { t } = useLanguage();

  return (
    <div className="bg-canvas flex min-h-dvh justify-center">
      <div className="bg-surface flex min-h-dvh w-full max-w-[1080px] flex-col shadow-[0_0_60px_rgba(19,35,47,0.08)]">
        <header
          aria-label={t("shell.header")}
          className="border-line flex flex-wrap items-center justify-between gap-4 border-b px-[6%] py-5"
        >
          <BrandWordmark />
          <LanguageSwitcher />
        </header>

        <main id="main" className="flex flex-1 flex-col">
          {children}
        </main>

        <footer className="border-line text-ink-muted flex flex-wrap items-center justify-between gap-3 border-t px-[6%] py-4 text-base">
          <span>{t("shell.footerVersion", { version: appConfig.version })}</span>
          {contentMode === "demo" && (
            <span
              data-testid="demo-mode-indicator"
              className="bg-notice-surface text-notice rounded-full px-4 py-1 text-sm font-medium"
            >
              {t("shell.demoMode")}
            </span>
          )}
        </footer>
      </div>
    </div>
  );
}
