import { render, type RenderOptions } from "@testing-library/react";
import type { ReactElement } from "react";
import type { Language } from "@/domain/content/primitives";
import { LanguageProvider } from "@/lib/i18n/language-provider";

/** Renders inside the LanguageProvider (components use localized chrome labels). */
export function renderUi(
  ui: ReactElement,
  { language = "es", ...options }: RenderOptions & { language?: Language } = {},
) {
  return render(<LanguageProvider initialLanguage={language}>{ui}</LanguageProvider>, options);
}
