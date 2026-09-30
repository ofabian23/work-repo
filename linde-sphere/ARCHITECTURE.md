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

**Installed so far (Phases 1–2):** Next.js 16.3.7, React 19.2, TypeScript 5.9, Tailwind 4, Zod 4.6,
`server-only`, Vitest 5, Playwright 1.63, tsx, ESLint 9 (`eslint-config-next`), Prettier 3. Prisma (Phase 7,
ADR-038), Motion (Phase 4/6), Nodemailer (Phase 8) and Testing Library (first component tests) are added in
the phases that first need them.

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
│  └─ settings.json · report.json · sales-contacts.json   (Phases 3–8)
├─ config/lead-scoring.json       # C3, server-only (Phase 3)
├─ prisma/ · prisma.config.ts     (Phase 7)
├─ public/assets/
│  ├─ brand/                      # approved brand files only (empty)                       ✅
│  └─ scenes/placeholder/         # placeholder SVG layers (drawn in Phase 6)               ✅ folder
├─ src/
│  ├─ app/
│  │  ├─ layout.tsx               # brand CSS vars, viewport, LanguageProvider, AppShell    ✅
│  │  ├─ page.tsx                 # home (foundation placeholder → Attract in Phase 4)      ✅
│  │  ├─ error.tsx · global-error.tsx · not-found.tsx · loading.tsx                        ✅
│  │  ├─ api/health/route.ts      # readiness JSON                                           ✅
│  │  └─ dev/components/page.tsx  # dev-only design-system gallery (gated, ADR-045)          ✅
│  ├─ components/                 # design system (§12.1)                                    ✅
│  │  ├─ shell/ (app-shell, kiosk-header, language-toggle, brand-wordmark)
│  │  ├─ actions/ (action-button: Primary/SecondaryAction, bottom-action-bar, reset-experience-button)
│  │  ├─ cards/ (touch-card, persona-card, challenge-card, recommendation-card)
│  │  ├─ navigation/ (progress-indicator, scene-breadcrumb) · explorer/ (hotspot-button)
│  │  ├─ content/ (solution-panel, pending-validation-badge) · overlay/ (dialog: Modal/Sheet, inactivity-warning)
│  │  ├─ forms/ (form-field, consent-checkbox) · feedback/ (status-banner, loading/empty/error-state)
│  │  └─ icons.tsx
│  ├─ features/home/ · features/status/ · features/dev-gallery/                              ✅
│  ├─ lib/config/{app-config,brand-config}.ts · lib/i18n/{translate,language-provider} · lib/{cn,csv,use-hydrated}.ts ✅
│  ├─ data/i18n/{es,en}.ts                                                                  ✅
│  ├─ types/{i18n,health}.ts                                                                ✅
│  ├─ styles/{tokens,globals}.css                                                          ✅
│  ├─ domain/                     # content/, session/, leads/, report/, email/                 ✅
│  │  ├─ recommendations/         # engine.ts, explanations.ts, engine-config.ts, result schema ✅
│  │  └─ review/content-review.ts # sales-review CSV rows + generated Markdown                 ✅
│  ├─ server/
│  │  ├─ env.ts · health.ts · database-probe.ts                                             ✅
│  │  ├─ content/load-content.ts  # fs loader (no `server-only` so CLI scripts can use it)  ✅
│  │  └─ db.ts · lead-scoring.ts · leads.ts · report/ · email/ · outbox/ · log.ts  (Phases 3–9)
│  ├─ instrumentation.ts          # validates env at server boot (outbox worker: Phase 8)   ✅
│  └─ proxy.ts                    # /dev/* gate (404 in production unless enabled) ✅; admin guard (Phase 9)
├─ scripts/content-check.ts · content-export.ts (+ lib/)   ✅ · leads-export / leads-purge / outbox-retry (Phase 9)
├─ exports/content-validation.csv # generated sales worksheet (UTF-8 BOM, CRLF; `.gitattributes -text`) ✅
├─ tests/
│  ├─ helpers/ · unit/content · unit/runtime · unit/app                                     ✅
│  ├─ components/                 # Testing Library + jsdom component tests                   ✅
│  ├─ e2e/{foundation,gallery}.spec.ts # Playwright: kiosk 1080×1920, laptop 1440×900, phone 390×844 ✅
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
            ┌────────┐ touch  ┌───────┐
  (boot) ──►│ATTRACT │──────►│ ENTRY │
            └────────┘        └─┬─┬─┬─┘
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

