"use client";

import type { ReactNode } from "react";
import { SearchIcon } from "@/components/icons";
import { useLanguage } from "@/lib/i18n/language-provider";
import { StateLayout } from "./state-layout";

/** Shown when a list or area has nothing to display yet; optionally offers one action. */
export function EmptyState({
  title,
  body,
  action,
  headingLevel = 2,
}: {
  title?: string;
  body?: string;
  action?: ReactNode;
  headingLevel?: 1 | 2 | 3;
}) {
  const { t } = useLanguage();
  return (
    <StateLayout
      testId="empty-state"
      headingLevel={headingLevel}
      title={title ?? t("ui.emptyTitle")}
      body={body}
      icon={
        <span className="bg-surface-muted text-ink-muted flex size-20 items-center justify-center rounded-full">
          <SearchIcon size="size-10" />
        </span>
      }
    >
      {action}
    </StateLayout>
  );
}
