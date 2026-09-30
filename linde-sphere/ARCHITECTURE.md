# Linde Sphere — Architecture

> **Status:** Proposed architecture for the MVP (nothing implemented yet). Changes to this document must be
> accompanied by an entry in [DECISIONS.md](./DECISIONS.md).
> Product scope and acceptance criteria: [PROJECT_BRIEF.md](./PROJECT_BRIEF.md).

---

## 1. Overview

```
┌──────────────────────────── Android kiosk (Chrome, portrait 1080×1920) ────────────────────────────┐
│  Kiosk client (React, single route "/")                                                            │
│   ├─ Session state machine (useReducer)  ── signals ──►  Recommendation engine (pure, shared)      │
│   ├─ Screens: Attract · Entry · Role · Challenges · Facility · Explorer · Recommendations ·        │
│   │           Value · Lead form · Confirmation                                                     │
│   ├─ Idle timer + reset controller (hard reload on reset)                                          │
│   └─ i18n dictionaries (ES default / EN) + visible content bundle (filtered by content mode)       │
└───────────────────────────────┬────────────────────────────────────────────────────────────────────┘
                                │ HTTP on the local network (http://<laptop-IPv4>:3000)
┌───────────────────────────────▼──────────────── Windows laptop (Node.js LTS) ──────────────────────┐
│  Next.js server (App Router)                                                                        │
│   ├─ Route handlers:  POST /api/sessions  ·  POST /api/leads  ·  GET /api/health                    │
│   │                   /api/admin/*  (disabled by default, Basic auth)                               │
│   ├─ Server modules:  content loader + visibility filter · recommendation engine (recompute) ·     │
│   │                   lead scoring (server-only) · report renderer · email outbox + worker         │
│   ├─ Prisma ORM ──► SQLite file (data/linde-sphere.db)                                              │
│   └─ Email providers: file (dev, default) · SMTP · [future] Microsoft Graph                        │
└───────────────────────────────┬────────────────────────────────────────────────────────────────────┘
                                │ SMTP (only when internet is available; retried otherwise)
                                ▼
                         Visitor's inbox
```

Design pillars:

1. **Configuration-first.** Everything visitor-facing — personas, challenges, scenes, hotspots, solution
   categories, resources, consent text, disclaimers, brand — is JSON content validated with Zod.
2. **Deterministic core.** The recommendation engine is a pure function shared by client and server.
3. **Leads are sacred.** Lead persistence never depends on email delivery (transactional outbox).
4. **Privacy by construction.** No PII in persistent browser storage, no PII in logs, commercial scoring
   never leaves the server.
5. **Offline-tolerant.** The kiosk loads nothing from the internet; only outbound email needs connectivity.

---

## 2. Technology stack

Versions observed on npm at documentation time (2026-09-29). Exact versions are pinned in `package.json`
during Phase 1.

| Concern                  | Choice                                                | Version target                                        | Notes                                                  |
| ------------------------ | ----------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------ |
| Runtime                  | Node.js LTS                                           | 22.x (≥ 20.9 required by Next.js 16)                  | Same major on dev and Windows laptop                   |
| Framework                | Next.js, App Router                                   | 16.3.x (latest stable)                                | `start:network` binds `0.0.0.0` for LAN (ADR-039)      |
| UI                       | React                                                 | 19.x                                                  |                                                        |
| Language                 | TypeScript                                            | 5.x, `strict: true`, `noUncheckedIndexedAccess: true` |                                                        |
| Styling                  | Tailwind CSS                                          | 4.x (CSS-first `@theme`)                              | Brand tokens via CSS variables                         |
| Motion                   | Motion (formerly Framer Motion)                       | 13.x — `motion` package                               | Same library, current package name (ADR-015)           |
| Validation               | Zod                                                   | 4.x                                                   | Content, API payloads, env                             |
| ORM / DB                 | Prisma + SQLite                                       | **7.10.x stable** (not the 8.0 RC tagged `latest`)    | Introduced in Phase 7; verify on Windows (ADR-010/038) |
| Email                    | Nodemailer (SMTP)                                     | latest stable                                         | Behind a provider interface                            |
| Unit / integration tests | Vitest + Testing Library                              | latest stable                                         | `jsdom` for components, `node` for server              |
| E2E tests                | Playwright                                            | version compatible with installed Chromium            | Portrait viewport + touch emulation                    |
| Lint / format            | ESLint (flat config, `eslint-config-next`) + Prettier | latest stable                                         | `prettier-plugin-tailwindcss`                          |

**Installed so far (Phases 1–4):** Next.js 16.3.7, React 19.2, TypeScript 5.9, Tailwind 4, Zod 4.6,
`server-only`, Vitest 5, Testing Library + jsdom, Playwright 1.63, tsx, ESLint 9 (`eslint-config-next`),
Prettier 3. Prisma (Phase 7, ADR-038), Motion (Phase 6, only if CSS keyframes prove insufficient for scene
transitions; the attract loop uses CSS keyframes) and Nodemailer (Phase 8) are added in the phases that first
need them.

**Explicitly not used:** real-time 3D libraries (three.js, Babylon, etc.), global state libraries
(Redux, Zustand, MobX), i18n frameworks, CMS, analytics SDKs, external CDNs, paid services.

---

## 3. Repository layout

The application lives in `linde-sphere/` alongside the unrelated `client-facing/` project (ADR-002).
Items marked ✅ exist today; the rest are planned and arrive in the phase noted in TASKS.md.

### 3.1 Source folders (ADR-034)

| Folder           | Holds                                                                                                             | Rules                                                                          |
| ---------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `src/app`        | Routes only: layouts, pages, `error`/`global-error`/`not-found`/`loading`, route handlers                         | Thin; delegates to features                                                    |
| `src/components` | Touchscreen design system (§12.1): shell, actions, cards, navigation, explorer, content, overlay, forms, feedback | No feature logic or data fetching; localized chrome labels via `useLanguage()` |
| `src/features`   | Feature modules (home, status, dev-gallery; later kiosk flow, explorer, recommendations, lead)                    | May use components, lib, domain                                                |
| `src/lib`        | Client-safe utilities and configuration (`config/`, `i18n/` incl. `LanguageProvider`, `cn`, `csv`, `useHydrated`) | No secrets, no Node-only APIs                                                  |
| `src/data`       | Static data bundled with the app (UI translation dictionaries)                                                    | Visitor-editable content stays in `/content` (ADR-006)                         |
| `src/types`      | Cross-cutting TypeScript types not derived from Zod (i18n keys, health report)                                    | Types only                                                                     |
| `src/styles`     | `tokens.css` (design tokens, §12.1) and `globals.css`                                                             |                                                                                |
| `src/domain`     | Pure, isomorphic Zod schemas and logic (content model, runtime payloads; engine in Phase 3)                       | No I/O; fully unit-tested                                                      |
| `src/server`     | Server-only modules (`import "server-only"`): env, health, database probe, later leads/email                      | Never imported by client components                                            |
| `public/assets`  | Static files served at `/assets/...` (`brand/`, `scenes/placeholder/`)                                            | Original or approved assets only                                               |

### 3.2 Tree

```
linde-sphere/
├─ PROJECT_BRIEF.md · ARCHITECTURE.md · DECISIONS.md · TASKS.md · CONTENT_VALIDATION.md · README.md  ✅
├─ .env.example                   # variable names + non-secret defaults                   ✅
├─ package.json · tsconfig.json · next.config.ts · eslint.config.mjs · .prettierrc.json   ✅
├─ vitest.config.mts · playwright.config.ts                                                ✅
├─ content/                       # C0 content (JSON), validated by Zod                    ✅
│  ├─ manifest.json · personas.json · challenges.json · facility-types.json               ✅
│  ├─ scenes/<scene-id>.json      # 8 scenes with layers + hotspots                        ✅
│  ├─ solutions.json · digital-assets.json · recommendation-rules.json · consent.json     ✅
│  ├─ engine-settings.json        # engine weights/caps, result sizes, relevance, readiness ✅
│  └─ report.json · sales-contacts.json   (Phases 7–8)
├─ config/lead-scoring.json       # C3, server-only (Phase 3)
├─ prisma/ · prisma.config.ts     (Phase 7)
├─ public/assets/
│  ├─ brand/                      # approved brand files only (empty)                       ✅
│  └─ scenes/placeholder/         # original placeholder SVG layers (scripts/placeholder-art.ts) ✅
├─ src/
│  ├─ app/
│  │  ├─ layout.tsx               # brand CSS vars, viewport, LanguageProvider, AppShell    ✅
│  │  ├─ page.tsx                 # kiosk route: loads public content → KioskExperience      ✅
│  │  ├─ error.tsx · global-error.tsx · not-found.tsx · loading.tsx                        ✅
│  │  ├─ api/health/route.ts      # readiness JSON                                           ✅
│  │  ├─ dev/components/page.tsx  # dev-only design-system gallery (gated, ADR-045)          ✅
│  │  └─ dev/scenes/page.tsx      # dev-only scene coordinate calibration (gated, ADR-049)   ✅
│  ├─ components/                 # design system (§12.1)                                    ✅
│  │  ├─ shell/ (app-shell, kiosk-header, language-toggle, brand-wordmark)
│  │  ├─ actions/ (action-button: Primary/SecondaryAction, bottom-action-bar, reset-experience-button)
│  │  ├─ cards/ (touch-card, action-card, persona-card, challenge-card, recommendation-card)
│  │  ├─ navigation/ (progress-indicator, scene-breadcrumb) · explorer/ (hotspot-button)
│  │  ├─ content/ (solution-panel, pending-validation-badge) · overlay/ (dialog: Modal/Sheet, inactivity-warning)
│  │  ├─ forms/ (form-field, consent-checkbox) · feedback/ (status-banner, loading/empty/error-state)
│  │  └─ icons.tsx
│  ├─ features/kiosk/             # visitor experience (§5)                                  ✅
│  │  ├─ kiosk-experience.tsx · kiosk-header-actions.tsx · privacy-sheet.tsx
│  │  ├─ screens/ (attract-screen, welcome-screen, path-screen, use-screen-heading)
│  │  └─ state/ (kiosk-state reducer, kiosk-session-provider, use-idle-timer, session-id)
│  ├─ features/explorer/          # scene-viewer, hotspot-layout, scene-navigation, explorer-screen, scene-calibrator ✅
│  ├─ features/status/ · features/dev-gallery/                                              ✅
│  ├─ lib/config/{app-config,brand-config}.ts · lib/i18n/{translate,language-provider} · lib/{cn,csv,use-hydrated}.ts ✅
│  ├─ data/i18n/{es,en}.ts                                                                  ✅
│  ├─ types/{i18n,health}.ts                                                                ✅
│  ├─ styles/{tokens,globals}.css                                                          ✅
│  ├─ domain/                     # content/, session/, leads/, report/, email/                 ✅
│  │  ├─ recommendations/         # engine, explanations, recommendation-readiness, result schema ✅
│  │  └─ review/content-review.ts # sales-review CSV rows + generated Markdown                 ✅
│  ├─ server/
│  │  ├─ env.ts · health.ts · database-probe.ts                                             ✅
│  │  ├─ content/load-content.ts  # fs loader (no `server-only` so CLI scripts can use it)  ✅
│  │  ├─ content/public-content.ts # validated, visibility-filtered bundle per mode (cached in prod) ✅
│  │  └─ db.ts · lead-scoring.ts · leads.ts · report/ · email/ · outbox/ · log.ts  (Phases 3–9)
│  ├─ instrumentation.ts          # validates env + content at server boot (outbox worker: Phase 8) ✅
│  └─ proxy.ts                    # /dev/* gate (404 in production unless enabled) ✅; admin guard (Phase 9)
├─ scripts/content-check.ts · content-export.ts · placeholder-art.ts   ✅ · leads-export / leads-purge / outbox-retry (Phase 9)
├─ exports/content-validation.csv # generated sales worksheet (UTF-8 BOM, CRLF; `.gitattributes -text`) ✅
├─ tests/
│  ├─ helpers/ · unit/content · unit/runtime · unit/app                                     ✅
│  ├─ components/                 # Testing Library + jsdom component tests                   ✅
│  ├─ e2e/{foundation,gallery,kiosk}.spec.ts # Playwright: kiosk 1080×1920, laptop 1440×900, phone 390×844 ✅
│  └─ integration/                (Phase 7)
└─ data/                          # SQLite db + dev email output (git-ignored)
```

