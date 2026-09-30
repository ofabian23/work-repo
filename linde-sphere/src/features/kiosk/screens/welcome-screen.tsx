"use client";

import { useState, type ReactNode } from "react";
import { ActionCard } from "@/components/cards/action-card";
import { ClockIcon, HospitalIcon, PersonIcon, ShieldIcon, SparkIcon, TargetIcon } from "@/components/icons";
import type { LocalizedText } from "@/domain/content/primitives";
import type { EntryPath } from "@/domain/session/visitor-session";
import { useLanguage } from "@/lib/i18n/language-provider";
import { PrivacySheet } from "../privacy-sheet";
import { useScreenHeading } from "./use-screen-heading";

const PATHS: { path: EntryPath; icon: ReactNode }[] = [
  { path: "role", icon: <PersonIcon size="size-10" /> },
  { path: "challenge", icon: <TargetIcon size="size-10" /> },
  { path: "explore", icon: <HospitalIcon size="size-10" /> },
];

/**
 * Welcome: three primary entry paths, a clear promise of personalized recommendations and a discreet
 * privacy link. Never asks for contact information.
 */
export function WelcomeScreen({
  onChoosePath,
  privacyNotice,
  paths = PATHS.map((p) => p.path),
}: {
  onChoosePath: (path: EntryPath) => void;
  privacyNotice: LocalizedText | null;
  /** Paths with content to show (availablePaths); none renders a neutral "being prepared" message. */
  paths?: EntryPath[];
}) {
  const { t } = useLanguage();
  const heading = useScreenHeading();
  const [privacyOpen, setPrivacyOpen] = useState(false);

  const promises = [
    { key: "personalized", icon: <SparkIcon size="size-6" /> },
    { key: "duration", icon: <ClockIcon size="size-6" /> },
    { key: "noContact", icon: <ShieldIcon size="size-6" /> },
  ] as const;

  return (
    <section
      data-testid="welcome-screen"
      className="px-gutter flex flex-1 flex-col gap-[clamp(1.5rem,3.5vh,3.5rem)] py-[clamp(2rem,4vh,5rem)]"
    >
      <header className="flex flex-col gap-4">
        <h1
          ref={heading}
          tabIndex={-1}
          className="text-headline text-ink font-bold tracking-tight outline-none"
        >
          {paths.length > 0 ? t("welcome.title") : t("welcome.unavailable.title")}
        </h1>
        {paths.length === 0 ? (
          <p className="text-lead text-ink-muted max-w-3xl text-pretty" data-testid="welcome-unavailable">
            {t("welcome.unavailable.body")}
          </p>
        ) : (
          <p className="text-lead text-ink-muted max-w-3xl text-pretty">{t("welcome.subtitle")}</p>
        )}
        {paths.length > 0 && (
          <ul className="flex flex-wrap gap-3" data-testid="welcome-promises">
            {promises.map(({ key, icon }) => (
              <li
                key={key}
                className="bg-info-surface text-info text-label inline-flex items-center gap-2 rounded-full px-4 py-2 font-semibold"
              >
                {icon}
                {t(`welcome.promises.${key}`)}
              </li>
            ))}
          </ul>
        )}
      </header>

      {paths.length > 0 && (
        <nav aria-label={t("welcome.pathsLabel")}>
          <ul className="flex flex-col gap-5">
            {PATHS.filter(({ path }) => paths.includes(path)).map(({ path, icon }) => (
              <li key={path}>
                <ActionCard
                  testId={`path-${path}`}
                  icon={icon}
                  title={t(`welcome.paths.${path}.title`)}
                  description={t(`welcome.paths.${path}.description`)}
                  onActivate={() => onChoosePath(path)}
                />
              </li>
            ))}
          </ul>
        </nav>
      )}

      <div className="mt-auto flex justify-start">
        <button
          type="button"
          data-testid="privacy-link"
          onClick={() => setPrivacyOpen(true)}
          className="focus-ring text-ink-muted text-label min-h-touch-min inline-flex items-center gap-2 rounded-full px-2 underline underline-offset-4"
        >
          <ShieldIcon size="size-5" />
          {t("welcome.privacyLink")}
        </button>
      </div>
      <PrivacySheet open={privacyOpen} onClose={() => setPrivacyOpen(false)} privacyNotice={privacyNotice} />
    </section>
  );
}