```ts
type KioskState = {
  sessionId: string; // random UUID, created on first touch
  language: "es" | "en"; // default "es"
  screen: Screen;
  entryPath: "role" | "challenge" | "explore" | null;
  signals: SessionSignals; // C1 anonymous signals (see §7.2)
  ui: { promptShown: boolean; activeSceneId: string | null; openHotspotId: string | null };
  lead: LeadDraft | null; // C2 — exists only while LEAD_FORM is mounted
};
```

Derived via selectors (not stored): `recommendations = recommend(signals, visibleContent)`,
`hasMinimumInfo`, `shouldShowPrompt`.

### 5.3 Reset and privacy guarantees

Reset is triggered by: completion (confirmation auto-timeout, default 15 s), inactivity countdown expiry,
or the discreet "Start over" action.

Reset procedure:

1. Send an anonymous session summary via `navigator.sendBeacon('/api/sessions', …)` (C1 only).
2. Clear the lead draft and all form refs; blur inputs (dismisses the on-screen keyboard).
3. `window.location.replace("/")` — a **hard reload** that discards all JS memory and replaces the
   history entry.

The client never writes to `localStorage`, `sessionStorage`, IndexedDB, or cookies. Form inputs use
`autocomplete="off"` and non-standard `name` attributes to discourage browser autofill on the shared device.

### 5.4 Idle timer

| Context                                        | Idle before warning | Countdown             | Configurable in |
| ---------------------------------------------- | ------------------- | --------------------- | --------------- |
| Attract                                        | none                | —                     | —               |
| Entry / selection / explorer / recommendations | 60 s                | 15 s ("¿Sigue ahí?")  | `app-config.ts` |
| Lead form                                      | 120 s               | 20 s                  | `app-config.ts` |
| Confirmation                                   | —                   | auto-reset after 15 s | `app-config.ts` |

Any `pointerdown`/`keydown` resets the timer. The warning overlay has a large "Continue" button.

### 5.5 Kiosk hardening (CSS/HTML)

`touch-action: manipulation` · `overscroll-behavior: none` · `user-select: none` (except inputs) ·
`-webkit-touch-callout: none` · `draggable="false"` on images · context menu suppressed ·
viewport `width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no` (ADR-022).

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
| `Persona` (`personas.json`)                        | `id`, `label`, `description`, `icon`, `sortOrder`, `suggestedChallengeIds[]` (ordering hint only), `validationStatus`                                                                                                                                                                                                                                                                                                          |
| `Challenge` (`challenges.json`)                    | `id`, `label`, `description`, `icon`, `sortOrder`, `validationStatus`                                                                                                                                                                                                                                                                                                                                                          |
| `FacilityType` (`facility-types.json`)             | `id`, `label`, `description`, `sortOrder`, `validationStatus`                                                                                                                                                                                                                                                                                                                                                                  |
| `Scene` (`scenes/<id>.json`)                       | `id`, `slug`, `title`, `description`, `background` (layer, depth 0), `foregroundLayers[]`, `hotspots[]`, `parentSceneId` (null = root), `breadcrumb[]` (root → self), `validationStatus`, `sortOrder`                                                                                                                                                                                                                          |
| `SceneLayer`                                       | `src` (root-relative path in `public/`), `alt` (localized), `depth` 0–1 (parallax), `assetStatus: approved \| placeholder` (does not gate visibility)                                                                                                                                                                                                                                                                          |
| `Hotspot` (in scene)                               | `id` (globally unique), `type: navigation \| solution \| information`, `x`/`y` 0–100 (center, % of art box), optional `width`/`height` (% hit area, must stay inside), `label`, `accessibleLabel`, `visualImportance: primary \| secondary \| tertiary`, `recommendationSignals {challengeIds[], solutionIds[]}`, `validationStatus`, plus by type: `targetSceneId` · `targetSolutionIds[]` · `panel {title, body, bullets[]}` |
| `Solution` (`solutions.json`)                      | `id`, `slug`, `title`, `summary`, `nextStep`, `relatedChallengeIds[]`, `relatedSceneIds[]`, `digitalAssetIds[]`, `isFallback`, **governance**                                                                                                                                                                                                                                                                                  |
| `DigitalAsset` (`digital-assets.json`)             | `id`, `title`, `description`, `type: brochure \| video \| web-page \| guide \| checklist`, `access: {kind:"url", url(https)} \| {kind:"local-file", path}`, `languages[]`, **governance**                                                                                                                                                                                                                                      |
| `RecommendationRule` (`recommendation-rules.json`) | see §7.3                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `ConsentTextSet` (`consent.json`)                  | `version`, `reportDelivery`, `salesFollowUp`, `privacyNotice` (localized), `validationStatus`, `internalNotes`                                                                                                                                                                                                                                                                                                                 |
| `ContentManifest` (`manifest.json`)                | `contentVersion` (semver), `defaultLanguage`, `updatedAt`                                                                                                                                                                                                                                                                                                                                                                      |