---

## 4. Runtime topology and deployment

### 4.1 Network

- **Preferred:** Windows **Mobile Hotspot** on the laptop. The laptop's hotspot gateway address is stable
  (Windows default `192.168.137.1`), so the kiosk URL does not change between sessions.
- **Alternative:** shared venue/travel-router network with a DHCP reservation for the laptop.
- Kiosk URL: `http://<laptop-IPv4>:3000/`. Plain HTTP on a private network (no secure-context-only
  browser APIs are required by the design).
- Windows Defender Firewall: inbound rule for TCP 3000 on the **Private** profile only.
- Serving: `npm run start` / `npm run dev` bind to `localhost` only. `npm run start:network` /
  `npm run dev:network` bind to `0.0.0.0` (ADR-039). Next.js 16 would otherwise bind all interfaces by
  default. The dev server accepts HMR requests from private LAN ranges via `allowedDevOrigins`.
- The laptop's internet connection (Ethernet/second adapter/phone tether) is used only by the email worker.

### 4.2 Processes

A single Node.js process (`npm run start:network`) serves pages, APIs, and runs the outbox worker (started from
`instrumentation.ts`). No separate daemon is needed. Operators may also run `npm run outbox:retry`
manually.

### 4.3 Laptop hygiene (runbook items)

Disable sleep while plugged in · disable automatic Windows updates/restarts during the event · BitLocker
enabled (SQLite holds PII) · app started from a desktop shortcut/script · `.env` present · health check at
`/api/health`.

### 4.4 Android kiosk

Chrome in full screen: first touch on Attract requests the Fullscreen API; Android **screen pinning** (or a
managed kiosk mode) keeps the visitor inside Chrome. Display timeout disabled, auto-rotate locked to
portrait, Chrome "Save passwords"/"Autofill addresses" disabled so the lead form never offers a previous
visitor's data.

---

## 5. Kiosk client architecture

### 5.1 Single route + state machine

The whole visitor experience is **one route (`/`)** driven by a `useReducer` state machine held in a
React context (ADR-004, ADR-005).

- No URL changes and **no browser history entries** → the Android back gesture cannot reveal a
  previous screen or visitor.
- Screen transitions are explicit reducer actions, making flows testable without rendering.

```
            ┌────────┐ touch  ┌─────────┐
  (boot) ──►│ATTRACT │──────►│ WELCOME │
            └────────┘        └─┬─┬─┬───┘
               ▲        A: role │ │ │ C: explore
               │  ┌─────────────┘ │ └──────────────┐
               │  ▼       B: need ▼                ▼
               │ ROLE ⇄ CHALLENGES ⇄ FACILITY    EXPLORER (campus ⇄ scenes ⇄ panels)
               │  └──────────┬──────────┘          │  ▲   (optional "tailor" step: role+challenges)
               │             ▼                     ▼  │
               │      RECOMMENDATIONS ◄──── "View my recommendations" (when minimum info met)
               │             │  ▲  "Refine by exploring" ──► EXPLORER
               │             ▼  │
               │           VALUE ──► LEAD_FORM ──(201)──► CONFIRMATION ──(auto)──┐
               │                                                                 │
               └──────────── RESET (hard reload) ◄── idle timeout / completion ◄──┘
```

### 5.2 Session state (client)

Implemented in `src/features/kiosk/state/` with React only (`useReducer` + context, no global state
library, ADR-047). `kiosk-state.ts` is a pure reducer, unit-tested without rendering.

```ts
type KioskState = {
  screen: KioskScreen; // attract · welcome · role journey (below) · challenges (path B) · explore
  session: ActiveSession | null; // null on the attract screen
  resetCount: number; // remount key: every reset renders fresh components
  lastResetReason: "explicit" | "timeout" | "completed" | null;
};
type ActiveSession = {
  id: string; // opaque random UUID v4, created on first touch (HTTP-safe fallback, see session-id.ts)
  startedAt: string;
  entryPath: "role" | "challenge" | "explore" | null; // first path chosen
  signals: SessionSignals; // C1 anonymous signals: role, challenges (max 3), facility, scenes, hotspots, interests
  otherChallengeSelected: boolean; // "Algo más / Something else" (no free text is ever collected)
  recommendations: RecommendationResult | null; // snapshot stored when the visitor is shown recommendations
  events: SessionEvent[]; // anonymous ordered events (ADR-048)
  accessibility: { largeText: boolean; reduceMotion: boolean }; // this visitor only
};
```

- The language lives in `LanguageProvider` (not persisted); reset sets it back to Spanish.
- Every action except `START_SESSION` is ignored while there is no session, so nothing is recorded on the
  attract screen. The session never contains names, contact details or free text.
- `toSessionSummary()` converts a session into the anonymous `VisitorSession` schema (sent on reset from
  Phase 7).
- Accessibility preferences are applied as `html[data-text-size="large"]` (font scale ×1.18) and
  `html[data-motion="reduce"]` (animations and transitions off), and removed on reset.
- Each screen change scrolls to the top and moves focus to the screen's `h1` (without scrolling).

**Recommendations are derived, not stored first:** `KioskExperience` calculates
`recommend(signals, publicContent)` in a memo whenever the signals change (they keep their identity
otherwise), so preliminary recommendations exist the moment a persona is selected. The snapshot is written to
the session (`SET_RECOMMENDATIONS`, which also records a `recommendations-calculated` event) when the visitor
continues to the transition, refines, or opens the recommendations, and only if it changed.

Still planned: `hasMinimumInfo` and `shouldShowPrompt` (path B / explorer prompt, Phase 5–6). The lead draft
(C2) lives only inside the lead form component (§5.2.2), never in this store.

#### 5.2.2 Lead form (`src/features/kiosk/lead/`, ADR-053)

```
SUMMARY-REQUEST ─ Completar mis datos ─► LEAD-FORM
  1 Sus datos (nombre, apellido, organización, correo de trabajo, teléfono opcional)
  2 Preferencias y permisos (área, idioma del resumen, temas — prefilled from the session;
    consent 1 "report" required · consent 2 "follow-up" optional; text + version from content/consent.json)
  3 Revise sus datos ── Corregir mis datos ─► 1       Cancelar (confirm if typed) ─► RECOMMENDATIONS
      └─ Enviar mi resumen ─► sending ("Guardando…", then "Preparando el envío…")
            stored ─► status poll (3 × 1.2 s) ─► RESULT: sent · queued · delayed (masked email) ─► reset 15 s / Terminar
            failed / timeout ─► back to 3 with "No pudimos guardar…" (details and recommendations kept) ─► retry
            422 ─► field errors on the step that holds them · 409 ─► review with a new request token
```

- **Model (`lead-form-model.ts`, pure):** values, per-field validation with the server's Zod schemas
  (`PersonNameSchema`, `OrganizationSchema`, `BusinessEmailSchema`, `PhoneSchema`), payload builder and
  server-issue mapping. Inline validation runs on blur (non-empty fields), re-checks a field with an error
  while it is corrected, and validates the whole step on "Continuar" (error summary + focus on the first
  invalid field).
- **Touch typing:** five inputs per step; `type`/`inputMode` email and tel, `autoCapitalize` words/none,
  `enterKeyHint`, autofill and spell-check off. Enter moves to the next field, then continues. Role uses a
  native select (system picker on Android); language and interests are large toggle chips.
- **Double submission:** an in-flight ref blocks a second request; the sending view replaces the button.
  One request token per distinct payload: a retry of the same data reuses it (a stored-but-unanswered request
  is recognized by the server), corrected data gets a new one.
- **Email outcome (`lead-api.ts`):** the lead is stored first (server transaction, ADR-052); the client then
  reads `GET /api/leads/status/:token`. `sent` → "Enviamos su resumen"; `failed`/`retrying` → "Guardamos su
  solicitud… lo intentaremos de nuevo automáticamente"; still pending → "Guardamos su solicitud… en breve".
  No codes or provider text are ever shown.
- **Privacy:** contact values exist only in `LeadFormScreen` state; they are cleared once stored, discarded on
  cancel, and gone on every reset (component remount + hard reload). The result shows only
  `maskEmailForDisplay` ("ma•••@dominio"). Session events: `lead-form-opened`, `lead-form-cancelled`,
  `lead-submitted` (no target, no personal data).

#### 5.2.1 Journeys (`src/features/kiosk/journey/`)

```
A  ROLE (1/2) ─► ROLE-CHALLENGES (≤ 4 + "Algo más", 2/2) ─► TAILORING (1.8 s) ─► NEXT-STEPS
       NEXT-STEPS ─┬─ Ver recomendaciones preliminares ─► RECOMMENDATIONS
                   ├─ Refinar eligiendo retos ─► REFINE-CHALLENGES ─► RECOMMENDATIONS
                   └─ Explorar áreas relevantes ─► EXPLORE
B  CHALLENGES (all, ≤ 3, 1/2) ─► CHALLENGE-ROLE (optional, 2/2) ─► TAILORING ─► RECOMMENDATIONS
C  EXPLORE ─(ready)─► "Ver mis recomendaciones" / tray / conversion prompt ─► RECOMMENDATIONS

RECOMMENDATIONS ─┬─ Enviarme mi resumen personalizado ─► SUMMARY-REQUEST ─► LEAD-FORM (§5.2.2)
                 ├─ Seguir explorando ─► EXPLORE (same scene, progress kept)
                 ├─ Revisar mis prioridades ─► REFINE-CHALLENGES (role shown, "Cambiar mi área")
                 └─ Empezar de nuevo ─► confirmation ─► reset
```

- One primary persona (single select; selecting another replaces it). Continue is disabled until one is chosen.
- "Mi función abarca varias áreas" is a content persona with `scope: "multiple"`: shown apart, its
  suggestions are the most common challenges, and no rule may weight it, so its recommendations come from the
  challenges chosen (fallback if none).
- The challenge step shows the persona's `suggestedChallengeIds` (max 4, `journey-view.ts`) plus any challenge
  already chosen elsewhere, and "Algo más", which is recorded as `otherChallengeSelected` and an event, does not
  count toward the limit of three, and never opens a text field.
- Next steps summarize the choices and name up to three relevant areas: the `relatedSceneIds` of the
  recommendations in order, without the campus root.
- Every recommendation card shows "Por qué es relevante" from the engine's `whyThisAppeared` (built from
  `matchedSignals`); scores are never shown.

#### 5.2.2 Recommendation (value) screen (ADR-051)

It shows value before any form, in this order:

