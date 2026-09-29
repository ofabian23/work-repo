"use client";

import { StatusScreen } from "@/components/shell/status-screen";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/features/language/language-provider";
import { appConfig } from "@/lib/config/app-config";

export function NotFoundScreen() {
  const { t } = useLanguage();
  return (
    <StatusScreen testId="not-found-screen" title={t("status.notFoundTitle")} body={t("status.notFoundBody")}>
      {/* Hard navigation: replaces the history entry, like a kiosk reset. */}
      <Button onClick={() => window.location.replace(appConfig.routes.home)}>{t("status.backHome")}</Button>
    </StatusScreen>
  );
}
