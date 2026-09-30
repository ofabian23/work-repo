"use client";

import type { ReactNode } from "react";
import { BottomActionBar } from "@/components/actions/bottom-action-bar";
import { useLanguage } from "@/lib/i18n/language-provider";
import { useScreenHeading } from "../screens/use-screen-heading";

/**
 * Shared layout for journey screens: optional progress, a focused h1, a short subtitle, the body and
 * a sticky bottom action bar within arm's reach.
 */
export function ScreenFrame({
  testId,
  title,
  subtitle,
  progress,
  children,
  actions,
}: {
  testId: string;
  title: string;
  subtitle?: ReactNode;
  progress?: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
}) {
  const { t } = useLanguage();
  const heading = useScreenHeading();
  return (
    <section data-testid={testId} className="flex flex-1 flex-col">
      <div className="px-gutter flex flex-1 flex-col gap-[clamp(1rem,2vh,2rem)] py-[clamp(1.25rem,2vh,2.5rem)]">
        <header className="flex flex-col gap-3">
          {progress}
          <h1
            ref={heading}
            tabIndex={-1}
            className="text-headline text-ink font-bold tracking-tight text-balance outline-none"
          >
            {title}
          </h1>
          {subtitle && <p className="text-lead text-ink-muted max-w-3xl text-pretty">{subtitle}</p>}
        </header>
        {children}
      </div>
      {actions && <BottomActionBar label={t("ui.actions")}>{actions}</BottomActionBar>}
    </section>
  );
}