1. The heading "Identificamos oportunidades relevantes para usted".
2. A one-line summary of the visitor's area, priorities and the areas where they looked at content.
3. The disclaimer: "a starting point … not a complete assessment or clinical advice".
4. A demo notice when content is pending Puerto Rico validation.
5. An "updated" notice when something changed since the visitor last looked.
6. Up to 3 primary cards, each with:
   - its relevance in words and the pending badge;
   - "Por qué es relevante" and "Cuándo puede ser relevante";
   - related areas;
   - resources, where demo-status ones are marked "pendiente de validación";
   - the next step and "Verlo en el hospital".
7. Up to 3 secondary items.

Its one primary action is **"Enviarme mi resumen personalizado"**, which opens a value-first
summary-request screen listing what the summary contains, then the lead form (§5.2.2). The secondary actions are
"Seguir explorando", "Revisar mis prioridades" and "Empezar de nuevo" (with confirmation). A copy test bans
pressure, guarantee, clinical and "comprehensive" wording from all UI strings.

**Calm, evidence-based updates (`recommendation-stability.ts`):**

- **Evidence:** recommendations are calculated from `recommendationEvidence(signals)`: role, challenges,
  organization type, interests, opened information or solution hotspots (and their engagement), and scenes
  where such content was opened. Navigation clicks and scenes merely passed through are left out, so walking
  around never changes recommendations.
- **When they recalculate:** only when `evidenceKey` changes (`useStableByKey`).
- **Order:** `stabilizeRecommendations(lastSeen, fresh, reorderMargin)` keeps the order the visitor last saw
  when the same cards are present and no swap is backed by ≥ `reorderMargin` points (seed 2, in
  `engine-settings.json`). If the set changed, or a card is clearly stronger, the engine's ranking is used.
  Identical results keep their identity, so nothing is recorded twice.
- **What changed:** `recommendationChanges(lastSeen, current)` gives the new cards (marked "Nuevo") and
  whether membership, order, relevance or reasons changed (the "Actualizamos sus recomendaciones…" notice).
- **Snapshot:** the session keeps the snapshot the visitor last saw. Opening the recommendations screen or the
  tray commits it.

**Explorer tray (`recommendation-tray.tsx`):** once recommendations are available, "Vista rápida" (with
"N nuevas" when new cards appeared) opens a compact sheet with the primary recommendations, their relevance,
reasons and "Nuevo" marks, plus "Ver todo" and "Seguir explorando". It is a dialog, so the conversion prompt
stays away while it is open.

- The persona grid uses a compact `TouchCard` density so all 11 options fit 1080 × 1920 without scrolling
  (verified by E2E).

The page (`src/app/page.tsx`) renders at request time and passes the visibility-filtered
`PublicContentBundle` from `src/server/content/public-content.ts`, cached per content mode in production.
Content is also validated at server boot in `instrumentation.ts`, so invalid content stops the server
before the first visitor.

### 5.3 Session states, reset and privacy guarantees (ADR-055)

`sessionPhase(state, { recommendationReady })` (pure, `kiosk-state.ts`) derives the kiosk's session state;
the kiosk root exposes it as `data-session-phase`:

```
attracting ─touch─► active ─readiness met / recommendations shown─► recommendation-ready
   ▲                                                   │ "Completar mis datos"
   │                                                   ▼
   │                                           entering-contact ◄─ submission failed ─┐
   │                                                   │ "Enviar mi resumen"          │
   │                                                   ▼                              │
   │                                              submitting ─────────────────────────┘
   │                                                   │ stored + delivery checked
   │                                                   ▼
   └──── resetting ◄── countdown / "Finalizar ahora" ─ complete
          ▲
          └── "Empezar de nuevo" · inactivity timeout (from any state except submitting/complete)
```

The store holds only non-personal flags for this: `leadFlow` (`idle | entering | submitting | complete`),
`resetting` and `deferredReset`. Contact data never enters the store.

Reset is triggered by the discreet "Empezar de nuevo" (with confirmation), the inactivity countdown or the
warning's "Empezar de nuevo", and the completion screen (countdown or "Finalizar ahora").

Reset procedure (`KioskSessionProvider.reset` → `REQUEST_RESET`):

1. **Never during a submission.** While `leadFlow` is `submitting` the request is stored as `deferredReset`
   and carried out as soon as the submission settles (stored or failed). The idle timer is paused and the
   header reset button disabled while submitting, and the form cannot be cancelled.
