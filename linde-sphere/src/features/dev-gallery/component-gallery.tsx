"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { PrimaryAction, SecondaryAction } from "@/components/actions/action-button";
import { BottomActionBar } from "@/components/actions/bottom-action-bar";
import { ResetExperienceButton } from "@/components/actions/reset-experience-button";
import { ChallengeCard } from "@/components/cards/challenge-card";
import { PersonaCard } from "@/components/cards/persona-card";
import { RecommendationCard } from "@/components/cards/recommendation-card";
import { TouchCard } from "@/components/cards/touch-card";
import { SolutionPanel } from "@/components/content/solution-panel";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { StatusBanner } from "@/components/feedback/status-banner";
import { ConsentCheckbox } from "@/components/forms/consent-checkbox";
import { FormField } from "@/components/forms/form-field";
import { ArrowRightIcon, SparkIcon } from "@/components/icons";
import { HotspotButton } from "@/components/explorer/hotspot-button";
import { ProgressIndicator } from "@/components/navigation/progress-indicator";
import { SceneBreadcrumb } from "@/components/navigation/scene-breadcrumb";
import { InactivityWarning } from "@/components/overlay/inactivity-warning";
import { Modal, Sheet } from "@/components/overlay/dialog";
import { KioskHeader } from "@/components/shell/kiosk-header";
import { LanguageToggle } from "@/components/shell/language-toggle";
import type { PublicContentBundle } from "@/domain/content/visibility";
import type { Hotspot } from "@/domain/content/scene";
import { recommend } from "@/domain/recommendations/engine";
import { EMPTY_SIGNALS } from "@/domain/session/session-log";
import { appConfig } from "@/lib/config/app-config";
import { useLanguage } from "@/lib/i18n/language-provider";
import { useHydrated } from "@/lib/use-hydrated";

/**
 * Development-only gallery of the touchscreen design system (ADR-045). Uses real seed content so
 * components are reviewed with realistic text lengths in both languages. Headings are English on purpose:
 * this page is for the team, never for visitors.
 */
