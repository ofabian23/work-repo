"use client";

import { useState } from "react";
import { PrimaryAction } from "@/components/actions/action-button";
import { ResetExperienceButton } from "@/components/actions/reset-experience-button";
import { AccessibilityIcon } from "@/components/icons";
import { Sheet } from "@/components/overlay/dialog";
import { cn } from "@/lib/cn";
import { useLanguage } from "@/lib/i18n/language-provider";
import type { AccessibilityPreferences } from "./state/kiosk-state";
import { useKioskSession } from "./state/kiosk-session-provider";

/**
 * Session controls in the header, shown only while a visitor session is active: accessibility options
 * and the discreet "Start over" (with confirmation).
 */
export function KioskHeaderActions() {
  const { state, dispatch, reset } = useKioskSession();
  const { t } = useLanguage();
  const [a11yOpen, setA11yOpen] = useState(false);
  const prefs = state.session?.accessibility;
  if (!state.session || !prefs) return null;

  const toggle = (key: keyof AccessibilityPreferences) =>
    dispatch({ type: "SET_ACCESSIBILITY", preferences: { [key]: !prefs[key] } });

  return (
    <>
      <button
        type="button"
        data-testid="accessibility-button"
        onClick={() => setA11yOpen(true)}
        className="focus-ring border-line text-ink-muted text-label active:bg-surface-muted inline-flex min-h-14 min-w-14 items-center justify-center gap-2 rounded-full border px-4 font-semibold sm:px-5"
      >
        <AccessibilityIcon size="size-6" />
        <span className="max-sm:sr-only sm:not-sr-only">{t("accessibility.button")}</span>
      </button>
      {/* Disabled while a submission is completing; a reset is never allowed to interrupt it. */}
      <ResetExperienceButton onReset={() => reset("explicit")} disabled={state.leadFlow === "submitting"} />
      <Sheet
        open={a11yOpen}
        onClose={() => setA11yOpen(false)}
        testId="accessibility-sheet"
        title={t("accessibility.title")}
        description={t("accessibility.description")}
        footer={<PrimaryAction onClick={() => setA11yOpen(false)}>{t("ui.close")}</PrimaryAction>}
      >
        <div className="flex flex-col gap-4">
          {(["largeText", "reduceMotion"] as const).map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={prefs[key]}
              data-testid={`a11y-${key}`}
              onClick={() => toggle(key)}
              className={cn(
                "focus-ring rounded-card min-h-touch flex items-center justify-between gap-4 border-2 px-5 py-4 text-left",
                prefs[key] ? "border-primary bg-primary/5" : "border-line bg-surface",
              )}
            >
              <span className="text-lead text-ink font-semibold">{t(`accessibility.${key}`)}</span>
              <span
                aria-hidden
                className={cn(
                  "text-label rounded-full px-4 py-1 font-semibold",
                  prefs[key] ? "bg-primary text-on-primary" : "bg-surface-muted text-ink-muted",
                )}
              >
                {prefs[key] ? t("accessibility.on") : t("accessibility.off")}
              </span>
            </button>
          ))}
        </div>
      </Sheet>
    </>
  );
}
