"use client";

import { ChevronRightIcon } from "@/components/icons";
import { useLanguage } from "@/lib/i18n/language-provider";

export type BreadcrumbItem = { id: string; label: string };

/** Where the visitor is in the hospital explorer. Ancestors are large buttons; the current scene is text. */
export function SceneBreadcrumb({
  items,
  onNavigate,
}: {
  items: BreadcrumbItem[];
  onNavigate: (sceneId: string) => void;
}) {
  const { t } = useLanguage();
  return (
    <nav aria-label={t("ui.breadcrumbLabel")} data-testid="scene-breadcrumb">
      <ol className="flex flex-wrap items-center gap-2">
        {items.map((item, i) => {
          const isCurrent = i === items.length - 1;
          return (
            <li key={item.id} className="flex items-center gap-2">
              {isCurrent ? (
                <span aria-current="page" className="text-lead text-ink px-2 font-bold">
                  {item.label}
                </span>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => onNavigate(item.id)}
                    className="focus-ring bg-surface-muted border-line text-label text-primary active:bg-line min-h-touch-min rounded-full border px-5 font-semibold"
                  >
                    {item.label}
                  </button>
                  <ChevronRightIcon aria-hidden className="text-ink-muted" size="size-6" />
                </>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
