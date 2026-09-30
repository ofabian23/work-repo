"use client";

import type { Language } from "@/domain/content/primitives";
import { appConfig } from "@/lib/config/app-config";
import { cn } from "@/lib/cn";
import { useLanguage } from "@/lib/i18n/language-provider";

/** Two large toggle buttons (ES / EN), each labeled in its own language. No hover dependency. */
export function LanguageToggle({ className }: { className?: string }) {
  const { language, setLanguage, t } = useLanguage();

  return (
    <div className={cn("flex flex-col items-end", className)}>
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
                "focus-ring text-label min-h-14 min-w-[6.5rem] rounded-full px-5 font-semibold",
                "ease-standard transition-colors duration-(--duration-fast)",
                active ? "bg-primary text-on-primary shadow-card" : "text-ink-muted active:bg-line/60",
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
