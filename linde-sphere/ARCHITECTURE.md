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

| Concern                  | Choice                                                | Version target                                        | Notes                                                   |
| ------------------------ | ----------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------- |
| Runtime                  | Node.js LTS                                           | 22.x (≥ 20.9 required by Next.js 16)                  | Same major on dev and Windows laptop                    |
| Framework                | Next.js, App Router                                   | 16.3.x (latest stable)                                | `next start -H 0.0.0.0` for LAN                         |
| UI                       | React                                                 | 19.x                                                  |                                                         |
| Language                 | TypeScript                                            | 5.x, `strict: true`, `noUncheckedIndexedAccess: true` |                                                         |
| Styling                  | Tailwind CSS                                          | 4.x (CSS-first `@theme`)                              | Brand tokens via CSS variables                          |
| Motion                   | Motion (formerly Framer Motion)                       | 13.x — `motion` package                               | Same library, current package name (ADR-015)            |
| Validation               | Zod                                                   | 4.x                                                   | Content, API payloads, env                              |
| ORM / DB                 | Prisma + SQLite                                       | **7.10.x stable** (not the 8.0 RC tagged `latest`)    | Driver adapter verified on Windows in Phase 1 (ADR-010) |
| Email                    | Nodemailer (SMTP)                                     | latest stable                                         | Behind a provider interface                             |
| Unit / integration tests | Vitest + Testing Library                              | latest stable                                         | `jsdom` for components, `node` for server               |
| E2E tests                | Playwright                                            | version compatible with installed Chromium            | Portrait viewport + touch emulation                     |
| Lint / format            | ESLint (flat config, `eslint-config-next`) + Prettier | latest stable                                         | `prettier-plugin-tailwindcss`                           |

**Installed so far (Phase 1 partial + Phase 2):** Next.js 16.3.7, React 19.2, TypeScript 5.9, Tailwind 4,
Zod 4.6, Vitest 5, tsx, ESLint 9 (`eslint-config-next`), Prettier 3. Prisma, Motion, Nodemailer, Testing
Library and Playwright are added in the phases that first use them (see TASKS.md).

**Explicitly not used:** real-time 3D libraries (three.js, Babylon, etc.), global state libraries
(Redux, Zustand, MobX), i18n frameworks, CMS, analytics SDKs, external CDNs, paid services.

---

## 3. Repository layout

The application lives in `linde-sphere/` alongside the unrelated `client-facing/` project (ADR-002).
Items marked ✅ exist today; the rest are planned and arrive in the phase noted in TASKS.md.

