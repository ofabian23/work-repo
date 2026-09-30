"use client";

import { PrimaryAction, SecondaryAction } from "@/components/actions/action-button";
import { ErrorIcon } from "@/components/icons";
import { useLanguage } from "@/lib/i18n/language-provider";
import { StateLayout } from "./state-layout";

/** Recoverable error with retry and "back to start" actions. Never shows technical details besides a reference. */
export function ErrorState({
  title,
  body,
  digest,
  onRetry,
  onHome,
  headingLevel,
}: {
  title?: string;
  body?: string;
  /** Opaque error reference (Next.js digest) to match server logs. */
  digest?: string;
  onRetry?: () => void;
  onHome?: () => void;
  headingLevel?: 1 | 2 | 3;
}) {
  const { t } = useLanguage();
  return (
    <StateLayout
      testId="error-state"
      role="alert"
      headingLevel={headingLevel}
      title={title ?? t("status.errorTitle")}
      body={body ?? t("status.errorBody")}
      icon={
        <span className="bg-danger-surface text-danger flex size-20 items-center justify-center rounded-full">
          <ErrorIcon size="size-10" />
        </span>
      }
    >
      {onRetry && <PrimaryAction onClick={onRetry}>{t("status.retry")}</PrimaryAction>}
      {onHome && <SecondaryAction onClick={onHome}>{t("status.backHome")}</SecondaryAction>}
      {digest && (
        <p className="text-ink-muted text-caption w-full">{t("status.errorReference", { digest })}</p>
      )}
    </StateLayout>
  );
}