Planned content (later phases): `settings.json` (engine tuning), `report.json`
(CTA, disclaimer), `sales-contacts.json`. Branding and idle timings live in `src/lib/config/` (ADR-036).

### 6.3 Runtime schemas (not content)

| Schema                 | File                                              | Purpose                                                                                                                                        |
| ---------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `SessionSignals`       | `domain/session/visitor-session.ts`               | Anonymous C1 signals; unique ids; ≤ 3 challenges; engaged ⊆ opened hotspots                                                                    |
| `VisitorSession`       | same                                              | UUID, timestamps, language, entry path, content mode/version, outcome, signals                                                                 |
| `RecommendationResult` | `domain/recommendations/recommendation-result.ts` | 1–5 ranked items with matched signals, bilingual explanation, next step, `pendingValidation`; never pending in production; fallback only alone |
| `LeadSubmission`       | `domain/leads/lead-submission.ts`                 | Kiosk → server payload: minimum contact fields, separate consents (report consent required), consent version, signals (not recommendations)    |
| `LeadCreatedResponse`  | same                                              | `{ leadId, emailQueued }` only — no score                                                                                                      |
| `ConsentRecord`        | `domain/leads/consent-record.ts`                  | One record per consent type with exact text shown, version, language, timestamp                                                                |
| `ReportPayload`        | `domain/report/report-payload.ts`                 | Resolved report data in one language; strict (no score); https-only resources; notice required if pending                                      |
| `EmailDeliveryEvent`   | `domain/email/email-delivery-event.ts`            | Outbox lifecycle event; no recipient/body; sanitized error text (no email addresses)                                                           |

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

Implemented in `src/domain/recommendations/` (`engine.ts`, `explanations.ts`, `engine-config.ts`), ADR-041.

### 7.1 Properties

- **Pure and isomorphic:** `recommend(signals, publicContent, { maxResults }) → RecommendationResult | null`.
  No I/O, no clock, no randomness. The kiosk uses it for live display; the server recomputes it (ADR-025).
- **Deterministic:** stable ordering with explicit tie-breakers, independent of the order in which signals
  were collected. Sorting uses locale-independent comparisons.
- **Explainable:** every item lists its `matchedSignals` (`signalType`, `signalId`, `kind`, `weight`) and a
  plain-language **"Why this appeared"** sentence in ES and EN.
- **Versioned:** `ENGINE_VERSION` (`1.0.0`) and `contentVersion` travel with every result.
- Returns `null` only when nothing, not even the fallback, is visible (e.g., production mode before
  validation).

### 7.2 Signals

`SessionSignals` (schema in `domain/session/visitor-session.ts`):

```ts
type SessionSignals = {
  personaId: string | null;
  challengeIds: string[]; // unique, ordered by selection, max 3 (MAX_SELECTED_CHALLENGES)
  facilityTypeId: string | null;
  visitedSceneIds: string[]; // unique, in order
  openedHotspotIds: string[]; // unique
  engagedHotspotIds: string[]; // subset of opened; panel open ≥ threshold (bucketed, not raw ms)
  explicitInterestIds: string[]; // solution ids added via "Add to my interests"
};
```

Unknown or hidden ids are ignored. Raw timestamps are never used; dwell is reduced to "engaged" (ADR-023).

### 7.3 Rules (`content/recommendation-rules.json`)

