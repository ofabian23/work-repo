"use client";

import type { ReactNode } from "react";
import type { ContentMode } from "@/domain/content/primitives";
import { appConfig } from "@/lib/config/app-config";
import { useLanguage } from "@/lib/i18n/language-provider";
import { KioskHeader } from "./kiosk-header";

/**
 * Portrait-first kiosk frame: KioskHeader, flexible main area, discreet footer.
 * At 1080 × 1920 it fills the screen; on wider screens it becomes a centered portrait column.
 */
export function AppShell({
  children,
  contentMode,
  headerActions,
}: {
  children: ReactNode;
  contentMode: ContentMode;
  headerActions?: ReactNode;
}) {
  const { t } = useLanguage();

  return (
    <div className="bg-canvas flex min-h-dvh justify-center">
      <div className="bg-surface flex min-h-dvh w-full max-w-[1080px] flex-col shadow-[0_0_60px_rgba(19,35,47,0.08)]">
        <KioskHeader actions={headerActions} />

        <main id="main" className="flex flex-1 flex-col">
          {children}
        </main>

        <footer className="border-line text-ink-muted text-caption px-gutter flex flex-wrap items-center justify-between gap-3 border-t py-4">
          <span>{t("shell.footerVersion", { version: appConfig.version })}</span>
          {contentMode === "demo" && (
            <span
              data-testid="demo-mode-indicator"
              className="bg-notice-surface text-notice rounded-full px-4 py-1 font-medium"
            >
              {t("shell.demoMode")}
            </span>
          )}
        </footer>
      </div>
    </div>
  );
}
