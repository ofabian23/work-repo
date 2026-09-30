"use client";

import { PrimaryAction } from "@/components/actions/action-button";
import { CheckIcon } from "@/components/icons";
import { Sheet } from "@/components/overlay/dialog";
import type { LocalizedText } from "@/domain/content/primitives";
import { useLanguage } from "@/lib/i18n/language-provider";
import type { MessageKey } from "@/types/i18n";

const POINTS: MessageKey[] = [
  "privacy.points.noContact",
  "privacy.points.purpose",
  "privacy.points.consent",
  "privacy.points.reset",
];

/**
 * Plain-language privacy summary plus the configurable privacy notice from content (legal-owned text,
 * pending approval — CONTENT_VALIDATION.md §9.4).
 */
export function PrivacySheet({
  open,
  onClose,
  privacyNotice,
}: {
  open: boolean;
  onClose: () => void;
  privacyNotice: LocalizedText;
}) {
  const { t, localize } = useLanguage();
  return (
    <Sheet
      open={open}
      onClose={onClose}
      testId="privacy-sheet"
      title={t("privacy.title")}
      footer={<PrimaryAction onClick={onClose}>{t("ui.close")}</PrimaryAction>}
    >
      <ul className="flex flex-col gap-4">
        {POINTS.map((key) => (
          <li key={key} className="text-body text-ink flex gap-3">
            <CheckIcon className="text-success mt-1" />
            {t(key)}
          </li>
        ))}
      </ul>
      <h3 className="text-label text-ink-muted mt-8 font-semibold">{t("privacy.noticeHeading")}</h3>
      <p className="text-body text-ink-muted mt-2">{localize(privacyNotice)}</p>
    </Sheet>
  );
}
