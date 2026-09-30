"use client";

import { PrimaryAction } from "@/components/actions/action-button";
import { EmptyState } from "@/components/feedback/empty-state";
import { appConfig } from "@/lib/config/app-config";
import { useLanguage } from "@/lib/i18n/language-provider";

export function NotFoundScreen() {
  const { t } = useLanguage();
  return (
    <div data-testid="not-found-screen" className="flex flex-1 flex-col">
      <EmptyState
        headingLevel={1}
        title={t("status.notFoundTitle")}
        body={t("status.notFoundBody")}
        // Hard navigation: replaces the history entry, like a kiosk reset.
        action={
          <PrimaryAction onClick={() => window.location.replace(appConfig.routes.home)}>
            {t("status.backHome")}
          </PrimaryAction>
        }
      />
    </div>
  );
}
