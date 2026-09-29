"use client";

import { StatusScreen } from "@/components/shell/status-screen";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/features/language/language-provider";
import { appConfig } from "@/lib/config/app-config";

export function ErrorScreen({ digest, onRetry }: { digest?: string; onRetry: () => void }) {
  const { t } = useLanguage();
  return (
    <StatusScreen testId="error-screen" title={t("status.errorTitle")} body={t("status.errorBody")}>
      <Button onClick={onRetry}>{t("status.retry")}</Button>
      <Button variant="secondary" onClick={() => window.location.replace(appConfig.routes.home)}>
        {t("status.backHome")}
      </Button>
      {digest && <p className="text-ink-muted w-full text-base">{t("status.errorReference", { digest })}</p>}
    </StatusScreen>
  );
}
