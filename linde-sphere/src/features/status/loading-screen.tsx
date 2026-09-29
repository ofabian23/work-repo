"use client";

import { StatusScreen } from "@/components/shell/status-screen";
import { useLanguage } from "@/features/language/language-provider";

export function LoadingScreen() {
  const { t } = useLanguage();
  return (
    <StatusScreen
      testId="loading-screen"
      title={t("status.loading")}
      icon={
        <span
          aria-hidden
          className="border-line border-t-primary size-16 animate-spin rounded-full border-[6px]"
        />
      }
    />
  );
}