2. `REQUEST_RESET` returns the store to `INITIAL_KIOSK_STATE` at once (session cleared; new `resetCount`
   remounts every screen, which drops the lead form's local state) and marks `resetting`.
3. An effect restores Spanish and the default accessibility attributes, then calls
   `window.location.replace("/")` — a **hard reload** that discards all JS memory and replaces the history
   entry (injectable for tests) — and marks the reset done.
4. The next touch starts a new session with a fresh random id (`createSessionId`, also used for the lead
   request token because `crypto.randomUUID` is unavailable on the kiosk's plain-HTTP origin).

The client never writes to `localStorage`, `sessionStorage`, IndexedDB, or cookies. Form inputs use
`autocomplete="off"` and non-standard `name` attributes. The kiosk page is served with
`Cache-Control: no-store`, and a `pageshow` handler reloads any page restored from the back/forward cache,
so browser Back/Forward never reveal a previous visitor. Still planned: an anonymous session summary via
`sendBeacon` on reset (`POST /api/sessions`).

### 5.4 Idle timer and completion countdown

| State                         | Idle before warning         | Countdown              | Env (seconds)                                                          |
| ----------------------------- | --------------------------- | ---------------------- | ---------------------------------------------------------------------- |
| attracting                    | none (language revert 30 s) | —                      | —                                                                      |
| active / recommendation-ready | 60 s                        | 15 s ("¿Sigue ahí?")   | `KIOSK_IDLE_WARNING_SECONDS`, `KIOSK_IDLE_COUNTDOWN_SECONDS`           |
| entering-contact              | 120 s                       | 20 s                   | `KIOSK_FORM_IDLE_WARNING_SECONDS`, `KIOSK_FORM_IDLE_COUNTDOWN_SECONDS` |
| submitting                    | paused (never interrupted)  | —                      | —                                                                      |
| complete                      | paused                      | 15 s visible countdown | `KIOSK_COMPLETION_SECONDS`                                             |

Defaults live in `app-config.ts`; the kiosk page reads the env overrides on every request
(`src/server/kiosk-timing.ts`), so the event team can tune them without rebuilding. `useIdleTimer` restarts
on any `pointerdown`, `keydown`, `touchstart` or `wheel` (capture phase). While the warning is open, global
activity is ignored: only **"Continuar mi sesión"** keeps the session (and restarts the full interval), so a
tap on "Empezar de nuevo" is never swallowed. No action → automatic reset.

**Completion screen** (`completion-screen.tsx`): report delivery status, masked destination
(`ma•••@dominio`), the optional consultation next step (report copy CTA and sales contact), "Volveremos al
inicio en N s" and **"Finalizar ahora"**; at zero it resets once and returns to the attract screen.

**Throughput:** role route to recommendations in 6 taps, challenge route in 5 (role and challenges are
optional); on next steps "Ver recomendaciones preliminares" is the dominant card and the explorer is
optional; once ready, "Ver mis recomendaciones" stays in the explorer's action bar across scenes. Every
journey screen has exactly one dominant action (`data-variant="primary"`) and a way back or out — the
welcome screen's three equal entry paths, the automatic tailoring transition and the explorer before
readiness (tapping points is the action) are the deliberate exceptions. Tested in
`tests/components/throughput.test.tsx`.

On the attract screen, if a passer-by switches to English and walks away, the screen returns to Spanish and
to its first phrase after 30 s without touches.

### 5.5 Kiosk hardening (CSS/HTML)

Amended by ADR-058; the original design is in ADR-022.

- **Viewport:** `width=device-width, initial-scale=1`. Browser zoom stays available (WCAG 1.4.4).
- **Gestures:**
  - `touch-action: manipulation` on the page: no double-tap zoom.
  - `touch-action: pan-x pan-y` on the scene art box: a pinch there cannot zoom the scene out of place.
  - `overscroll-behavior: none`.
- **Kiosk frame only (`.kiosk-surface`):** `user-select: none` and `-webkit-touch-callout: none`, image
  dragging off, and the long-press context menu suppressed. Inputs and `[data-selectable]` text (the
  visitor's own entries on the review step) stay selectable and keep the menu. The admin utility is outside
  the frame and behaves like a normal page.
- **Scroll regions:** scrollable dialog bodies and tables are focusable, labeled regions (keyboard
  scrolling).
- **Orientation:** layout is fluid (container-query scene box, `dvh`). State lives in React, so rotation
  never resets it. This is covered by an E2E test that rotates mid-journey with a sheet open.
- **Physical-device checks:** MANUAL_KIOSK_TEST.md.

---

## 6. Content model

All content lives in `content/`, is validated by Zod schemas in `src/domain/content/`, and is loaded
once per server process. TypeScript types are inferred from the schemas (`z.infer`), so types and
validation cannot drift. Every object schema is **strict**: unknown keys (typos) are errors.

### 6.1 Shared primitives (`primitives.ts`)

```ts
type LocalizedText = { es: string; en: string }; // both required, trimmed, non-empty
type Id = string; // kebab-case, 2–64 chars
type ValidationStatus = "validated" | "assumed" | "placeholder" | "unavailable";
type Market = "puerto-rico" | "united-states-reference" | "global-reference" | "unknown";

// Required on every Solution and DigitalAsset
type Governance = {
  validationStatus: ValidationStatus;
  market: Market;
  internalNotes: string; // internal only — stripped before reaching the client
  lastReviewedAt: string | null; // YYYY-MM-DD
  reviewedBy: string | null;
  sourceLabel: string;
  requiresSalesValidation: boolean;
};
```

Governance invariants (enforced by the schema):

- `validated` or `unavailable` ⇒ `reviewedBy` and `lastReviewedAt` are required.
- `validated` ⇒ `market === "puerto-rico"` and `requiresSalesValidation === false` (validation means
  "confirmed local offering").
- `assumed` or `placeholder` ⇒ `requiresSalesValidation === true`.

Taxonomy entities (persona, challenge, facility type, scene, hotspot) and rules carry `validationStatus`
only. They make no offering claim, and the project owner approves them.

### 6.2 Entities

| Entity (file)                                      | Key fields                                                                                                                                                                                                                                                                                                                                                                                                                     |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Persona` (`personas.json`)                        | `id`, `label`, `description`, `icon`, `sortOrder`, `suggestedChallengeIds[]` (ordering hint only), `scope: single \| multiple` (default single; at most one "several areas" persona, never weighted by a rule), `validationStatus`                                                                                                                                                                                             |
| `Challenge` (`challenges.json`)                    | `id`, `label`, `description`, `icon`, `sortOrder`, `validationStatus`                                                                                                                                                                                                                                                                                                                                                          |
| `FacilityType` (`facility-types.json`)             | `id`, `label`, `description`, `sortOrder`, `validationStatus`                                                                                                                                                                                                                                                                                                                                                                  |
| `Scene` (`scenes/<id>.json`)                       | `id`, `slug`, `title`, `description`, `background` (layer, depth 0), `foregroundLayers[]`, `hotspots[]`, `parentSceneId` (null = root), `breadcrumb[]` (root → self), `validationStatus`, `sortOrder`                                                                                                                                                                                                                          |
| `SceneLayer`                                       | `src` (root-relative path in `public/`), `alt` (localized), `depth` 0–1 (parallax), `assetStatus: approved \| placeholder` (does not gate visibility)                                                                                                                                                                                                                                                                          |
| `Hotspot` (in scene)                               | `id` (globally unique), `type: navigation \| solution \| information`, `x`/`y` 0–100 (center, % of art box), optional `width`/`height` (% hit area, must stay inside), `label`, `accessibleLabel`, `visualImportance: primary \| secondary \| tertiary`, `recommendationSignals {challengeIds[], solutionIds[]}`, `validationStatus`, plus by type: `targetSceneId` · `targetSolutionIds[]` · `panel {title, body, bullets[]}` |
| `Solution` (`solutions.json`)                      | `id`, `slug`, `title`, `summary`, `nextStep`, `relatedChallengeIds[]`, `relatedSceneIds[]`, `digitalAssetIds[]`, `isFallback`, **governance**                                                                                                                                                                                                                                                                                  |
| `DigitalAsset` (`digital-assets.json`)             | `id`, `title`, `description`, `type: brochure \| video \| web-page \| guide \| checklist`, `access: {kind:"url", url(https)} \| {kind:"local-file", path}`, `languages[]`, **governance**                                                                                                                                                                                                                                      |
| `RecommendationRule` (`recommendation-rules.json`) | see §7.10                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `ConsentTextSet` (`consent.json`)                  | `version`, `reportDelivery`, `salesFollowUp`, `privacyNotice` (localized), `validationStatus`, `internalNotes`                                                                                                                                                                                                                                                                                                                 |
| `EngineSettings` (`engine-settings.json`)          | `scoring` (caps, bonus, affinity, implied divisor), `results` (primary/secondary), `relevance` (high/medium), `readiness` thresholds; whole numbers only; see §7.4                                                                                                                                                                                                                                                             |
| `ContentManifest` (`manifest.json`)                | `contentVersion` (semver), `defaultLanguage`, `updatedAt`                                                                                                                                                                                                                                                                                                                                                                      |

Planned content (later phases): `report.json` (CTA, disclaimer), `sales-contacts.json`. Branding and idle timings live in `src/lib/config/` (ADR-036).

### 6.3 Runtime schemas (not content)

| Schema                 | File                                              | Purpose                                                                                                                                                                                                                                                                 |
| ---------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SessionSignals`       | `domain/session/visitor-session.ts`               | Anonymous C1 signals; unique ids; ≤ 3 challenges; engaged ⊆ opened hotspots                                                                                                                                                                                             |
| `VisitorSession`       | same                                              | UUID, timestamps, language, entry path, content mode/version, outcome, signals                                                                                                                                                                                          |
| `SessionEvent`         | `domain/session/session-event.ts`                 | `{seq, type, targetId}` only: fixed event types, kebab-case ids with a letter (no free text, digits-only strings or timestamps); ≤ 200/session                                                                                                                          |
| `RecommendationResult` | `domain/recommendations/recommendation-result.ts` | 1–6 ranked items (≤ 3 `primary`, then ≤ 3 `secondary`), whole-number score, `relevanceLevel`, matched signals, bilingual explanation, `sceneId`, approved assets, next step, `validationStatus` + `pendingValidation`; never pending in production; fallback only alone |
| `LeadSubmission`       | `domain/leads/lead-submission.ts`                 | Kiosk → server payload: minimum contact fields, separate consents (report consent required), consent version, signals (not recommendations)                                                                                                                             |
| `LeadCreatedResponse`  | same                                              | `{ leadId, emailQueued }` only — no score                                                                                                                                                                                                                               |
| `ConsentRecord`        | `domain/leads/consent-record.ts`                  | One record per consent type with exact text shown, version, language, timestamp                                                                                                                                                                                         |
| `ReportPayload`        | `domain/report/report-payload.ts`                 | Resolved report data in one language; strict (no score); https-only resources; notice required if pending                                                                                                                                                               |
| `EmailDeliveryEvent`   | `domain/email/email-delivery-event.ts`            | Outbox lifecycle event; no recipient/body; sanitized error text (no email addresses)                                                                                                                                                                                    |

### 6.4 Validation pipeline

1. **Per-file schema validation** (`src/server/content/load-content.ts`): each JSON file is parsed and
   validated on its own, so errors point at `file → path` (with the record id for array files).
2. **Cross-record checks** (`checkContentBundle`, pure): run only once every file is valid. They cover
   unique ids and slugs, globally unique hotspot ids, dangling references, a single root scene,
   breadcrumbs that match the parent chain, cycle detection, scene reachability (warning), exactly one
   fallback solution, one rule per non-fallback solution, reachable `minimumScore`, the prohibited-claim
   scan, and identical ES/EN text (warning).
3. **Local file checks**: scene layers and local digital assets must exist in `public/`. A missing
   placeholder image is a warning; a missing approved image is an error.
4. **Production readiness** (`content:check --mode production`): the fallback, taxonomy, rules and
   consent must be visible and validated.

### 6.5 Visibility filter

A single pure function `visibleContent(bundle, mode, { previewPlaceholders })` returns a
`PublicContentBundle` (matrix in [CONTENT_VALIDATION.md §3](./CONTENT_VALIDATION.md#3-visibility-matrix)).
It also:

- hides scenes whose ancestors are hidden, and prunes hotspots, rule weights and cross-references that
  point to hidden items, so nothing renders as a broken link;
- strips internal fields (`internalNotes`, `reviewedBy`, `sourceLabel`, `lastReviewedAt`,
  `requiresSalesValidation`, `market`, exclusion reasons) so they never reach the kiosk client.

The page loader, server-side recomputation and report renderer all use it, so the UI and the report can
never disagree.

### 6.6 Content modes

`CONTENT_MODE` env var: `production` | `demo` (default `demo` during development). A development-only
flag `CONTENT_PREVIEW_PLACEHOLDERS=true` additionally shows placeholder items with a loud badge; it is
ignored when `NODE_ENV=production`.

---

## 7. Recommendation engine

Implemented in `src/domain/recommendations/`: `engine.ts`, `explanations.ts` and
`recommendation-readiness.ts`. The tuning lives in `content/engine-settings.json` (ADR-041, ADR-050).

### 7.1 In one paragraph

Every solution category has one **rule** in `content/recommendation-rules.json`. A rule lists the visitor
signals that make its category relevant, each with a **whole-number weight** from 1 to 10: roles,
challenges, organization type, scenes, hotspots and explicit interests. The engine adds up the weights of
the signals the visitor actually has, keeps the categories that reach their minimum, and sorts them. It
then explains each one in plain words from the same matched signals. It never guesses and never uses
randomness or the clock: the same visitor choices always give the same recommendations, in the same order,
with the same reasons.

### 7.2 Properties

- **Pure:** `recommend(signals, publicContent, { primary?, secondary? }) → RecommendationResult | null`.
  The kiosk shows it live; the server recomputes the same result when a lead is submitted (ADR-025).
- **Whole numbers only:** weights, caps, bonuses and thresholds are integers, validated by the content schema,
  so scores are exact and never depend on rounding.
- **Deterministic:** the result does not depend on the order in which signals were collected, and ties
  are broken by fixed rules (§7.5).
- **Explainable:** each item lists its `matchedSignals` (type, id, kind and points) and carries a
  **"Por qué aparece / Why this appeared"** sentence in Spanish and English.
- **Honest about content:** only content visible in the current mode can be recommended (§7.6), and anything
  not validated carries the pending-validation state.
- **Versioned:** `ENGINE_VERSION` (`2.0.0`) and `contentVersion` travel with every result.
- The **lead score** (Phase 7) is a separate, server-only calculation. It is never part of this result or
  the visitor UI. The recommendation `score` itself is never displayed either; visitors see relevance in
  words.

### 7.3 Inputs

`SessionSignals` (`domain/session/visitor-session.ts`), all anonymous:

| Input                 | Example                       | Notes                                                             |
| --------------------- | ----------------------------- | ----------------------------------------------------------------- |
| `personaId`           | `procurement-supply`          | One primary role, or the "several areas" persona (never weighted) |
| `challengeIds`        | `["cylinder-inventory"]`      | Up to 3, in the order chosen                                      |
| `facilityTypeId`      | `acute-hospital`              | Optional                                                          |
| `visitedSceneIds`     | `["campus", "gas-plant"]`     | Each scene once                                                   |
| `openedHotspotIds`    | `["gas-plant-bulk-tank"]`     | Each hotspot once, however often it was tapped                    |
| `engagedHotspotIds`   | `["gas-plant-bulk-tank"]`     | Panel kept open ≥ 6 s; only counts if the hotspot was opened      |
| `explicitInterestIds` | `["bulk-centralized-supply"]` | "Añadir a mis intereses"                                          |

### 7.4 Settings (`content/engine-settings.json`)

| Setting                           | Seed | Meaning                                                                                     |
| --------------------------------- | ---- | ------------------------------------------------------------------------------------------- |
| `scoring.sceneCap`                | 3    | Most points visited scenes can add to one category                                          |
| `scoring.hotspotCap`              | 8    | Most points opened hotspots (with their engagement bonus) can add to one category           |
| `scoring.engagedHotspotBonus`     | 1    | Extra point for a contributing hotspot whose panel stayed open                              |
| `scoring.hotspotAffinityWeight`   | 2    | Points when an opened hotspot lists the category but the rule does not weight it directly   |
| `scoring.impliedChallengeDivisor` | 2    | A challenge suggested by what the visitor opened counts as weight ÷ 2, rounded down (min 1) |
| `scoring.impliedChallengeCap`     | 3    | Most points implied challenges can add                                                      |
| `results.primary` / `.secondary`  | 3/3  | Top recommendations, then "También podría interesarle"                                      |
| `relevance.high` / `.medium`      | 9/5  | Score thresholds for "Muy relevante" / "Relevante" (below: "Posiblemente relevante")        |
| `readiness.*`                     | §7.8 | When recommendations are ready                                                              |

The caps are what **stop repeated clicks and long browsing from inflating a recommendation**. A hotspot
counts once no matter how often it is opened, and all hotspots together can add at most 8 points to a
category. Explicit choices (role, challenges, interests) therefore always stay decisive.

### 7.5 The algorithm, step by step

1. **Clean the input.** Unknown or hidden ids and duplicates are dropped. Engagement only counts for
   hotspots that were opened.
2. **Check exclusions first.** A rule can list signals that rule its category out. For example,
   `homecare-organization` excludes bulk supply and infrastructure assessment. An excluded category is
   removed before any scoring, so it can never take a place in the ranking.
3. **Add up the points.** For each remaining rule, add the weight of:
   - the role;
   - each chosen challenge;
   - the organization type;
   - visited scenes, up to the scene cap;
   - opened hotspots, up to the hotspot cap. A hotspot adds its direct weight, or the affinity points when
     it only lists the category, plus the engagement bonus when its panel stayed open;
   - challenges implied by opened hotspots that the visitor did not choose, at half weight rounded down,
     up to the implied cap;
   - explicit interests.
4. **Keep what qualifies.** A category needs at least the rule's `minimumScore` (seed: 3, so one primary
   role, challenge or hotspot is enough, but a secondary signal alone is not).
5. **Sort, always the same way:**
   1. Higher score first.
   2. On a tie, the category driven more by **explicit choices** (chosen challenges and interests) first.
   3. Then the rule's `priority` (1–100).
   4. Then the solution id, alphabetically, so there is never an unresolved tie.
6. **Split** into up to 3 **primary** and up to 3 **secondary** recommendations.
7. **Describe each one:**
   - **Relevance label:** "Muy relevante" (score ≥ 9), "Relevante" (≥ 5) or "Posiblemente relevante". It is
     never a percentage.
   - **Why this appeared:** the matched signals are grouped (interest, challenge, role, hotspot, scene,
     organization, related to what was explored). The strongest groups are named, at most 3 groups with up
     to 2 quoted labels each. For example: _"Aparece porque: eligió «Manejar cilindros e inventario»;
     seleccionó «Compras y cadena de suministro» como su área."_ Challenges implied by exploration are
     phrased as _"lo que exploró se relaciona con…"_, never as the visitor's choice.
   - **When it may be relevant:** the rule's sentence. Placeholders such as `{challenges}` are filled with
     the visitor's labels.
   - **Relevant scene:** where the visitor met it (the strongest opened hotspot's scene, then the
     strongest visited scene), otherwise the category's main area. It powers "Verlo en el hospital".
   - **Resources:** `validated` digital assets, plus in demo mode `assumed` ones, which the UI marks
     "pendiente de validación" (ADR-051). Placeholder or unavailable resources are never offered.
   - **Suggested next action:** the solution's next step.
   - **Validation status:** for internal use. The UI shows only the pending-validation badge.
8. **Nothing qualifies?** The engine returns the fallback, "talk with a specialist", with an honest
   explanation: no specific match was found yet.

### 7.6 Demo versus production

| Status        | Demo mode                              | Production mode |
| ------------- | -------------------------------------- | --------------- |
| `validated`   | Recommended                            | Recommended     |
| `assumed`     | Recommended, with "pending validation" | Never           |
| `placeholder` | Never (only in a local preview)        | Never           |
| `unavailable` | Never                                  | Never           |

The kiosk receives content already filtered by `visibleContent(bundle, mode)`. The engine checks each
solution's status again, so content that slipped through unfiltered is still not recommended. In
production with nothing validated, `recommend` returns `null` and the UI shows its empty state.

### 7.7 Worked example

A procurement visitor who chose "Manejar cilindros e inventario":

| Rank | Category                          | Points                   | Relevance              | Relevant scene |
| ---- | --------------------------------- | ------------------------ | ---------------------- | -------------- |
| 1    | Cylinder and inventory management | role 4 + challenge 5 = 9 | Muy relevante          | Patient care   |
| 2    | Bulk or centralized supply        | role 3 + challenge 2 = 5 | Relevante              | Gas plant      |
| 3    | Medical gas supply planning       | role 4 = 4               | Posiblemente relevante | Gas plant      |

No other category reaches its minimum of 3, so there are no secondary recommendations here.

The first card reads: _"Aparece porque: eligió «Manejar cilindros e inventario»; seleccionó «Compras y
cadena de suministro» como su área."_ `CONTENT_VALIDATION.md` §11.10 lists what each role, challenge and
hotspot alone produces (regenerated by `npm run content:export`).

### 7.8 Readiness (`RecommendationReadiness`)

Recommendations are **ready** as soon as any one of these is true (`engine-settings.json` → `readiness`).
Visitors never have to complete every route:

| Condition                                             | Seed |
| ----------------------------------------------------- | ---- |
| A role plus at least N challenges                     | 1    |
| At least N challenges                                 | 2    |
| Meaningful interaction in at least N different scenes | 2    |
| At least N different meaningful hotspots              | 3    |

A **meaningful interaction** is opening an information or solution hotspot, which means the visitor looked
at content. Navigation hotspots only move between scenes, and repeated opens count once.
`RecommendationReadiness.assess(signals, content)` returns the conditions met, the progress and the
hotspots still needed (for the explorer's progress line).

Readiness makes "Ver mis recomendaciones" appear in the explorer and allows the conversion prompt. The role
journey's own "Ver recomendaciones preliminares" option stays available (the visitor asked for it), and a
visitor who has already seen recommendations can always return to them.

### 7.9 Conversion prompt

Once recommendations are ready, a non-modal prompt says _"Encontramos oportunidades relevantes para sus
prioridades"_, with "Ver recomendaciones" and "Seguir explorando". `conversion-policy.ts` (pure) decides
when it may appear; `use-conversion-prompt.ts` gathers the inputs and schedules the next check. It is
never shown:

- while any dialog is open (hotspot panel, privacy, accessibility, reset, inactivity);
- while a form field has focus (data entry);
- within 2.5 s of a scene change, or within 1.5 s of a dialog closing or data entry ending;
- more than once per 2 minutes;
- outside the explorer (and the future path B), so never on forms, results or the attract loop.

It never takes focus (screen readers hear it through a polite live region) and hides itself after 15 s.
Showing, accepting and dismissing it are recorded as anonymous session events. Timings are in
`app-config.ts` → `kiosk.conversionPrompt`.

### 7.10 Rule format (`content/recommendation-rules.json`)

One rule per non-fallback solution (ADR-028). Weights are whole numbers from 1 to 10, and keys must be
existing ids:

```jsonc
{
  "id": "rule-backup-emergency-supply",
  "solutionId": "backup-emergency-supply",
  "weights": {
    "personas": { "government-system": 4, "executive": 3 },
    "challenges": { "emergency-preparedness": 5, "supply-continuity": 3 },
    "facilityTypes": { "public-health-system": 2 },
    "scenes": { "emergency": 2, "gas-plant": 1 },
    "hotspots": { "gas-plant-backup": 4, "emergency-surge-readiness": 3 },
    "explicitInterests": { "backup-emergency-supply": 6 }, // keyed by solution id
  },
  "minimumScore": 3, // whole number; must be reachable with the configured caps (checked)
  "exclusions": [], // e.g. { "signalType": "facilityTypes", "ids": ["homecare-organization"], "reason": "…" }
  "explanationTemplate": {
    // "When it may be relevant" sentence; placeholders optional
    "es": "Relevante para organizaciones que revisan o actualizan su plan de contingencia.",
    "en": "Relevant for organizations reviewing or updating their contingency plans.",
  },
  // "fallbackExplanation" is required only if the template uses placeholders
  "priority": 90, // tie-breaker, 1–100
  "validationStatus": "assumed",
  "internalNotes": "…",
}
```

Seed weighting convention:

| Signal            | Weight |
| ----------------- | ------ |
| Primary role      | 3–5    |
| Primary challenge | 4–5    |
| Secondary signal  | 1–3    |
| Primary hotspot   | 3–4    |
| Explicit interest | 6      |
| `minimumScore`    | 3      |

Allowed placeholders: `{persona}`, `{challenges}`, `{facilityType}`, `{scenes}`, `{hotspots}`,
`{interests}`, `{solution}`. Spanish and English must use the same set. If any placeholder has no match,
`fallbackExplanation` is used.

---

## 8. Lead scoring (internal, server-only)

- Module `src/server/lead-scoring.ts` begins with `import "server-only"`; config in
  `config/lead-scoring.json` is imported only there, so it cannot be bundled into client code.
- Inputs: persona (decision-influence weight), number of challenges, explicit interests, scenes/hotspots
  engaged, facility type, follow-up consent, free-mail domain flag.
- Output: `{ score: 0–100, tier: "A" | "B" | "C", factors: [{ code, points }] }`, stored on `Lead`.
- **Never** returned by `/api/leads`, rendered in the kiosk, or included in the report. Visible only in
  admin views and CSV export. A test asserts the API response schema excludes these fields (AC-16).

---

## 9. Server architecture

### 9.1 Route handlers

| Method + path                      | Purpose                                      | Request validation             | Response                                              |
| ---------------------------------- | -------------------------------------------- | ------------------------------ | ----------------------------------------------------- |
| `GET /api/health`                  | Readiness: app, config, content, database    | —                              | `HealthReport` (see §9.1.1) ✅                        |
| `POST /api/sessions`               | Store anonymous session summary (sendBeacon) | Zod `SessionSummary` (C1 only) | `204` (planned)                                       |
| `POST /api/leads`                  | Store lead + session summary + pending email | Zod `LeadSubmission` + content | `201`/`200 { statusToken, emailQueued, replayed }` ✅ |
| `GET /api/leads/status/:token`     | Report-delivery state for an opaque token    | `StatusTokenSchema`            | `200 { submission, report }` / `404` ✅               |
| `GET /api/admin/leads.csv`         | CSV export                                   | Admin auth                     | `text/csv`                                            |
| `GET /api/admin/outbox`            | Outbox status                                | Admin auth                     | JSON                                                  |
| `POST /api/admin/outbox/:id/retry` | Force retry                                  | Admin auth                     | JSON                                                  |

All handlers run on the Node.js runtime. Payload size limits are enforced (16 KB for leads); unknown fields
are rejected (`z.strictObject`). There is **no** endpoint that lists leads: `/api/leads` exports only
`POST` (GET answers 405) and exports run from the CLI (§14, ADR-024). Admin routes are Phase 9.

#### 9.1.1 Health report (`src/types/health.ts`)

```jsonc
{
  "status": "ok | degraded | error", // HTTP 200 for ok/degraded, 503 for error
  "ready": false, // true only when config, content and database are all ready
  "timestamp": "…",
  "app": {
    "name": "Linde Sphere",
    "version": "0.1.0",
    "environment": "development",
    "contentMode": "demo",
    "uptimeSeconds": 4,
  },
  "configuration": { "status": "valid | invalid", "invalidVariables": ["SMTP_HOST"] }, // names only
  "content": { "status": "valid | invalid | unknown", "version": "0.1.0", "errorCount": 0 },
  "database": {
    "status": "ready | not_initialized | unavailable",
    "engine": "sqlite",
    "reason": "database_file_missing",
  },
}
```

`Cache-Control: no-store`. No values, paths, URLs or personal data. The database probe opens the SQLite
file read-only with Node's built-in `node:sqlite` and never creates it. `ready` requires every folder in
`prisma/migrations` to be recorded as applied in `_prisma_migrations` (ADR-052). Reasons:
`database_file_missing`, `migrations_not_applied`, `migrations_pending` (all `not_initialized` → overall
`degraded`), `migration_failed`, `database_unreadable` (`unavailable` → overall `error`).

### 9.2 `POST /api/leads` flow (ADR-052)

```
route handler (src/app/api/leads/route.ts)
  ─► lead-http: content-type JSON, ≤ 16 KB, JSON parse               → 415 / 413 / 400
  ─► lead-service.submitLead
       Zod LeadSubmissionSchema (strict; normalizes email: trim + lower-case)   → 422 { issues: field, code, message }
       check against served content: consent version, role id, interest ids,
       session start not in the future                                         → 422
       fingerprint = SHA-256(normalized payload without submittedAt)
       existing lead with this idempotencyKey?  same fingerprint → replay 200 · different → 409
       keep only signal ids that exist in content; recompute recommendations (ADR-025)
       build ReportPayload + render HTML/text in the visitor's language (ADR-054; null if impossible)
       lead-repository.createSubmission  ── ONE transaction ──
           upsert VisitorSessionSummary (+ replace its SessionSummaryItems)
           create Lead · createMany LeadInterest · create Report
           create EmailDelivery(status=pending) + EmailDeliveryEvent(queued)
           (no report → EmailDelivery failed REPORT_UNAVAILABLE + gave_up; lead still stored)
       unique violation on idempotencyKey (two taps raced) → answer as replay
       onDeliveryQueued(deliveryId) → outbox.schedule (setTimeout 0; never awaited by the request)
  ─► 201 { statusToken, emailQueued: true, replayed: false }
```

The response is sent **after** the transaction commits and **before** any email attempt. Email failures
only ever update the `EmailDelivery` row (`email-delivery-repository.recordAttempt`), so they cannot roll
back or block a stored lead. The status token is `base64url(HMAC-SHA256(idempotencyKey, "lead-status:v1:" +
leadId))`: unguessable, re-derivable for replays, and only its SHA-256 hash is stored.

**Layers.** Route handlers → `src/server/leads/lead-http.ts` (HTTP mapping) → `lead-service.ts` (use case)
→ `lead-repository.ts` / `email-delivery-repository.ts` (the only Prisma users besides `db/client.ts`) →
Prisma client (`src/generated/prisma`, git-ignored) with the `better-sqlite3` driver adapter. UI code never
imports `src/server/db` or `src/server/leads`; `tests/unit/db/layer-boundaries.test.ts` enforces this.

### 9.3 Data model (Prisma, SQLite) — `prisma/schema.prisma`

| Model                   | Fields                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Lead`                  | `id`, `createdAt`, `updatedAt`, `firstName`, `lastName`, `organization`, `roleLabel` (Spanish persona label), `businessEmail` (normalized), `optionalPhone?`, `preferredLanguage`, `sessionId` → summary, `reportConsent` (always true), `followUpConsent`, `consentTextVersion`, `source`, `status` (`active`/`archived`/`erasure_requested`), `idempotencyKey` (unique), `requestFingerprint`, `statusTokenHash` (unique), `contentVersion` |
| `LeadInterest`          | `id`, `leadId` (cascade), `category` (`role`/`challenge`/`solution`), `value` (content id), `relevance?` (`high`/`medium`/`possible`, recommendations only — never a score), `sourceType` (`session_selection`/`explicit_interest`/`form_selection`/`recommendation`); unique per lead+category+value+source                                                                                                                                  |
| `VisitorSessionSummary` | `id`, `sessionId` (unique, anonymous UUID), `startedAt`, `completedAt?`, `selectedPersona?`, `contentVersion`, timestamps                                                                                                                                                                                                                                                                                                                     |
| `SessionSummaryItem`    | `id`, `summaryId` (cascade), `kind` (`challenge`/`scene`/`hotspot`/`recommendation`), `value`, `position`; unique per summary+kind+value — de-duplicated sets, not an event stream                                                                                                                                                                                                                                                            |
| `EmailDelivery`         | `id`, `leadId` (cascade), `provider` (`preview`/`smtp`/`graph`), `status` (`pending`/`sent`/`failed`/`retrying`), `attempts`, `lastAttemptAt?`, `nextAttemptAt?`, `providerMessageId?`, `errorCode?` (sanitized UPPER_SNAKE code), `claimedAt?` (atomic send claim), timestamps                                                                                                                                                               |
| `EmailDeliveryEvent`    | `id`, `deliveryId` (cascade), `eventType` (`queued`/`attempt_started`/`sent`/`attempt_failed`/`retry_scheduled`/`gave_up`/`manual_retry`), `attempt`, `occurredAt`, `errorCode?`, `providerMessageId?` — append-only, codes only                                                                                                                                                                                                              |
| `Report`                | `id`, `leadId` (unique, cascade), `language`, `subject`, `html`, `text`, `contentVersion`, `copyVersion`, `createdAt` — rendered once at lead time (ADR-013), so retries send exactly what was promised; contains the visitor's name and organization                                                                                                                                                                                         |

Indexes: `Lead(createdAt)`, `Lead(sessionId)`, `Lead(businessEmail)`, `LeadInterest(category, value)`,
`EmailDelivery(status, nextAttemptAt)`, `EmailDelivery(leadId)`. Enums are `TEXT` in SQLite, so the initial
migration adds hand-written `CHECK` constraints for every enum column, `attempts ≥ 0`, the error-code shape
and `reportConsent = 1`; a schema test fails if a later migration drops them. Never stored: credentials,
raw provider responses or messages, recipient copies, patient information, free text, behaviour streams,
lead scores.

**Deferred:** `RecommendationSnapshot` (the stored `Report` plus `SessionSummaryItem` recommendation ids
cover it for now), `ConsentRecord` rows (exact text and language per consent) and `AdminAuditLog` (Phase 9).
The consent wording is identified by `consentTextVersion` (texts are versioned in `content/consent.json`).
Migration 2 redefines `EmailDelivery` (provider `file` → `preview`, `claimedAt`) and re-creates every
`_check` constraint; an upgrade test covers existing databases.

**Operations.** `npm run db:deploy` (apply migrations), `db:migrate` (create a migration in development),
`db:seed` (synthetic data; refuses `NODE_ENV=production`), `db:backup` (online SQLite backup),
`db:export` (CSV). See README → Database.

### 9.4 Email outbox and worker (ADR-011, ADR-054) — `src/server/email/email-outbox.ts`

```
lead stored (transaction: Lead + Report + EmailDelivery pending + event queued)
  └─► schedule(id) right after the response      periodic worker (instrumentation.ts, every 15 s)
         └──────────────► processDelivery(id) ◄──── processDue(): ≤ 10 due deliveries per tick
                            claim: UPDATE … SET claimedAt WHERE id AND status IN (pending, retrying)
                                   AND due AND (claimedAt IS NULL OR stale > 5 min)   → else "skipped"
                            load stored Report + lead address → provider.send
                            ok   → sent (providerMessageId)                     events: attempt_started, sent
                            fail → sanitizeEmailError → retrying (nextAttemptAt) | failed
                                                                    events: attempt_failed, retry_scheduled | gave_up
```

- **Bounded:** backoff 1, 2, 4, 8 … min capped at 1 h; after `EMAIL_MAX_ATTEMPTS` (default 12) or a permanent
  error (auth, recipient rejected, 5xx, no report) the delivery is `failed` and never picked automatically
  again. Each tick handles at most one batch; ticks never overlap; nothing re-schedules itself.
- **Exactly one sender:** the claim is a single conditional `UPDATE`, so two workers (or two server
  processes sharing the database) never send the same message twice; a claim abandoned by a crash expires.
- **Manual retry:** `npm run email:retry -- --delivery <id> | --all-failed` (local CLI, ADR-024) claims even
  `failed` deliveries for **one** immediate attempt, recorded as `manual_retry`. Sent deliveries are never
  re-sent. `npm run email:status` lists counts and deliveries needing attention (ids and codes only).
- **Errors:** providers throw; the outbox stores `sanitizeEmailError(error).code` only (`NETWORK_TIMEOUT`,
  `TLS_FAILURE`, `PROVIDER_AUTH_FAILED`, `SMTP_TRANSIENT_FAILURE`, `SMTP_PERMANENT_FAILURE`, …). Logs carry
  delivery id, provider, attempt and code.

### 9.5 Email providers — `src/server/email/`

```ts
interface EmailProvider {
  readonly name: "preview" | "smtp" | "graph";
  readonly deliversExternally: boolean;
  send(message: { to; from; replyTo?; subject; html; text }, meta: { deliveryId }): Promise<{ messageId }>; // throws on failure
}
```

| Provider                     | `EMAIL_PROVIDER`    | Behaviour                                                                                                                                                                                                    |
| ---------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `DevelopmentPreviewProvider` | `preview` (default) | Builds the full MIME message (nodemailer stream transport) and writes `<stamp>-<deliveryId>.eml/.html/.txt` + `index.html` to `EMAIL_PREVIEW_DIR` (mode 600). Never sends. File names hold no personal data. |
| `SmtpProvider`               | `smtp`              | nodemailer SMTP: implicit TLS (`SMTP_SECURE=true`) or **required** STARTTLS; TLS ≥ 1.2, certificates verified, 10/10/20 s timeouts, no file/URL access. Env-only credentials (server-only module).           |
| `GraphProvider`              | `graph`             | Stub. Rejected by env validation at startup; `send` throws `PROVIDER_NOT_CONFIGURED`. Needs an Entra ID app registration, Mail.Send with admin consent and a mailbox policy before it can exist.             |

`createEmailProvider(env)` selects the provider; `GET /api/health` reports `email.provider` and
`email.deliversExternally`. `SMTP_REQUIRE_TLS=false` (plain SMTP to a local test server) is refused when
`NODE_ENV=production`.

### 9.6 Report builder and renderer — `src/server/report/`

- **`buildReportPayload`** (pure) turns the lead contact, role, priorities (session + form challenges), the
  scenes where content was opened (evidence, ADR-051) and the **server-recomputed** primary recommendations
  (≤ 3) into the strict `ReportPayload`. Content comes from `visibleContent(mode)`, so internal notes and
  sales-review data are already gone; resources are **validated assets with public https URLs only**;
  demo-mode (assumed) items are marked "pendiente de validación local" with the notice, and the schema
  rejects pending items in production. Configurable copy (title, subject, intro, consultation CTA, sales
  contact, disclaimer, privacy footer, pending notice) comes from `content/report.json` (versioned,
  `validationStatus`, claim-scanned, production requires `validated` and a sales contact).
- **`renderReport`** produces the subject, email-safe HTML (600 px table layout, inline styles, mobile media
  query, print styles, no scripts/images/remote CSS, every value escaped, links limited to validated https
  resources and the `mailto:` CTA) and a plain-text alternative, in the visitor's language (labels in
  `report-messages.ts`). The CTA link carries only the report subject — no visitor data.
- Excluded by construction: scores or relevance numbers, internal notes, session events, hotspot ids, lead
  or session ids, other visitors' data. Tests assert each of these.
- `npm run email:preview` renders ES/EN samples from fictitious data for design review.

---

## 10. Privacy and security boundaries

| Boundary           | Rule                                                                                                                                                                                                  | Enforcement                                                                                                           |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Client persistence | No PII or session data in `localStorage`/`sessionStorage`/IndexedDB/cookies                                                                                                                           | Code review + E2E assertion after reset (AC-28)                                                                       |
| Client memory      | Lead draft exists only while the form is mounted; cleared once stored; hard reload on reset                                                                                                           | `LeadFormScreen` local state; component + E2E tests assert no contact data after reset                                |
| Browser history    | No history entries; reset uses `location.replace`                                                                                                                                                     | Single-route design                                                                                                   |
| Autofill           | Disabled/discouraged on lead form; kiosk Chrome autofill off                                                                                                                                          | Form attributes + runbook                                                                                             |
| Commercial data    | Lead score/tier/factors never leave the server except admin/CSV                                                                                                                                       | `server-only` imports; response schema test; bundle grep in CI                                                        |
| Admin surface      | Disabled unless `ADMIN_ENABLED=true`; configurable path; scrypt-hashed passphrase + in-memory session cookie (MVP only); not linked; `noindex`, `no-store`                                            | `proxy.ts` rewrite/404 + `requireAdmin` in pages + guarded handlers (same origin, session, confirmation)              |
| Logs               | Never log names, emails, phones, or payload bodies; log IDs and status codes only                                                                                                                     | `src/server/logging/logger.ts` masks personal keys and any email-looking string; tests assert no contact data in logs |
| Secrets            | `.env` only, git-ignored; nothing sensitive in `NEXT_PUBLIC_*`                                                                                                                                        | `env.ts` Zod schema; `.env.example`                                                                                   |
| PHI                | Not collected; no free-text fields in visitor flow                                                                                                                                                    | Form design (ADR-020)                                                                                                 |
| External requests  | Kiosk loads only same-origin assets                                                                                                                                                                   | Self-hosted fonts; E2E network assertion (AC-31)                                                                      |
| Data at rest       | SQLite file on an encrypted laptop disk                                                                                                                                                               | Runbook (BitLocker)                                                                                                   |
| Retention          | Export then purge after the agreed period — period **not decided** (Q7)                                                                                                                               | `LEAD_RETENTION_DAYS` placeholder (unset = none configured); no automatic deletion; purge script later                |
| Input abuse        | Zod strict schemas, 16 KB limit, JSON-only, idempotency, same-origin required, rate limits (10/min per client, 60/min overall)                                                                        | `lead-http.ts`; `lead-service.ts`; `src/server/http/request-guards.ts` (ADR-057)                                      |
| Network origin     | Host allowlist (loopback, private IPv4, `.local`, `ALLOWED_HOSTS`) against DNS rebinding                                                                                                              | `proxy.ts` (421 otherwise)                                                                                            |
| Headers            | CSP `default-src 'self'` (no remote origins, no frames, `object-src 'none'`, `form-action 'self'`), X-Frame-Options, nosniff, no-referrer, COOP/CORP, sandboxed `/assets/*`; no HSTS (plain-HTTP LAN) | `next.config.ts`; E2E asserts no CSP violations during a full visit                                                   |
| Static assets      | Media-type allowlist; SVG scan for scripts, handlers, `javascript:`, foreignObject, external references; future uploads must follow the same rules                                                    | `content:check` (`asset-safety.ts`)                                                                                   |
| Client bundle      | No server secrets or server-only modules in `.next/static`                                                                                                                                            | `npm run security:bundle`                                                                                             |
| Dependencies       | `npm run security:audit` on the runtime tree; Prisma CLI's `mysql2`/`deepmerge-ts` advisories patched with `overrides`                                                                                | `package.json`                                                                                                        |

---

## 11. Internationalization

- Languages: `es` (default, source of truth) and `en`.
- UI strings: typed TypeScript dictionaries `src/data/i18n/es.ts` (`as const`) and `en.ts` (typed as
  `Messages`, so a missing or extra key is a **compile error**). A unit test also checks key and
  placeholder parity at runtime (ADR-035).
- Lookup: `translate(language, key, params)` in `src/lib/i18n/translate.ts`. Keys are typed dot-paths
  (`"status.retry"`), and `{name}` placeholders are interpolated. Unknown keys fall back to Spanish, then
  to the key (never throws in the UI).
- `LanguageProvider` / `useLanguage()` (`src/features/language/`) holds the language **in memory only**
  and exposes `t()` and `localize()` for content `{ es, en }` fields. It never uses cookies or storage, so
  every page load and kiosk reset starts in Spanish.
- `LanguageSwitcher`: two large buttons (`aria-pressed`, own-language labels), with a polite live-region
  announcement.
- `<html lang>` updates with the active language.
- `global-error.tsx` renders outside the provider and shows both languages.
- The report is rendered in the lead's `preferredLanguage`.

---

## 12. Branding and theming

- `src/lib/config/brand-config.ts` holds the product name ("Linde Sphere"), localized tagline,
  organization name (null), logo (null), the color palette and `approvalStatus: "placeholder"`, all
  validated by a Zod schema at load (ADR-036). **No corporate logo or brand mark is committed.** The header
  renders a text wordmark with a generic ring glyph.
- Colors are emitted as `--brand-*` CSS variables on `<html>` by the root layout and mapped to Tailwind 4
  theme tokens (`bg-canvas`, `text-ink`, `bg-primary`, …) in `src/styles/globals.css`. Rebranding means
  editing the config, not components.
- Default palette: calm clinical teal-blue on light neutrals. A unit test verifies WCAG AA (≥ 4.5:1) for
  every text/background pair.
- Typography: the system sans-serif stack (Segoe UI on Windows, Roboto on Android). No web-font download
  (ADR-018). Fluid base size `clamp(16px, 0.75rem + 1vmin, 24px)` gives about 23 px on the kiosk and 16 px
  on phones.
- App-wide settings (default language, kiosk design viewport, touch-target sizes, idle timings,
  recommendation limits) live in `src/lib/config/app-config.ts`. It is client-safe and holds no secrets.

---

### 12.1 Touchscreen design system (ADR-044)

**Tokens** (`src/styles/tokens.css`, Tailwind 4 `@theme`):

| Group      | Tokens (utility examples)                                                                                                                                                                                                                          |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Color      | `canvas`, `surface`, `surface-muted`, `ink`, `ink-muted`, `primary`/`on-primary`, `accent`, `line`, `focus`, `info`, `success`, `notice`, `danger` (+ `-surface`), `overlay`. All map to `--brand-*` from brand-config; AA contrast is unit-tested |
| Typography | `text-caption` 1rem (the minimum), `text-label` 1.125, `text-body` 1.25, `text-lead` 1.5, `text-title` 1.875, `text-headline` 2.5, `text-display` clamp(2.5–5.5rem). With the fluid root, body text is about 29 px on the kiosk                    |
| Spacing    | `touch-min` 3rem (48 px floor), `touch` 4rem (64 px default), `touch-lg` 5rem; `gutter` clamp(1rem, 6vw, 4.5rem); `stack` clamp(1rem, 2.5vh, 2.5rem)                                                                                               |
| Radius     | `rounded-control` 1rem, `rounded-card` 1.5rem, `rounded-sheet` 2rem                                                                                                                                                                                |
| Shadow     | `shadow-card`, `shadow-raised`, `shadow-sheet` (subtle; no glass, blur or glow)                                                                                                                                                                    |
| Motion     | `ease-standard`, `ease-emphasized`; `--duration-fast/base/slow` (120/200/320 ms); `animate-pulse-ring`, `animate-sheet-in`, `animate-fade-in`, always under `motion-safe:`, plus a global reduced-motion override                                  |
| Focus      | `focus-ring` utility: 4 px solid `focus` outline, 3 px offset, on `:focus-visible`                                                                                                                                                                 |

**Components** (`src/components/`). Content strings arrive already localized from the caller; chrome labels
use `useLanguage()`:

| Component                                                  | Notes                                                                                                                                                              |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `AppShell`, `KioskHeader`, `LanguageToggle`                | Portrait column (max 1080 px). Header holds the configured wordmark (a logo only if approved and local), an actions slot and ES/EN toggle buttons (`aria-pressed`) |
| `PrimaryAction`, `SecondaryAction`                         | Filled / outlined; `md` 56 px, `lg` 64 px (default), `xl` 80 px; `type="button"` by default                                                                        |
| `TouchCard`, `PersonaCard`, `ChallengeCard`                | ≥ 96 px toggle cards (`aria-pressed`); disabled cards stay focusable (`aria-disabled`) and explain why (challenge limit)                                           |
| `ProgressIndicator`, `SceneBreadcrumb`                     | "Step 2 of 4" text + segments (`aria-current="step"`); breadcrumb `nav` with ancestor buttons and `aria-current="page"`                                            |
| `HotspotButton`                                            | Positioned by % on the art box; 56–80 px marker by importance; always-visible label kept inside the box; pulse only when motion is allowed and not yet visited     |
| `RecommendationCard`, `SolutionPanel`                      | "Why this appeared" always visible, no scores; pending-validation badge; explicit-interest toggle (`aria-pressed`)                                                 |
| `BottomActionBar`                                          | Sticky bottom region for primary actions within reach on a tall screen                                                                                             |
| `Modal`, `Sheet`                                           | Native `<dialog>` + `showModal()`: focus containment, Esc, inert background, focus return; `data-autofocus` sets initial focus                                     |
| `InactivityWarning`, `ResetExperienceButton`               | Countdown modal (presentational; timer in Phase 4); reset requires confirmation                                                                                    |
| `FormField`, `ConsentCheckbox`                             | Visible labels, hint and error through `aria-describedby`, `aria-invalid`; autofill off; consent text passed in from content                                       |
| `StatusBanner`, `LoadingState`, `EmptyState`, `ErrorState` | Icon + text (color never alone); errors use `role="alert"`, others `role="status"`                                                                                 |

**Gallery:** `/dev/components` renders every component with real seed content and live engine output. It
is available with `npm run dev`. In production it answers HTTP 404 from `src/proxy.ts` (and again in the
page) unless `ENABLE_COMPONENT_GALLERY=true` (ADR-045). It is never linked and is marked `noindex`.

**Readiness:** `useHydrated()` (`useSyncExternalStore`) tells a page when it is interactive. The root
`loading.tsx` Suspense boundary hydrates pages separately from the layout, so pages expose their own
readiness marker (the gallery uses `data-ready`); `<html data-hydrated>` covers the shell.

---

## 13. Visual and motion system (Hospital Explorer)

Implemented in `src/features/explorer/` (ADR-049). No Three.js, Babylon.js, WebGL or free camera.

- **Art box:** every layer is drawn on `SCENE_ART` (1200 × 1500, 4:5, `domain/content/scene-art.ts`).
  The viewer sizes the box with container units, `min(100cqw, 100cqh × 0.8)` by
  `min(100cqh, 100cqw × 1.25)`, so it fits any container while keeping the ratio. Hotspot `x`/`y` are
  percentages of this box and land on the same feature at every size.
  - The box uses `overflow: clip`: a `hidden` box can be scrolled by focus, which would shift every marker.
- **Layers:** the background `<img>` has the content's alt text. Foreground layers are decorative
  (`alt=""`) and settle in with a small depth-based offset (`--layer-depth`). Hotspots sit above all layers.
- **Hotspot layout (`hotspot-layout.ts`, pure):**
  - The viewer measures the box (ResizeObserver) and computes marker sizes from the root font size.
  - Overlapping markers are pushed apart symmetrically, deterministically and never outside the box. The E2E
    tests check that no two markers overlap in any seed scene at kiosk, laptop or phone size.
  - Label placement is below by default, or above when that avoids the box edge or another marker or label.
    Alignment (start, center or end) keeps labels inside the box.
  - Art boxes narrower than 36 rem use compact markers (3.5/3/3 rem, never below 48 px).
- **Labels:** always visible for primary and navigation hotspots on regular art. For the rest, and for
  everything on compact art, labels show on touch (`:active`), keyboard focus, hover, or while the
  hotspot's panel is open. The accessible name always contains the label.
- **Transitions (`scene-navigation.ts`):**
  - Into a child scene: zoom-in from the touched hotspot.
  - Up to an ancestor: zoom-out, anchored at the child's hotspot in that ancestor.
  - Sibling: 12 % pan, direction from the hotspot's side.
  - Each is 560 ms, animating only `transform` and `opacity`. The outgoing scene is kept, inert and
    `aria-hidden`, just for that time.
- **Reduced motion:** used when the OS setting is on or the visitor chose it (`useReducedMotion`). There is
  no outgoing layer and no enter animation (the scene swaps instantly), and pulse and settle are disabled
  through `motion-safe:` and `html[data-motion=reduce]`.
- **Panels:** information hotspots open a bottom sheet with a title, body and bullets. Solution hotspots
  open `SolutionPanel` with "Añadir a mis intereses". A panel open for 6 s
  (`kiosk.hotspotEngagementMs`) dispatches `ENGAGE_HOTSPOT`.
- **Navigation:**
  - The breadcrumb shows ancestors as buttons; the current scene is the h1, and the breadcrumb's copy of it
    is visually hidden.
  - "Volver" goes up one level; from the campus it leaves the explorer, to the next steps after the role
    journey and to the welcome screen otherwise.
  - Focus moves to the new scene's h1.
  - The explorer reopens on the last scene visited in the session.
- **Relevant areas:** after the role journey, navigation hotspots that lead to the recommendations' areas get
  an accent badge, an always-visible label and "Relevante para usted" in their accessible name.
- **Readiness (§7.8):** "Ver mis recomendaciones" appears once `RecommendationReadiness` says recommendations
  are ready, or when the visitor has already seen them. Before that, a live progress line counts the
  meaningful hotspots still needed.
- **Calibration (`/dev/scenes`):** a developer tool (English only). Tapping the art shows normalized x/y (to
  0.1 %) over a 10 % grid with every authored hotspot center, and "Copy coordinates" copies `"x": …, "y": …`.
  Over plain HTTP, where the Clipboard API is unavailable, it falls back to select-and-copy.
- **Placeholder art (`scripts/placeholder-art.ts`):** flat isometric shapes in the neutral placeholder
  palette, drawn from code with no reference art. Each drawing registers the anchor of every hotspot it
  depicts. `npm run art:placeholders -- --sync-content` writes those anchors into `content/scenes`.

---

## 14. Administration and operations

| Capability            | Primary (no network exposure)                              | Secondary (optional, guarded web UI)             |
| --------------------- | ---------------------------------------------------------- | ------------------------------------------------ |
| CSV export            | `npm run db:export -- --out leads.csv` ✅                  | Admin → Exportaciones ✅ (confirmation required) |
| Database backup       | `npm run db:backup` ✅ (SQLite online backup)              | Admin → Descargar respaldo ✅                    |
| Outbox status / retry | `npm run email:status` / `email:retry` ✅                  | Admin → lead detail → Reintentar ✅              |
| Purge after retention | `npm run leads:purge` (needs Q7)                           | — (no delete in the MVP)                         |
| Content readiness     | `npm run content:check -- --mode production`               | Admin → Contenido pendiente ✅                   |
| Sales review export   | `npm run content:export` (CSV + CONTENT_VALIDATION.md §11) | Admin → Exportaciones ✅                         |

### 14.1 Local administration utility (ADR-056)

- **Boundary:** off unless `ADMIN_ENABLED=true` and `ADMIN_PASSPHRASE_HASH` is set. The public path is
  `ADMIN_PATH` (default `/admin-local`); `proxy.ts` rewrites it to the internal `src/app/admin-console`
  segment and answers 404 for `/admin-console` itself, so the pages are reachable only through the
  configured path. Never linked from visitor screens; responses are `no-store` and `noindex`. The kiosk shell
  lives in `(kiosk)/layout.tsx`, so admin pages share nothing with the visitor experience but the root document.
- **Protection (MVP, not enterprise authentication):** one passphrase, configured only as an scrypt hash
  (`npm run admin:passphrase`); sign-in sets a random 256-bit token (only its SHA-256 kept in memory) in an
  `HttpOnly; SameSite=Strict` cookie scoped to `ADMIN_PATH` (`Secure` over HTTPS), 30 min idle / 8 h absolute.
  Five consecutive failures lock sign-in (1 min, doubling to 15 min). Every POST must be same-origin (Origin/
  Referer vs Host, or `Sec-Fetch-Site: same-origin` when the browser sends `Origin: null` under
  `Referrer-Policy: no-referrer`). **Production requires approved authentication and a security review.**
- **Features:** aggregate counts; filters (date range in Puerto Rico time, lead status, delivery state,
  exported) in the query string — dates and statuses only; lead detail (business contact, interests,
  delivery state and history); retry of a failed or retrying delivery (one manual outbox attempt); mark as
  exported (`Lead.exportedAt`, migration 3); confirmed CSV exports (one row per lead, or one per interest;
  optionally mark as exported) and the content-validation list; database backup (SQLite online backup into
  a private temp file, streamed, deleted); content items pending validation. **No delete.**
- **Privacy:** no raw database route (the file lives in `data/`, never under `public/`); exports and
  backups are generated per request as `no-store` attachments after a confirmation checkbox; lead ids are
  opaque UUIDs, so URLs carry no personal data; audit log lines (`admin.login`, `admin.export`,
  `admin.retry`, `admin.backup`, `admin.mark_exported`) contain counts, filters and ids only.
- **CSV:** one writer (`src/lib/csv.ts`): RFC 4180 quoting, UTF-8 BOM, CRLF, and an apostrophe before any
  cell a spreadsheet could evaluate (`= + - @`, tab, CR — also after leading spaces and in full-width forms).

---

## 15. Configuration (environment variables)

| Variable                                                              | Default                       | Purpose                                                           |
| --------------------------------------------------------------------- | ----------------------------- | ----------------------------------------------------------------- |
| `DATABASE_URL`                                                        | `file:./data/linde-sphere.db` | SQLite location                                                   |
| `CONTENT_MODE`                                                        | `demo`                        | `production` \| `demo`                                            |
| `CONTENT_PREVIEW_PLACEHOLDERS`                                        | `false`                       | Dev-only placeholder preview                                      |
| `EMAIL_PROVIDER`                                                      | `preview`                     | `preview` (local files, never sends) \| `smtp`; `graph` rejected  |
| `EMAIL_FROM` / `EMAIL_REPLY_TO`                                       | —                             | Sender identity                                                   |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` / `SMTP_USER` / `SMTP_PASS` | —                             | SMTP provider                                                     |
| `EMAIL_MAX_ATTEMPTS`                                                  | `12`                          | Outbox retry ceiling                                              |
| `SMTP_REQUIRE_TLS`                                                    | `true`                        | STARTTLS required when not `SMTP_SECURE`; `false` refused in prod |
| `EMAIL_PREVIEW_DIR`                                                   | `data/email-preview`          | Development preview output                                        |
| `EMAIL_WORKER_INTERVAL_MS`                                            | `15000`                       | Retry worker tick                                                 |
| `LEAD_RETENTION_DAYS`                                                 | — (undecided)                 | Retention placeholder; nothing is deleted automatically (ADR-052) |
| `ADMIN_ENABLED`                                                       | `false`                       | Enable the local administration utility                           |
| `ADMIN_PATH`                                                          | `/admin-local`                | Public admin path (one segment)                                   |
| `ADMIN_PASSPHRASE_HASH`                                               | —                             | scrypt hash (`npm run admin:passphrase`); required if enabled     |
| `ADMIN_SESSION_MINUTES`                                               | `30`                          | Admin idle sign-out                                               |
| `DEV_ALLOWED_ORIGINS`                                                 | —                             | Extra dev-server HMR hostnames (comma list)                       |
| `ENABLE_COMPONENT_GALLERY`                                            | `false`                       | Allow `/dev/components` in production builds                      |
| `ENABLE_SCENE_CALIBRATION`                                            | `false`                       | Allow `/dev/scenes` (coordinate calibration) in production builds |

All are parsed by `src/server/env.ts` (Zod) in `instrumentation.ts` at server boot. The server refuses
to start on invalid configuration (e.g., `EMAIL_PROVIDER=smtp` without `SMTP_HOST`), and errors name
variables but never echo values. Empty values count as unset. `CONTENT_PREVIEW_PLACEHOLDERS` is forced
off in production. The port and host are CLI flags (`-p`, `-H`) set by the npm scripts, not env
variables (ADR-037). `.env.example` lists every variable without secrets.

---

## 16. Testing strategy

| Layer       | Tooling                                                                              | Scope                                                                                                                                                                                                                                                                        |
| ----------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Static      | `tsc --noEmit`, ESLint, Prettier check                                               | Whole project                                                                                                                                                                                                                                                                |
| Content     | `content:check` (Zod + cross-reference + translation + prohibited-claim scan)        | `content/`                                                                                                                                                                                                                                                                   |
| Unit        | Vitest (node)                                                                        | Engine (determinism, reasons, caps, tie-breaks, fallback), visibility filter, lead scoring, signal normalization, i18n parity, outbox backoff, CSV formatting, contrast tokens                                                                                               |
| Component   | Vitest `components` project (Testing Library + jsdom, `<dialog>` polyfill)           | Now: every design-system component (keyboard, ARIA state, focus, dialogs, forms). Later: reducer transitions, idle timer, lead form                                                                                                                                          |
| Integration | Vitest + temporary SQLite DB                                                         | `/api/leads` transaction, email failure keeps lead + retries, response excludes score, production mode filtering in report                                                                                                                                                   |
| E2E         | Playwright projects: kiosk 1080×1920 (touch), laptop 1440×900, phone 390×844 (touch) | Now: home, language switch, no persisted language, not-found, touch-target sizes, no overflow, kiosk fits without scroll, health. Later: quick path, discovery path, explore path, idle reset clears everything, production mode hides assumed content, no external requests |

Scripts: `lint`, `typecheck`, `format:check`, `test`, `test:e2e`, `content:check`, `check` (all fast checks).

---

## 17. Failure modes

| Failure                       | Behaviour                                                                                                      |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------- |
| No internet on laptop         | Journeys complete; emails queue; worker sends when connectivity returns                                        |
| SMTP rejects credentials      | Outbox retries with backoff, then `failed`; health endpoint and admin show counts; leads intact                |
| Kiosk loses Wi-Fi mid-journey | Client shows a friendly "reconnecting" state on submit; no data is sent twice (idempotency key per submission) |
| Laptop restarts               | SQLite persists; outbox resumes on boot; kiosk reload returns to Attract                                       |
| Invalid content deployed      | `content:check` fails in CI; server refuses to boot with a clear error                                         |
| Visitor walks away mid-form   | Idle countdown → reset; draft discarded; anonymous session stored as `timeout`                                 |
| Double-tap submit             | Button disabled on submit + server idempotency key on `sessionId`                                              |

---

## 18. Performance budgets

- Initial load on LAN ≤ 2 s to interactive on a mid-range Android device. This is checked by hand
  (MANUAL_KIOSK_TEST.md). E2E asserts < 8 s on the CI machine, as a gross-regression guard only.
- **First-load JS for the kiosk route:** < 250 KB gzipped, with no zod. `tests/e2e/kiosk-device.spec.ts`
  checks this against the build manifest.
  - The lead form and its validation library load lazily and are prefetched while idle (ADR-058).
  - Measured: see TASKS Phase 10a.
- **Third parties:** none. No request may leave the kiosk origin (E2E).
- **Scene layer assets:** SVG or WebP/AVIF at 1200 × 1500.
  - Per-file budgets (images ≤ 1 MB, SVG ≤ 512 KB) are enforced by `content:check`.
  - Target ≤ 300 KB per scene.
  - The placeholder art totals ~90 KB (~16 KB gzipped).
- **Scene images:** intrinsic `width`/`height`, `decoding="async"`, and `fetchpriority="high"` on the
  current background. Neighboring scenes are prefetched while idle.
- **Transitions:** 60 fps with no layout thrash. Keyframes animate transform and opacity only. Reduced
  motion removes them.
- **Report:** build and render in < 25 ms, with email HTML < 60 KB (unit test). The report is rendered
  before the storage transaction, never inside it.
- **Database:** one transaction per submission. The rollback journal with a 5 s busy timeout (WAL rejected
  in ADR-058: deferred Prisma transactions fail instead of waiting). Content is cached per process in
  production.
- **Re-renders:**
  - Idle tracking uses refs; activity events do not re-render.
  - Lead-form typing re-renders the form only.
  - Context values are memoized.