```
linde-sphere/
├─ PROJECT_BRIEF.md · ARCHITECTURE.md · DECISIONS.md · TASKS.md · CONTENT_VALIDATION.md   ✅
├─ README.md                      # quick start + links                                  ✅
├─ DEPLOYMENT.md                  # Windows laptop + Android kiosk runbook (Phase 10)
├─ .env.example                   # every variable, no values (Phase 1 remainder)
├─ package.json · tsconfig.json · next.config.ts · eslint.config.mjs · .prettierrc.json  ✅
├─ vitest.config.mts                                                                      ✅
├─ prisma.config.ts · prisma/schema.prisma · prisma/migrations/   (Phase 1 remainder / 7)
├─ content/                       # C0 content (JSON), validated by Zod                  ✅
│  ├─ manifest.json               # contentVersion, default language, updatedAt          ✅
│  ├─ personas.json · challenges.json · facility-types.json                               ✅
│  ├─ scenes/<scene-id>.json      # one file per scene: layers + hotspots (8 files)       ✅
│  ├─ solutions.json              # solution categories + governance                      ✅
│  ├─ digital-assets.json         # resources linked from solutions + governance          ✅
│  ├─ recommendation-rules.json   # one weighted rule per solution                        ✅
│  ├─ consent.json                # versioned consent + privacy text (ES/EN)              ✅
│  ├─ settings.json · brand.json · report.json · sales-contacts.json   (Phases 3–8)
├─ config/lead-scoring.json       # C3 — imported only by server-only modules (Phase 3)
├─ messages/es.json · en.json     # UI strings (Phase 4)
├─ public/scenes/placeholder/     # original placeholder SVG layers (Phase 6)
├─ src/
│  ├─ app/                        # layout.tsx + placeholder page.tsx ✅; kiosk, admin, api (Phases 4–9)
│  ├─ domain/                     # pure, isomorphic, fully unit-tested                    ✅
│  │  ├─ content/                 # primitives, taxonomy, scene, offering, recommendation-rule,
│  │  │                           #   settings, bundle (cross-checks), visibility           ✅
│  │  ├─ session/visitor-session.ts            # VisitorSession + SessionSignals          ✅
│  │  ├─ recommendations/recommendation-result.ts  # RecommendationResult (engine: Phase 3) ✅
│  │  ├─ leads/lead-submission.ts · consent-record.ts                                     ✅
│  │  ├─ report/report-payload.ts                                                         ✅
│  │  └─ email/email-delivery-event.ts                                                    ✅
│  ├─ server/
│  │  ├─ content/load-content.ts  # fs loader + per-file Zod validation (Node-only, no `server-only`
│  │  │                           #   marker so CLI scripts can reuse it)                   ✅
│  │  └─ env.ts · db.ts · lead-scoring.ts · leads.ts · report/ · email/ · outbox/ · log.ts  (Phases 1–9,
│  │                              #   all with `import "server-only"`)
│  ├─ kiosk/                      # client state machine, screens, explorer (Phases 4–6)
│  ├─ proxy.ts · instrumentation.ts   (Phases 8–9)
├─ scripts/
│  ├─ content-check.ts            # npm run content:check                                  ✅
│  └─ leads-export.ts · leads-purge.ts · outbox-retry.ts   (Phase 9)
├─ tests/
│  ├─ helpers/                    # fixtures + expectValid/expectInvalid                   ✅
│  ├─ unit/content · unit/runtime                                                         ✅
│  └─ integration/ · e2e/         (Phases 7–10)
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
- The laptop's internet connection (Ethernet/second adapter/phone tether) is used only by the email worker.

### 4.2 Processes

A single Node.js process (`next start`) serves pages, APIs, and runs the outbox worker (started from
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
| Entry / selection / explorer / recommendations | 60 s                | 15 s ("¿Sigue ahí?")  | `settings.json` |
| Lead form                                      | 120 s               | 20 s                  | `settings.json` |
| Confirmation                                   | —                   | auto-reset after 15 s | `settings.json` |

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

Planned content (later phases): `settings.json` (engine limits, idle timings), `brand.json`, `report.json`
(CTA, disclaimer), `sales-contacts.json`.

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

### 7.1 Properties

- **Pure and isomorphic:** `recommend(signals, content, settings) → Recommendation[]`, no I/O, no clock,
  no randomness.
- **Deterministic:** stable ordering with explicit tie-breakers.
- **Explainable:** each score contribution carries a reason code, rendered to localized text.
- **Versioned:** `ENGINE_VERSION` constant + `contentVersion` stored with every snapshot.

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

Raw timestamps are never used for scoring. Dwell is reduced to a boolean "engaged" per hotspot and is
capped (ADR-023) so idle screens cannot inflate scores. Opening a hotspot also contributes its
`recommendationSignals` (related challenge/solution ids) at a discounted weight defined in Phase 3.

### 7.3 Rules (`content/recommendation-rules.json`)

Rules are data, one per non-fallback solution (ADR-028):

```jsonc
{
  "id": "rule-medical-gas-supply-continuity",
  "solutionId": "medical-gas-supply-continuity",
  "weights": {
    // 0 < weight ≤ 10, keys must reference existing ids
    "personas": { "procurement-supply": 3 },
    "challenges": { "supply-continuity": 5 },
    "facilityTypes": { "acute-hospital": 1 },
    "scenes": { "gas-plant": 2 },
    "hotspots": { "gas-plant-bulk-tank": 3 },
    "explicitInterests": { "medical-gas-supply-continuity": 6 }, // keyed by solution id
  },
  "minimumScore": 5, // must be reachable (checked)
  "exclusions": [
    // any match ⇒ solution not recommended
    { "signalType": "facilityTypes", "ids": ["homecare-organization"], "reason": "internal note" },
  ],
  "explanationTemplate": {
    "es": "Porque indicó como prioridad {challenges}, …",
    "en": "Because you prioritized {challenges}, …",
  },
  "fallbackExplanation": { "es": "Relacionado con …", "en": "Related to …" }, // no placeholders
  "priority": 90, // tie-breaker, 1–100
  "validationStatus": "assumed",
  "internalNotes": "…",
}
```

Allowed placeholders: `{persona}`, `{challenges}`, `{facilityType}`, `{scenes}`, `{hotspots}`,
`{interests}`, `{solution}`. ES and EN must use the same set. At runtime a placeholder renders the
visitor's matched labels for that signal type (lower-cased mid-sentence, joined with "y"/"and"). If any
placeholder has no match, the engine uses `fallbackExplanation`.

### 7.4 Scoring algorithm

1. Filter solutions and rules through `visibleContent`; drop any rule whose exclusions match.
2. For each remaining rule, sum the weights of matched signals. Each match yields
   `{ signalType, signalId, weight, reasonCode }`.
3. Per-signal-type caps (e.g., scenes contribute at most 4 total) keep exploration from dominating the visitor's explicit choices.
4. Discard solutions below their rule's `minimumScore`.
5. Sort by: total score ↓ → explicit score (challenges + interests) ↓ → rule `priority` ↓ → `solutionId` ↑.
6. Take `settings.topN` (default 3, max 5).
7. For each, render the rule's `explanationTemplate` (or `fallbackExplanation`) in both languages and keep
   the matched signals as the machine-readable "why".
8. If empty, return the configured **fallback** recommendation ("Speak with a specialist").

Numeric scores are **not displayed** to visitors.

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

| Method + path                      | Purpose                                      | Request validation             | Response                                |
| ---------------------------------- | -------------------------------------------- | ------------------------------ | --------------------------------------- |
| `GET /api/health`                  | Liveness + DB check + outbox counts (no PII) | —                              | `{ ok, db, outbox: {pending, failed} }` |
| `POST /api/sessions`               | Store anonymous session summary (sendBeacon) | Zod `SessionSummary` (C1 only) | `204`                                   |
| `POST /api/leads`                  | Create lead, snapshot, report, outbox entry  | Zod `LeadSubmission`           | `201 { leadId, emailQueued: boolean }`  |
| `GET /api/admin/leads.csv`         | CSV export                                   | Admin auth                     | `text/csv`                              |
| `GET /api/admin/outbox`            | Outbox status                                | Admin auth                     | JSON                                    |
| `POST /api/admin/outbox/:id/retry` | Force retry                                  | Admin auth                     | JSON                                    |

All handlers run on the Node.js runtime. Payload size limits are enforced; unknown fields are rejected
(`z.strictObject`).

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
- UI strings: `messages/es.json` / `messages/en.json`, accessed through a small typed `t(key, params)`
  helper; key parity is enforced by a unit test.
- Content strings: `Localized` objects (`{ es, en }`), both required by schema.
- `<html lang>` updates with the active language. Language resets to `es` on every new session.
- The report is rendered in the lead's `preferredLanguage`.

---

## 12. Branding and theming

- `content/brand.json` holds the product name ("Linde Sphere"), color tokens, an optional logo path, and
  footer/contact text. **No corporate logo files are committed**; the default renders a text wordmark.
- Tokens are emitted as CSS variables in `layout.tsx` and consumed by Tailwind 4 `@theme`, so a rebrand is
  a JSON change.
- Default palette: calm clinical blues/teals on light neutrals, AA contrast verified by a unit test on the
  token pairs.
- Typography: a self-hosted open-licence sans-serif (e.g., Inter or Source Sans 3) with kiosk base size ≥ 22 px.

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

| Capability            | Primary (no network exposure)                | Secondary (optional, guarded web UI) |
| --------------------- | -------------------------------------------- | ------------------------------------ |
| CSV export            | `npm run leads:export -- --out leads.csv`    | `/admin` → Export                    |
| Outbox status / retry | `npm run outbox:retry`                       | `/admin` → Outbox                    |
| Purge after retention | `npm run leads:purge -- --before 2026-12-31` | —                                    |
| Content readiness     | `npm run content:check -- --mode production` | `/admin` → Content status            |

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
| `PORT` / `HOST`                                                       | `3000` / `0.0.0.0`            | Kiosk serving                                |

All are parsed by a Zod schema at startup; the server refuses to start on invalid configuration (e.g.,
`EMAIL_PROVIDER=smtp` without `SMTP_HOST`).

---

## 16. Testing strategy

| Layer       | Tooling                                                                       | Scope                                                                                                                                                                          |
| ----------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Static      | `tsc --noEmit`, ESLint, Prettier check                                        | Whole project                                                                                                                                                                  |
| Content     | `content:check` (Zod + cross-reference + translation + prohibited-claim scan) | `content/`, `messages/`                                                                                                                                                        |
| Unit        | Vitest (node)                                                                 | Engine (determinism, reasons, caps, tie-breaks, fallback), visibility filter, lead scoring, signal normalization, i18n parity, outbox backoff, CSV formatting, contrast tokens |
| Component   | Vitest + Testing Library (jsdom)                                              | Reducer transitions, idle timer, minimum-info gating, lead form validation                                                                                                     |
| Integration | Vitest + temporary SQLite DB                                                  | `/api/leads` transaction, email failure keeps lead + retries, response excludes score, production mode filtering in report                                                     |
| E2E         | Playwright, 1080×1920, `hasTouch`                                             | Quick path, discovery path, explore path, idle reset clears everything, production mode hides assumed content, no external requests                                            |

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
