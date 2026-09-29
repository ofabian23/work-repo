"use client";

import type { Language } from "@/domain/content/primitives";
import { appConfig } from "@/lib/config/app-config";
import { cn } from "@/lib/cn";
import { useLanguage } from "./language-provider";

/** Large two-option segmented control (no hover dependency, ≥ 56 px targets). */
export function LanguageSwitcher({ className }: { className?: string }) {
  const { language, setLanguage, t } = useLanguage();

  return (
    <div className={cn("flex flex-col items-end gap-1", className)}>
      <div
        role="group"
        aria-label={t("language.switcherLabel")}
        className="border-line bg-surface-muted inline-flex rounded-full border p-1"
      >
        {appConfig.supportedLanguages.map((option: Language) => {
          const active = option === language;
          return (
            <button
              key={option}
              type="button"
              lang={option}
              aria-pressed={active}
              onClick={() => setLanguage(option)}
              data-testid={`language-${option}`}
              className={cn(
                "min-h-14 min-w-[6.5rem] rounded-full px-5 text-lg font-semibold transition-colors",
                "focus-visible:outline-focus focus-visible:outline-4 focus-visible:outline-offset-2",
                active
                  ? "bg-primary text-on-primary shadow-sm"
                  : "text-ink-muted active:bg-line/60 bg-transparent",
              )}
            >
              {t(`language.${option}`)}
            </button>
          );
        })}
      </div>
      <p aria-live="polite" className="sr-only">
        {t("language.changedAnnouncement")}
      </p>
    </div>
  );
}
