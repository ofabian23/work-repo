"use client";

import type { ReactNode } from "react";
import { useLanguage } from "@/features/language/language-provider";
import { brandConfig } from "@/lib/config/brand-config";
import type { MessageKey } from "@/types/i18n";

/**
 * Foundation home screen. It introduces the product and previews the three entry paths (informational
 * only). The interactive Attract → Entry flow replaces this screen in Phase 4.
 */
export function HomeScreen() {
  const { t, localize } = useLanguage();

  const paths: { key: "role" | "challenge" | "explore"; icon: ReactNode }[] = [
    { key: "role", icon: <RoleIcon /> },
    { key: "challenge", icon: <ChallengeIcon /> },
    { key: "explore", icon: <ExploreIcon /> },
  ];

  return (
    <section
      data-testid="home-screen"
      className="flex flex-1 flex-col justify-center gap-[clamp(1.5rem,3.2vh,4rem)] px-[7%] py-[clamp(2rem,4vh,6rem)]"
    >
      <HeroGraphic />

      <div className="flex flex-col gap-4">
        <p className="text-accent text-lg font-semibold tracking-wide uppercase">{t("home.eyebrow")}</p>
        <h1 className="text-ink text-[clamp(2.25rem,8vmin,5.5rem)] leading-[1.05] font-bold tracking-tight">
          {brandConfig.productName}
        </h1>
        <p className="text-ink text-[clamp(1.35rem,3vmin,2.1rem)] leading-snug font-medium text-balance">
          {localize(brandConfig.tagline)}
        </p>
        <p className="text-ink-muted max-w-3xl text-xl leading-relaxed text-pretty">{t("home.intro")}</p>
      </div>

      <div className="flex flex-col gap-4">
        <h2 className="text-ink-muted text-lg font-semibold">{t("home.pathsHeading")}</h2>
        <ul className="grid gap-4">
          {paths.map(({ key, icon }) => (
            <li
              key={key}
              className="border-line bg-surface-muted flex items-center gap-5 rounded-3xl border p-5"
            >
              <span className="bg-primary/10 text-primary flex size-16 shrink-0 items-center justify-center rounded-2xl">
                {icon}
              </span>
              <span className="flex flex-col gap-1">
                <span className="text-ink text-2xl font-semibold">
                  {t(`home.paths.${key}.title` as MessageKey)}
                </span>
                <span className="text-ink-muted text-lg">
                  {t(`home.paths.${key}.description` as MessageKey)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <p
        role="status"
        className="border-line text-ink-muted self-start rounded-full border px-5 py-2 text-base font-medium"
      >
        {t("home.status")}
      </p>
    </section>
  );
}

/** Original abstract "sphere" illustration (decorative, not a brand mark). */
function HeroGraphic() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 320 200"
      className="text-primary h-[clamp(7rem,min(26vmin,18vh),22rem)] w-auto self-start"
    >
      <defs>
        <radialGradient id="sphere-fill" cx="38%" cy="35%" r="70%">
          <stop offset="0%" stopColor="var(--brand-surface)" />
          <stop offset="100%" stopColor="var(--brand-primary)" stopOpacity="0.22" />
        </radialGradient>
      </defs>
      <circle cx="110" cy="100" r="84" fill="url(#sphere-fill)" stroke="currentColor" strokeWidth="3" />
      <ellipse
        cx="110"
        cy="100"
        rx="84"
        ry="30"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.45"
        strokeWidth="2"
      />
      <ellipse
        cx="110"
        cy="100"
        rx="32"
        ry="84"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.45"
        strokeWidth="2"
      />
      <circle cx="232" cy="62" r="18" fill="var(--brand-accent)" fillOpacity="0.85" />
      <circle cx="270" cy="128" r="11" fill="var(--brand-accent)" fillOpacity="0.5" />
      <circle cx="214" cy="150" r="7" fill="currentColor" fillOpacity="0.35" />
    </svg>
  );
}

const iconProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  className: "size-9",
  "aria-hidden": true,
};

function RoleIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5" />
    </svg>
  );
}

function ChallengeIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="0.8" fill="currentColor" />
    </svg>
  );
}

function ExploreIcon() {
  return (
    <svg {...iconProps}>
      <path d="M4 20V9l8-5 8 5v11" />
      <path d="M9 20v-5h6v5" />
      <path d="M12 7.5v3M10.5 9h3" />
    </svg>
  );
}
