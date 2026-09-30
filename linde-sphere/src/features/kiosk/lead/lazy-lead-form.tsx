"use client";

import { useEffect, useState, type ComponentProps } from "react";
import { useLanguage } from "@/lib/i18n/language-provider";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import type { LeadFormScreen } from "./lead-form-screen";

/**
 * The lead form is the only kiosk screen that validates with the shared zod schemas, so it is loaded on
 * demand instead of with the first screen (ADR-058). The kiosk prefetches it while idle after start-up,
 * so visitors normally never see the loading state; if the chunk cannot be fetched (server restarting), the
 * visitor can retry or go back to their recommendations.
 */
type LeadFormModule = typeof import("./lead-form-screen");

let loaded: LeadFormModule | null = null;
let pending: Promise<LeadFormModule> | null = null;

export function preloadLeadForm(): Promise<LeadFormModule> {
  if (loaded) return Promise.resolve(loaded);
  pending ??= import("./lead-form-screen").then(
    (mod) => (loaded = mod),
    (error: unknown) => {
      pending = null; // allow a later retry
      throw error;
    },
  );
  return pending;
}

export function LazyLeadFormScreen(props: ComponentProps<typeof LeadFormScreen>) {
  const [mod, setMod] = useState<LeadFormModule | null>(loaded);
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  const { t } = useLanguage();

  useEffect(() => {
    if (mod) return;
    let active = true;
    preloadLeadForm().then(
      (m) => active && setMod(m),
      () => active && setFailed(true),
    );
    return () => {
      active = false;
    };
  }, [mod, attempt]);

  if (mod) return <mod.LeadFormScreen {...props} />;
  if (failed)
    return (
      <ErrorState
        headingLevel={1}
        onRetry={() => {
          setFailed(false);
          setAttempt((n) => n + 1);
        }}
        onHome={props.onCancel}
        homeLabel={t("leadForm.actions.back")}
      />
    );
  return <LoadingState headingLevel={1} />;
}