export function ComponentGallery({ content }: { content: PublicContentBundle }) {
  const { localize, t } = useLanguage();

  const [personaId, setPersonaId] = useState<string | null>("procurement-supply");
  const [challengeIds, setChallengeIds] = useState<string[]>(["supply-continuity"]);
  const [visited, setVisited] = useState<string[]>([]);
  const [interests, setInterests] = useState<string[]>([]);
  const [openHotspot, setOpenHotspot] = useState<Hotspot | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [inactivityOpen, setInactivityOpen] = useState(false);
  const [seconds, setSeconds] = useState(15);
  const [consentReport, setConsentReport] = useState(false);
  const [consentFollowUp, setConsentFollowUp] = useState(false);
  const [email, setEmail] = useState("correo@");
  const [resetCount, setResetCount] = useState(0);
  // The page sits inside a Suspense boundary (root loading.tsx) that hydrates separately from the layout,
  // so the gallery flags its own readiness for tests.
  const ready = useHydrated();

  useEffect(() => {
    if (!inactivityOpen) return;
    const timer = setInterval(() => setSeconds((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(timer);
  }, [inactivityOpen]);

  const scene = content.scenes.find((s) => s.id === "gas-plant") ?? content.scenes[0];
  const sceneTitles = new Map(content.scenes.map((s) => [s.id, s.title]));
  const solutions = new Map(content.solutions.map((s) => [s.id, s]));
  const max = appConfig.recommendations.maxSelectedChallenges;

  const result = useMemo(
    () =>
      recommend(
        {
          ...EMPTY_SIGNALS,
          personaId,
          challengeIds,
          visitedSceneIds: scene ? [scene.id] : [],
          openedHotspotIds: visited,
          explicitInterestIds: interests,
        },
        content,
      ),
    [content, personaId, challengeIds, visited, interests, scene],
  );

  const toggleChallenge = (id: string) =>
    setChallengeIds((ids) =>
      ids.includes(id) ? ids.filter((c) => c !== id) : ids.length < max ? [...ids, id] : ids,
    );

  return (
    <div
      className="px-gutter flex flex-col gap-16 py-12"
      data-testid="component-gallery"
      data-ready={ready || undefined}
    >
      <header className="flex flex-col gap-3">
        <p className="text-label text-accent font-semibold tracking-wide uppercase">Development only</p>
        <h1 className="text-headline font-bold">Design system gallery</h1>
        <p className="text-body text-ink-muted">
          Every component with real seed content. Switch the language in the header to check both languages.
          Tab through the page to review focus states.
        </p>
      </header>

      <Section title="Tokens" id="tokens">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            "canvas",
            "surface",
            "surface-muted",
            "ink",
            "ink-muted",
            "primary",
            "accent",
            "line",
            "focus",
            "info",
            "success",
            "notice",
            "danger",
          ].map((name) => (
            <div key={name} className="rounded-control border-line flex items-center gap-3 border p-3">
              <span
                className="border-line size-10 shrink-0 rounded-lg border"
                style={{ background: `var(--brand-${BRAND_VAR[name] ?? name})` }}
              />
              <span className="text-caption font-mono">{name}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-display font-bold">Display</p>
          <p className="text-headline font-bold">Headline</p>
          <p className="text-title font-bold">Title</p>
          <p className="text-lead">Lead text for supporting statements</p>
          <p className="text-body">Body text readable from several feet away on the kiosk.</p>
          <p className="text-label font-semibold">Label</p>
          <p className="text-caption">Caption — the smallest size in the system</p>
        </div>
        <div className="flex flex-wrap items-end gap-4">
          {["touch-min", "touch", "touch-lg"].map((size) => (
            <div key={size} className="flex flex-col items-center gap-2">
              <span
                className="bg-primary/15 border-primary rounded-control block border-2"
                style={{ width: `var(--spacing-${size})`, height: `var(--spacing-${size})` }}
              />
              <span className="text-caption font-mono">{size}</span>
            </div>
          ))}
          {["card", "raised"].map((shadow) => (
            <div
              key={shadow}
              className="bg-surface rounded-card flex size-24 items-center justify-center"
              style={{ boxShadow: `var(--shadow-${shadow})` }}
            >
              <span className="text-caption font-mono">{shadow}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="KioskHeader · LanguageToggle · ResetExperienceButton · AppShell" id="shell">
        <p className="text-body text-ink-muted">
          This page itself is rendered inside AppShell (header, main, footer).
        </p>
        <div className="rounded-card border-line overflow-hidden border">
          <KioskHeader actions={<ResetExperienceButton onReset={() => setResetCount((n) => n + 1)} />} />
        </div>
        <p className="text-caption text-ink-muted" data-testid="reset-count">
          Resets confirmed: {resetCount}
        </p>
        <LanguageToggle className="items-start" />
      </Section>

      <Section title="PrimaryAction · SecondaryAction" id="actions">
        <div className="flex flex-wrap items-center gap-4">
          <PrimaryAction size="xl" icon={<ArrowRightIcon />}>
            {t("inactivity.continue")}
          </PrimaryAction>
          <PrimaryAction>{t("status.retry")}</PrimaryAction>
          <SecondaryAction>{t("status.backHome")}</SecondaryAction>
          <SecondaryAction size="md">{t("ui.close")}</SecondaryAction>
          <PrimaryAction disabled>{t("reset.confirm")}</PrimaryAction>
        </div>
      </Section>

      <Section title="TouchCard · PersonaCard · ChallengeCard" id="cards">
        <TouchCard
          title={localize(content.challenges[0]!.label)}
          description="Static TouchCard (no onSelect)"
          icon={<SparkIcon size="size-9" />}
        />
        <div className="grid gap-4" role="group" aria-label="Personas">
          {content.personas.slice(0, 3).map((p) => (
            <PersonaCard
              key={p.id}
              persona={p}
              selected={personaId === p.id}
              onSelect={(id) => setPersonaId((cur) => (cur === id ? null : id))}
            />
          ))}
        </div>
        <div className="grid gap-4" role="group" aria-label="Challenges">
          {content.challenges.slice(0, 5).map((c) => (
            <ChallengeCard
              key={c.id}
              challenge={c}
              selected={challengeIds.includes(c.id)}
              limitReached={challengeIds.length >= max}
              maxSelections={max}
              onToggle={toggleChallenge}
            />
          ))}
        </div>
      </Section>

      <Section title="ProgressIndicator · SceneBreadcrumb" id="navigation">
        <ProgressIndicator current={2} total={4} steps={["Área", "Retos", "Explorar", "Informe"]} />
        {scene && (
          <SceneBreadcrumb
            items={scene.breadcrumb.map((id) => ({
              id,
              label: localize(sceneTitles.get(id) ?? { es: id, en: id }),
            }))}
            onNavigate={() => undefined}
          />
        )}
      </Section>

      {scene && (
        <Section title="HotspotButton · Sheet · SolutionPanel" id="explorer">
          <p className="text-body text-ink-muted">
            Placeholder art box (4:5). Activate a hotspot to open its sheet; visited hotspots stop pulsing.
          </p>
          <div
            className="bg-surface-muted border-line rounded-card relative aspect-[4/5] w-full border"
            data-testid="scene-box"
          >
            {scene.hotspots.map((h) => (
              <HotspotButton
                key={h.id}
                testId={`hotspot-${h.id}`}
                x={h.x}
                y={h.y}
                type={h.type}
                label={localize(h.label)}
                accessibleLabel={localize(h.accessibleLabel)}
                importance={h.visualImportance}
                visited={visited.includes(h.id)}
                onActivate={() => {
                  setVisited((v) => (v.includes(h.id) ? v : [...v, h.id]));
                  setOpenHotspot(h);
                }}
              />
            ))}
          </div>
          <Sheet
            open={openHotspot !== null}
            onClose={() => setOpenHotspot(null)}
            testId="hotspot-sheet"
            title={openHotspot ? localize(openHotspot.label) : ""}
            footer={
              <PrimaryAction onClick={() => setOpenHotspot(null)}>{t("inactivity.continue")}</PrimaryAction>
            }
          >
            {openHotspot?.type === "solution" && (
              <SolutionPanel
                solutions={openHotspot.targetSolutionIds.flatMap((id) => {
                  const s = solutions.get(id);
                  return s
                    ? [
                        {
                          id,
                          title: localize(s.title),
                          summary: localize(s.summary),
                          nextStep: localize(s.nextStep),
                          pendingValidation: s.validationStatus !== "validated",
                        },
                      ]
                    : [];
                })}
                interestIds={interests}
                onToggleInterest={(id) =>
                  setInterests((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]))
                }
              />
            )}
            {openHotspot?.type === "information" && (
              <p className="text-body">{localize(openHotspot.panel.body)}</p>
            )}
            {openHotspot?.type === "navigation" && (
              <p className="text-body">{localize(openHotspot.accessibleLabel)}</p>
            )}
          </Sheet>
        </Section>
      )}

      <Section title="RecommendationCard (live engine output)" id="recommendations">
        {result ? (
          result.items.map((item) => {
            const s = solutions.get(item.solutionId);
            return (
              <RecommendationCard
                key={item.solutionId}
                testId={`recommendation-${item.solutionId}`}
                rank={item.rank}
                title={s ? localize(s.title) : item.solutionId}
                summary={s ? localize(s.summary) : ""}
                whyThisAppeared={localize(item.whyThisAppeared)}
                relevance={localize(item.relevance)}
                nextStep={localize(item.nextStep)}
                relatedAreas={item.relatedSceneIds.map((id) =>
                  localize(sceneTitles.get(id) ?? { es: id, en: id }),
                )}
                pendingValidation={item.pendingValidation}
              />
            );
          })
        ) : (
          <EmptyState />
        )}
      </Section>

      <Section title="Modal · InactivityWarning" id="overlays">
        <div className="flex flex-wrap gap-4">
          <SecondaryAction onClick={() => setModalOpen(true)} data-testid="open-modal">
            Open Modal
          </SecondaryAction>
          <SecondaryAction
            data-testid="open-inactivity"
            onClick={() => {
              setSeconds(15);
              setInactivityOpen(true);
            }}
          >
            Open InactivityWarning
          </SecondaryAction>
        </div>
        <Modal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          testId="demo-modal"
          title={t("reset.confirmTitle")}
          description={t("reset.confirmBody")}
          footer={<PrimaryAction onClick={() => setModalOpen(false)}>{t("ui.close")}</PrimaryAction>}
        />
        <InactivityWarning
          open={inactivityOpen}
          secondsRemaining={seconds}
          onContinue={() => setInactivityOpen(false)}
          onReset={() => setInactivityOpen(false)}
        />
      </Section>

      <Section title="FormField · ConsentCheckbox" id="forms">
        <FormField label="Nombre / First name" required placeholder="" />
        <FormField label="Teléfono / Phone" type="tel" hint="Solo si desea que le llamemos." />
        <FormField
          label="Correo electrónico / Business email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error="Ingrese un correo electrónico válido."
        />
        <ConsentCheckbox
          label={localize(content.consent.reportDelivery)}
          checked={consentReport}
          onChange={setConsentReport}
          required
          testId="consent-report"
        />
        <ConsentCheckbox
          label={localize(content.consent.salesFollowUp)}
          checked={consentFollowUp}
          onChange={setConsentFollowUp}
        />
        <ConsentCheckbox
          label="Estado con error / Error state"
          checked={false}
          onChange={() => undefined}
          required
          error="Este consentimiento es necesario para enviar su informe."
        />
      </Section>

      <Section title="StatusBanner" id="banners">
        <StatusBanner tone="info" title="Información">
          Su informe se enviará a su correo electrónico.
        </StatusBanner>
        <StatusBanner tone="success" title="Solicitud registrada">
          Gracias. Hemos registrado su solicitud.
        </StatusBanner>
        <StatusBanner tone="warning" title={t("ui.pendingValidation")}>
          Contenido de demostración.
        </StatusBanner>
        <StatusBanner tone="error" title="No pudimos guardar">
          Intente de nuevo en unos segundos.
        </StatusBanner>
      </Section>

      <Section title="LoadingState · EmptyState · ErrorState" id="states">
        <div className="rounded-card border-line border">
          <LoadingState headingLevel={3} />
        </div>
        <div className="rounded-card border-line border">
          <EmptyState headingLevel={3} body="Seleccione un reto para ver recomendaciones." />
        </div>
        <div className="rounded-card border-line border">
          <ErrorState
            headingLevel={3}
            digest="demo-1234"
            onRetry={() => undefined}
            onHome={() => undefined}
          />
        </div>
      </Section>

      <BottomActionBar label={t("ui.actions")} className="-mx-gutter">
        <SecondaryAction>{t("status.backHome")}</SecondaryAction>
        <PrimaryAction icon={<ArrowRightIcon />}>{t("inactivity.continue")}</PrimaryAction>
      </BottomActionBar>
    </div>
  );
}

/** Token name → brand CSS variable (color tokens are inlined by Tailwind, brand variables always exist). */
const BRAND_VAR: Record<string, string> = {
  canvas: "background",
  ink: "text",
  "ink-muted": "text-muted",
  line: "border",
};

function Section({ title, id, children }: { title: string; id: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`${id}-heading`} className="flex flex-col gap-6" data-testid={`gallery-${id}`}>
      <h2 id={`${id}-heading`} className="text-title border-line border-b pb-3 font-bold">
        {title}
      </h2>
      {children}
    </section>
  );
}
