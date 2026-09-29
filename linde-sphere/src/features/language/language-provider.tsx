"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Language, LocalizedText } from "@/domain/content/primitives";
import { appConfig } from "@/lib/config/app-config";
import { localize as localizeText, translate } from "@/lib/i18n/translate";
import type { MessageKey, MessageParams } from "@/types/i18n";

type LanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  /** UI string lookup, e.g. `t("status.retry")`. */
  t: (key: MessageKey, params?: MessageParams) => string;
  /** Picks the current language from a content `{ es, en }` field. */
  localize: (text: LocalizedText) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

/**
 * Holds the visitor's language in memory only. It is never persisted (no cookies or storage), so every
 * new session and every kiosk reset starts in Spanish (ADR-004, ADR-014).
 */
export function LanguageProvider({
  children,
  initialLanguage = appConfig.defaultLanguage,
}: {
  children: ReactNode;
  initialLanguage?: Language;
}) {
  const [language, setLanguageState] = useState<Language>(initialLanguage);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = useCallback((next: Language) => setLanguageState(next), []);

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      setLanguage,
      t: (key, params) => translate(language, key, params),
      localize: (text) => localizeText(text, language),
    }),
    [language, setLanguage],
  );

  return <LanguageContext value={value}>{children}</LanguageContext>;
}

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used inside <LanguageProvider>");
  return context;
}