Rules are data, one per non-fallback solution (ADR-028):

```jsonc
{
  "id": "rule-backup-emergency-supply",
  "solutionId": "backup-emergency-supply",
  "weights": {
    // 0 < weight ≤ 10, keys must reference existing ids
    "personas": { "government-system": 4, "executive": 3 },
    "challenges": { "emergency-preparedness": 5, "supply-continuity": 3 },
    "facilityTypes": { "public-health-system": 2 },
    "scenes": { "emergency": 2, "gas-plant": 1 },
    "hotspots": { "gas-plant-backup": 4, "emergency-surge-readiness": 3 },
    "explicitInterests": { "backup-emergency-supply": 6 }, // keyed by solution id
  },
  "minimumScore": 3, // must be reachable (checked, cap-aware)
  "exclusions": [], // e.g. { "signalType": "facilityTypes", "ids": ["homecare-organization"], "reason": "…" }
  "explanationTemplate": {
    // "relevance" sentence shown with the recommendation; placeholders optional
    "es": "Relevante para organizaciones que revisan o actualizan su plan de contingencia.",
    "en": "Relevant for organizations reviewing or updating their contingency plans.",
  },
  // "fallbackExplanation" is required only if the template uses placeholders
  "priority": 90, // tie-breaker, 1–100
  "validationStatus": "assumed",
  "internalNotes": "…",
}
```

Weighting convention in the seed rules: a primary persona 3–5, a primary challenge 4–5, secondary signals
1–3, a primary hotspot 3–4, explicit interest 6, and `minimumScore` 3. So a single primary persona,
challenge or hotspot is enough (persona-only, challenge-only and exploration-only journeys all work), but
a secondary signal alone is not.

Allowed placeholders: `{persona}`, `{challenges}`, `{facilityType}`, `{scenes}`, `{hotspots}`,
`{interests}`, `{solution}`. ES and EN must use the same set. They render the visitor's matched labels
(joined with "y"/"and"). If any placeholder has no match, `fallbackExplanation` is used.

### 7.4 Scoring algorithm

Constants in `engine-config.ts`:

| Constant                    | Value | Meaning                                                                           |
| --------------------------- | ----- | --------------------------------------------------------------------------------- |
| `DEFAULT_MAX_RESULTS`       | 3     | Items returned (schema max 5)                                                     |
| `SCENE_CAP`                 | 3     | Max total contribution of visited scenes per solution                             |
| `HOTSPOT_CAP`               | 8     | Max total contribution of hotspots (direct + affinity + engaged)                  |
| `HOTSPOT_SOLUTION_AFFINITY` | 2     | An opened hotspot listing the solution in its signals, when not weighted directly |
| `ENGAGED_HOTSPOT_BONUS`     | 1     | Per contributing hotspot whose panel stayed open past the threshold               |
| `IMPLIED_CHALLENGE_FACTOR`  | 0.5   | Weight fraction for challenges implied by opened hotspots (not selected)          |
| `IMPLIED_CHALLENGE_CAP`     | 3     | Max total implied-challenge contribution                                          |

1. Use `visibleContent(bundle, mode)`, so hidden solutions, rules and references never score.
2. Normalize signals: drop unknown or hidden ids and duplicates.
3. Skip a rule if any exclusion matches (persona, selected challenges, facility, visited scenes, opened
   hotspots, explicit interests).
4. Score: persona + selected challenges + facility type + capped scenes + capped hotspots (direct weight,
   otherwise affinity, plus engaged bonus) + capped implied challenges + explicit interests. Each
   contribution is a `MatchedSignal` with `kind` = `direct` | `implied-challenge` | `hotspot-affinity` |
   `engaged-bonus`.
5. Discard rules below `minimumScore`.
6. Sort: score ↓ → explicit score (direct challenges + interests) ↓ → rule `priority` ↓ → `solutionId` ↑.
7. Take `maxResults`.
8. **Why this appeared:** group matches (interest, challenge, persona, hotspot, scene, facility, implied),
   rank the groups by weight and render the top 3 with up to 2 quoted labels each. For example:
   _"Aparece porque eligió «Prepararse para emergencias»."_ or _"This appeared because: you opened “Storage
   tank”; you explored “Medical-gas plant”; what you explored relates to “Improve supply continuity”."_
