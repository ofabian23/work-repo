"use client";

import { useEffect, useRef, useState } from "react";
import type { Language } from "@/domain/content/primitives";
import { appConfig } from "@/lib/config/app-config";
import { brandConfig } from "@/lib/config/brand-config";
import { cn } from "@/lib/cn";
import { useLanguage } from "@/lib/i18n/language-provider";
import { translate } from "@/lib/i18n/translate";
import type { MessageKey } from "@/types/i18n";

const PHRASES: MessageKey[] = [
  "attract.phrases.explore",
  "attract.phrases.discover",
  "attract.phrases.recommend",
];

/**
 * Attract loop (first stage of the journey). Readable in a glance: product name, one short rotating
 * value phrase, a bilingual "touch to begin" and a calm animated illustration. The whole screen is a
 * single large button. It always starts from its initial visual state (it remounts on every reset) and
 * returns to Spanish if a passer-by changed the language and walked away.
 */
export function AttractScreen({
  onStart,
  rotationMs = appConfig.kiosk.attractRotationMs,
  revertMs = appConfig.kiosk.idle.attractRevertMs,
}: {
  onStart: () => void;
  rotationMs?: number;
  revertMs?: number;
}) {
  const { t, language, setLanguage } = useLanguage();
  const [phraseIndex, setPhraseIndex] = useState(0);
  // Incremented to restart the rotation from a clean cycle (e.g. after reverting the language). The ref
  // changes synchronously so a tick from the previous interval, fired before React commits, is ignored.
  const [cycle, setCycle] = useState(0);
  const cycleRef = useRef(0);

  useEffect(() => {
    const owner = cycleRef.current;
    const timer = setInterval(() => {
      if (cycleRef.current === owner) setPhraseIndex((i) => (i + 1) % PHRASES.length);
    }, rotationMs);
    return () => clearInterval(timer);
  }, [rotationMs, cycle]);

  // Revert a changed language (and the phrase loop) to the initial state after idling on this screen.
  useEffect(() => {
    if (language === appConfig.defaultLanguage) return;
    let timer = setTimeout(revert, revertMs);
    function revert() {
      cycleRef.current += 1;
      setLanguage(appConfig.defaultLanguage);
      setPhraseIndex(0);
      setCycle((c) => c + 1);
    }
    const restart = () => {
      clearTimeout(timer);
      timer = setTimeout(revert, revertMs);
    };
    window.addEventListener("pointerdown", restart, { capture: true });
    return () => {
      clearTimeout(timer);
      window.removeEventListener("pointerdown", restart, { capture: true });
    };
  }, [language, revertMs, setLanguage]);

  const otherLanguage: Language = language === "es" ? "en" : "es";

  return (
    <section
      data-testid="attract-screen"
      data-phrase={phraseIndex}
      className="relative flex flex-1 flex-col overflow-x-clip"
    >
      <div className="px-gutter flex flex-1 flex-col items-center justify-center gap-[clamp(1.5rem,4vh,4rem)] py-10 text-center">
        <AttractIllustration />
        <h1 className="text-display text-ink font-bold tracking-tight">{brandConfig.productName}</h1>
        <p
          key={`${language}-${phraseIndex}`}
          data-testid="attract-phrase"
          className="text-headline text-primary motion-safe:animate-phrase-in min-h-[2.3em] max-w-4xl font-semibold text-balance"
        >
          {t(PHRASES[phraseIndex]!)}
        </p>
        <div aria-hidden className="flex gap-3">
          {PHRASES.map((key, i) => (
            <span
              key={key}
              className={cn(
                "ease-standard h-2.5 rounded-full transition-all duration-(--duration-slow)",
                i === phraseIndex ? "bg-primary w-10" : "bg-line w-2.5",
              )}
            />
          ))}
        </div>
        <span aria-hidden className="relative mt-2 inline-flex">
          <span className="bg-primary motion-safe:animate-pulse-ring absolute inset-0 rounded-full" />
          <span className="bg-primary text-on-primary shadow-raised min-h-touch-lg relative flex flex-col items-center justify-center rounded-full px-12 py-3">
            <span className="text-title font-bold">{t("attract.touchToBegin")}</span>
            <span lang={otherLanguage} className="text-label opacity-90">
              {translate(otherLanguage, "attract.touchToBegin")}
            </span>
          </span>
        </span>
      </div>
      {/* One full-area target: touch anywhere (or press Enter) to begin. */}
      <button
        type="button"
        data-testid="attract-start"
        aria-label={t("attract.startLabel")}
        onClick={onStart}
        className="focus-ring absolute inset-0 z-10 cursor-pointer rounded-none focus-visible:outline-offset-[-8px]"
      />
    </section>
  );
}

/** Original isometric hospital illustration with gently pulsing points of interest (decorative). */
function AttractIllustration() {
  const markers = [
    { left: "30%", top: "38%" },
    { left: "62%", top: "30%" },
    { left: "74%", top: "62%" },
  ];
  return (
    <div aria-hidden className="motion-safe:animate-float relative w-[min(78vw,34rem,40vh)]">
      <svg viewBox="0 0 400 300" className="h-auto w-full">
        {/* ground */}
        <path
          d="M200 270 L380 180 L200 90 L20 180 Z"
          fill="var(--brand-surface-muted)"
          stroke="var(--brand-border)"
          strokeWidth="2"
        />
        {/* main building */}
        <path d="M120 170 L200 210 L200 110 L120 70 Z" fill="var(--brand-primary)" opacity="0.85" />
        <path d="M200 210 L280 170 L280 70 L200 110 Z" fill="var(--brand-primary)" opacity="0.65" />
        <path d="M120 70 L200 30 L280 70 L200 110 Z" fill="var(--brand-primary)" opacity="0.45" />
        {/* cross on the roof */}
        <g transform="translate(200 70) scale(1 0.5) rotate(45)" fill="var(--brand-surface)">
          <rect x="-7" y="-20" width="14" height="40" rx="2" />
          <rect x="-20" y="-7" width="40" height="14" rx="2" />
        </g>
        {/* side wing */}
        <path d="M250 205 L300 230 L300 175 L250 150 Z" fill="var(--brand-accent)" opacity="0.8" />
        <path d="M300 230 L350 205 L350 150 L300 175 Z" fill="var(--brand-accent)" opacity="0.6" />
        <path d="M250 150 L300 125 L350 150 L300 175 Z" fill="var(--brand-accent)" opacity="0.4" />
        {/* small building */}
        <path d="M60 200 L100 220 L100 185 L60 165 Z" fill="var(--brand-text-muted)" opacity="0.5" />
        <path d="M100 220 L140 200 L140 165 L100 185 Z" fill="var(--brand-text-muted)" opacity="0.35" />
        <path d="M60 165 L100 145 L140 165 L100 185 Z" fill="var(--brand-text-muted)" opacity="0.25" />
        {/* windows */}
        {[0, 1, 2].map((row) =>
          [0, 1, 2].map((col) => (
            <path
              key={`${row}-${col}`}
              d={`M${138 + col * 20} ${118 + row * 24 + col * 10} l12 6 v12 l-12 -6 z`}
              fill="var(--brand-surface)"
              opacity="0.7"
            />
          )),
        )}
      </svg>
      {markers.map((m) => (
        <span
          key={`${m.left}-${m.top}`}
          className="absolute size-7 -translate-x-1/2 -translate-y-1/2"
          style={m}
        >
          <span className="bg-surface motion-safe:animate-pulse-ring absolute inset-0 rounded-full" />
          <span className="border-surface bg-accent relative block size-full rounded-full border-4" />
        </span>
      ))}
    </div>
  );
}
