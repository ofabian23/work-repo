import type { Language, LocalizedText } from "@/domain/content/primitives";
import { en } from "@/data/i18n/en";
import { es } from "@/data/i18n/es";
import type { MessageKey, MessageParams, Messages } from "@/types/i18n";

/** Lightweight i18n: typed dictionaries + a pure lookup function. No i18n framework (ADR-014). */
export const dictionaries: Record<Language, Messages> = { es, en };

function lookup(messages: Messages, key: string): string | undefined {
  let node: unknown = messages;
  for (const part of key.split(".")) {
    if (node === null || typeof node !== "object") return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === "string" ? node : undefined;
}

/** Replaces `{name}` placeholders; unknown placeholders are left visible to make gaps obvious. */
export function interpolate(template: string, params?: MessageParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

/** Looks up a UI string; falls back to Spanish, then to the key itself (never throws in the UI). */
export function translate(language: Language, key: MessageKey, params?: MessageParams): string {
  const value = lookup(dictionaries[language], key) ?? lookup(dictionaries.es, key) ?? key;
  return interpolate(value, params);
}

/** Picks the visitor's language from a content `{ es, en }` field. */
export function localize(text: LocalizedText, language: Language): string {
  return text[language];
}