9. **Relevance:** render the rule's `explanationTemplate`.
10. If nothing qualifies, return the fallback solution with a neutral explanation ("a specialist can help
    you explore options").

Numeric scores are **not displayed** to visitors. `CONTENT_VALIDATION.md` §11.10 lists what each persona,
challenge and hotspot alone would produce, regenerated by `npm run content:export`.

### 7.5 Minimum information and prompt

- `hasMinimumInfo = (personaId && challengeIds.length ≥ 1) || openedHotspotIds.length ≥ settings.exploreMinHotspots (3)`
- Contextual prompt: shown once when `hasMinimumInfo` and (`visitedSceneIds.length ≥ 1` or on arrival at
  preliminary recommendations), dismissible.

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

| Method + path                      | Purpose                                      | Request validation             | Response                               |
| ---------------------------------- | -------------------------------------------- | ------------------------------ | -------------------------------------- |
| `GET /api/health`                  | Readiness: app, config, content, database    | —                              | `HealthReport` (see §9.1.1) ✅         |
| `POST /api/sessions`               | Store anonymous session summary (sendBeacon) | Zod `SessionSummary` (C1 only) | `204`                                  |
| `POST /api/leads`                  | Create lead, snapshot, report, outbox entry  | Zod `LeadSubmission`           | `201 { leadId, emailQueued: boolean }` |
| `GET /api/admin/leads.csv`         | CSV export                                   | Admin auth                     | `text/csv`                             |
| `GET /api/admin/outbox`            | Outbox status                                | Admin auth                     | JSON                                   |
| `POST /api/admin/outbox/:id/retry` | Force retry                                  | Admin auth                     | JSON                                   |

All handlers run on the Node.js runtime. Payload size limits are enforced; unknown fields are rejected
(`z.strictObject`).

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
file read-only with Node's built-in `node:sqlite` and never creates it. Until Phase 7 migrations exist,
`not_initialized` and overall `degraded` are expected (ADR-038).

### 9.2 `POST /api/leads` flow

```
validate payload (Zod) ─► load content + visibleContent(mode)
  ─► recompute recommendations server-side from submitted signals (never trust client output)
  ─► compute lead score (server-only)
  ─► render report HTML + text (visitor language, visible content only)
  ─► prisma.$transaction([
        upsert VisitorSession, create Lead, create RecommendationSnapshot,
        create Report, create EmailOutbox(status=pending) if reportConsent
     ])
  ─► respond 201 { leadId, emailQueued }
  ─► nudge outbox worker (async, fire-and-forget; errors logged, never surfaced)
```

The HTTP response is sent **after** the transaction commits and **before** any email attempt. Email
failure therefore cannot roll back or block lead creation.

### 9.3 Data model (Prisma, SQLite)

| Model                    | Fields (abridged)                                                                                                                                                                                                                                                                                                                     |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VisitorSession`         | `id`, `startedAt`, `endedAt?`, `outcome` (`completed`/`abandoned`/`timeout`), `language`, `entryPath?`, `contentMode`, `contentVersion`, `signals` (JSON), `appVersion`                                                                                                                                                               |
| `Lead`                   | `id`, `sessionId` → VisitorSession, `createdAt`, `firstName`, `lastName`, `organization`, `jobFunction` (persona id), `email`, `emailIsFreeDomain`, `phone?`, `preferredLanguage`, `interests` (JSON), `consentVersion` (details in `ConsentRecord`), `leadScore`, `leadTier`, `leadScoreFactors` (JSON), `contentMode`, `deletedAt?` |
| `RecommendationSnapshot` | `id`, `leadId`, `engineVersion`, `contentVersion`, `contentMode`, `items` (JSON: ids, reasons, environments, resources)                                                                                                                                                                                                               |
| `Report`                 | `id`, `leadId`, `language`, `subject`, `html`, `text`, `createdAt`                                                                                                                                                                                                                                                                    |
| `EmailOutbox`            | `id`, `reportId`, `kind` (`visitor_report`; `sales_notification` reserved), `to`, `status` (`pending`/`sending`/`sent`/`failed`/`cancelled`), `attempts`, `nextAttemptAt`, `lastError?` (sanitized, no PII), `providerMessageId?`, `createdAt`, `sentAt?`                                                                             |
| `ConsentRecord`          | `id`, `leadId`, `consentType` (`report-delivery`/`sales-follow-up`), `granted`, `consentVersion`, `language`, `textShown`, `recordedAt`, `source` — mirrors `ConsentRecordSchema`                                                                                                                                                     |
| `EmailDeliveryEvent`     | `id`, `outboxId`, `leadId`, `kind`, `eventType`, `attempt`, `provider`, `occurredAt`, `providerMessageId?`, `errorCode?`, `errorMessage?` (sanitized), `retryable?`, `nextAttemptAt?` — mirrors `EmailDeliveryEventSchema`                                                                                                            |
| `AdminAuditLog`          | `id`, `at`, `action` (`export`/`retry`/`purge`), `detail` (no PII)                                                                                                                                                                                                                                                                    |

Indexes: `EmailOutbox(status, nextAttemptAt)`, `Lead(createdAt)`, `Lead(email)`.
JSON columns use Prisma's `Json` type on SQLite; if unsupported by the chosen adapter, stored as
`String` with Zod parse on read (documented in DECISIONS if needed).

### 9.4 Email outbox and worker

- **Transactional outbox:** the outbox row is written in the same transaction as the lead.
- **Worker:** started once per process from `instrumentation.ts`; polls every 15 s and is also nudged after
  each lead creation.
- **Claiming:** `UPDATE … SET status='sending' WHERE id=? AND status='pending'` (atomic in SQLite) so a
  message is never sent twice concurrently. Rows stuck in `sending` longer than 5 min revert to `pending`.
- **Backoff:** 30 s, 2 min, 10 min, 30 min, then hourly; after `EMAIL_MAX_ATTEMPTS` (default 12) →
  `failed` (visible in admin; manual retry possible).
- **Errors:** stored sanitized (provider code + short message, no addresses or bodies).

### 9.5 Email providers

```ts
interface EmailProvider {
  readonly name: "file" | "smtp" | "graph";
  send(message: {
    to: string;
    from: string;
    replyTo?: string;
    subject: string;
    html: string;
    text: string;
  }): Promise<
    { ok: true; messageId: string } | { ok: false; retryable: boolean; code: string; message: string }
  >;
}
```

| Provider         | Use                                 | Notes                                                              |
| ---------------- | ----------------------------------- | ------------------------------------------------------------------ |
| `file` (default) | Development, demos without internet | Writes `.eml` + `.html` to `data/outbox-dev/`; no external service |
| `smtp`           | Event                               | Nodemailer; host/port/secure/user/pass from env                    |
| `graph`          | Future                              | Interface stub only; not in MVP                                    |

### 9.6 Report renderer

Server-side functions that turn `(lead, snapshot, visibleContent, reportCopy, brand, language)` into
email-safe HTML (table layout, inline styles, no external images or fonts by default) plus plain text.
The report is rendered once at lead creation and stored, so resends are identical to what the visitor was
promised. Demo mode marks assumed offering items with the pending-validation note.

---

## 10. Privacy and security boundaries

| Boundary           | Rule                                                                                              | Enforcement                                                      |
| ------------------ | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Client persistence | No PII or session data in `localStorage`/`sessionStorage`/IndexedDB/cookies                       | Code review + E2E assertion after reset (AC-28)                  |
| Client memory      | Lead draft exists only while the form is mounted; hard reload on reset                            | Reset controller; E2E test                                       |
| Browser history    | No history entries; reset uses `location.replace`                                                 | Single-route design                                              |
| Autofill           | Disabled/discouraged on lead form; kiosk Chrome autofill off                                      | Form attributes + runbook                                        |
| Commercial data    | Lead score/tier/factors never leave the server except admin/CSV                                   | `server-only` imports; response schema test; bundle grep in CI   |
| Admin surface      | Disabled unless `ADMIN_ENABLED=true`; HTTP Basic auth with env credentials; not linked; `noindex` | `proxy.ts` guard + handler-level check (defense in depth)        |
| Logs               | Never log names, emails, phones, or payload bodies; log IDs and status codes only                 | `log.ts` helper; lint rule against `console.log` in `src/server` |
| Secrets            | `.env` only, git-ignored; nothing sensitive in `NEXT_PUBLIC_*`                                    | `env.ts` Zod schema; `.env.example`                              |
| PHI                | Not collected; no free-text fields in visitor flow                                                | Form design (ADR-020)                                            |
| External requests  | Kiosk loads only same-origin assets                                                               | Self-hosted fonts; E2E network assertion (AC-31)                 |
| Data at rest       | SQLite file on an encrypted laptop disk                                                           | Runbook (BitLocker)                                              |
| Retention          | Export then purge after the agreed period                                                         | `leads:purge` script; Q7 open                                    |
| Input abuse        | Zod strict schemas, size limits, basic per-IP rate limit on `/api/leads`                          | Handler middleware                                               |

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

- **Scene composition:** a fixed-aspect art box (portrait) containing ordered layers (background → mid
  → foreground → hotspot layer). Hotspots use normalized coordinates, so art can be replaced without
  code changes.
- **Placeholder art:** simple, original, local SVG isometric blocks per environment, marked
  `assetStatus: "placeholder"`.
- **Zoom transition (navigation hotspot):** scale the current scene toward the hotspot origin (≈ 400 ms), crossfade
  to the target scene, settle (≈ 300 ms). Total ≤ 800 ms.
- **Parallax:** subtle ambient drift per layer `depth` (a few px), plus a slight shift while panning a
  panel; never a free camera.
- **Hotspot affordance:** large (≥ 64 px) pulsing markers with labels; no hover states needed.
- **Panels:** bottom sheet on portrait (≤ 60 % height), short copy, large close button.
- **Reduced motion:** zoom and parallax become opacity fades.
- Only `transform` and `opacity` are animated; target 60 fps on mid-range Android.

---

## 14. Administration and operations

| Capability            | Primary (no network exposure)                              | Secondary (optional, guarded web UI) |
| --------------------- | ---------------------------------------------------------- | ------------------------------------ |
| CSV export            | `npm run leads:export -- --out leads.csv`                  | `/admin` → Export                    |
| Outbox status / retry | `npm run outbox:retry`                                     | `/admin` → Outbox                    |
| Purge after retention | `npm run leads:purge -- --before 2026-12-31`               | —                                    |
| Content readiness     | `npm run content:check -- --mode production`               | `/admin` → Content status            |
| Sales review export   | `npm run content:export` (CSV + CONTENT_VALIDATION.md §11) | —                                    |

CSV: UTF-8 with BOM, one row per lead, columns for contact fields, consents + version, language,
persona, challenges, interests, recommended solution ids/titles, scenes explored, lead score/tier, email
status, timestamps.

---

## 15. Configuration (environment variables)

| Variable                                                              | Default                       | Purpose                                      |
| --------------------------------------------------------------------- | ----------------------------- | -------------------------------------------- |
| `DATABASE_URL`                                                        | `file:./data/linde-sphere.db` | SQLite location                              |
| `CONTENT_MODE`                                                        | `demo`                        | `production` \| `demo`                       |
| `CONTENT_PREVIEW_PLACEHOLDERS`                                        | `false`                       | Dev-only placeholder preview                 |
| `EMAIL_PROVIDER`                                                      | `file`                        | `file` \| `smtp`                             |
| `EMAIL_FROM` / `EMAIL_REPLY_TO`                                       | —                             | Sender identity                              |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` / `SMTP_USER` / `SMTP_PASS` | —                             | SMTP provider                                |
| `EMAIL_MAX_ATTEMPTS`                                                  | `12`                          | Outbox retry ceiling                         |
| `ADMIN_ENABLED`                                                       | `false`                       | Enable admin pages/APIs                      |
| `ADMIN_USER` / `ADMIN_PASSWORD`                                       | —                             | Basic auth credentials (required if enabled) |
| `DEV_ALLOWED_ORIGINS`                                                 | —                             | Extra dev-server HMR hostnames (comma list)  |
| `ENABLE_COMPONENT_GALLERY`                                            | `false`                       | Allow `/dev/components` in production builds |

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

- Initial load on LAN ≤ 2 s to interactive on a mid-range Android device.
- Scene layer assets: SVG or WebP, ≤ 300 KB per scene.
- JS for the kiosk route ≤ 250 KB gzipped (excluding scene assets).
- Transitions at 60 fps; no layout thrash (transform/opacity only).
