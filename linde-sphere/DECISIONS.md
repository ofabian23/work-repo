# Linde Sphere — Decision Log

Lightweight architecture decision records (ADRs). Every architectural change must add or supersede an
entry here — architecture is never changed silently.

**Status values:** `Accepted` (in force) · `Proposed` (default in force, awaiting owner confirmation) ·
`Superseded by ADR-xxx`.

---

## ADR-001 — Product name "Linde Sphere", branding is configurable

- **Date:** 2026-09-29 · **Status:** Accepted
- **Context:** The foundational document uses the codename "Mockup Vision"; the owner named the platform
  "Linde Sphere". The implementation brief requires configurable branding without hard-coded corporate logos.
- **Decision:** User-facing name is "Linde Sphere", defined in `content/brand.json`. "Mockup Vision"
  remains the internal codename in historical documents. No corporate logo files are committed; a text
  wordmark is the default and an approved logo path can be configured later.
- **Consequences:** Rebranding is a content change. Use of the name and any brand assets at the event
  needs marketing approval (PROJECT_BRIEF Q1).

## ADR-002 — Application lives in `linde-sphere/` inside the existing repository

- **Date:** 2026-09-29 · **Status:** Proposed
- **Context:** The repository already contains `client-facing/` (UBI-K-LO, an unrelated Create React App +
  Expo + Supabase project). The Linde Sphere stack (Next.js, Prisma, SQLite) shares nothing with it.
- **Decision:** Create a self-contained top-level folder `linde-sphere/` with its own `package.json`,
  docs, and tooling. Do not modify `client-facing/`.
- **Alternatives:** Replace repository contents (destructive, not requested); separate repository (not
  available in this session's scope).
- **Consequences:** All commands run from `linde-sphere/`. Can be extracted to its own repository later
  with `git subtree split`.

## ADR-003 — Next.js 16 (App Router), React 19, TypeScript strict, Node.js 22 LTS

- **Date:** 2026-09-29 · **Status:** Accepted
- **Context:** Brief requires the latest stable Next.js supported by the local environment. npm reports
  `next@16.3.7` as latest stable; it requires Node ≥ 20.9. The dev container runs Node 22.22.
- **Decision:** Next.js 16.3.x, App Router, React 19, TypeScript `strict` + `noUncheckedIndexedAccess`.
  The Windows laptop must run Node.js 22 LTS.
- **Consequences:** Next 16 conventions apply (e.g., `proxy.ts` replaces `middleware.ts`; Turbopack is the
  default bundler). Any incompatibility found during Phase 1 is recorded here.

## ADR-004 — Single-route kiosk driven by a client-side state machine

- **Date:** 2026-09-29 · **Status:** Accepted
- **Context:** A shared public device must never reveal a previous visitor via back navigation, and reset
  must be reliable.
- **Decision:** The visitor experience is one route (`/`). Screens are states in a `useReducer` machine.
  No history entries are pushed. Reset performs `window.location.replace("/")` (hard reload).
- **Alternatives:** One route per screen (exposes history/back gesture, harder reset guarantees).
- **Consequences:** Deep links to screens are not supported (not needed). Flow logic is unit-testable at
  the reducer level.

## ADR-005 — No state-management library

- **Date:** 2026-09-29 · **Status:** Accepted
- **Decision:** `useReducer` + React context + derived selectors. No Redux/Zustand/MobX/XState.
- **Consequences:** One small, explicit reducer; fewer dependencies.

## ADR-006 — JSON content validated by Zod; all strings localized `{ es, en }`

- **Date:** 2026-09-29 · **Status:** Accepted
- **Decision:** Content lives in `content/*.json` and is validated at build time (`content:check`) and at
  server start. Every visitor-facing string is a `Localized` object with both `es` and `en` required.
- **Consequences:** Invalid content cannot reach the kiosk. Translators edit JSON; no CMS in MVP.

## ADR-007 — Content status gates visibility; production vs. demo modes

- **Date:** 2026-09-29 · **Status:** Accepted (field shape amended by ADR-027)
- **Decision:** Every content record carries `status` (`validated`/`assumed`/`placeholder`/`unavailable`)
  and `kind` (`taxonomy`/`offering`/`legal`/`brand`). A single pure `visibleContent(bundle, mode)` filter
  feeds the UI, server recomputation, and report. Production shows only `validated`; demo also shows
  `assumed`, with a "pending local validation" indicator on offering content. Placeholder content is
  visible only with a dev-only preview flag. Visual assets have a separate `assetStatus` that does not gate
  visibility.
- **Consequences:** Until content is validated, production mode will show very little. This is intentional.
  See CONTENT_VALIDATION.md.

## ADR-008 — Deterministic, weighted-rules recommendation engine shared by client and server

- **Date:** 2026-09-29 · **Status:** Accepted (rule storage amended by ADR-028)
- **Decision:** A pure function scores solution categories by summing content-defined weights for matched
  signals, with per-type caps, explicit tie-breakers, and reason codes. The client uses it for live display.
  The server recomputes it from submitted signals for the stored snapshot and the report.
- **Alternatives:** Generative AI (prohibited); decision trees (harder to maintain as content grows).
- **Consequences:** Behaviour is fully testable and explainable. Tuning happens through content weights.

## ADR-009 — Lead scoring is a separate, server-only module

- **Date:** 2026-09-29 · **Status:** Accepted
- **Decision:** `src/server/lead-scoring.ts` (`import "server-only"`) with config in `config/lead-scoring.json`.
  Scores are stored on `Lead` and exposed only through admin views and CSV export.
- **Consequences:** The kiosk and report cannot leak commercial scoring. Enforced by tests.

## ADR-010 — Prisma 7 (latest stable) with SQLite; not the 8.0 release candidate

- **Date:** 2026-09-29 · **Status:** Accepted (timing amended by ADR-038: introduced in Phase 7)
- **Context:** On 2026-09-29, npm's `latest` dist-tag for `prisma` points to `8.0.0-rc.19` (a release
  candidate published the same day), while `@prisma/client` latest and `prisma` `prev` are `7.10.0`.
- **Decision:** Pin Prisma CLI and client to the **7.10.x** stable line. Use the SQLite driver adapter
  recommended for Prisma 7. Phase 1 must verify a clean install and migration on Windows (native module
  prebuilds).
- **Fallback (if Prisma cannot run on the Windows laptop):** keep the same schema and repository
  interface but implement it with the simplest compatible SQLite driver, and record a superseding ADR.
- **Consequences:** Upgrade to Prisma 8 only after a stable release and a dedicated test pass.

## ADR-011 — Transactional outbox for email with an in-process worker

- **Date:** 2026-09-29 · **Status:** Accepted
- **Decision:** Lead, recommendation snapshot, rendered report, and outbox row are written in one
  transaction. A worker started from `instrumentation.ts` claims pending rows atomically and sends them via
  the configured provider, with exponential backoff up to a max-attempts ceiling.
- **Consequences:** A failed email can never destroy or roll back a stored lead. No external queue is needed.

## ADR-012 — Provider abstraction: `file` (default) and `smtp`; Graph later

- **Date:** 2026-09-29 · **Status:** Accepted
- **Decision:** `EmailProvider` interface. The `file` provider writes `.eml`/`.html` locally, so the app runs
  with no external service. The `smtp` provider uses Nodemailer. A Microsoft Graph provider is a future
  extension (stub only).
- **Consequences:** Development and offline demos work out of the box; the event needs SMTP credentials (Q2).

## ADR-013 — Report rendered as HTML at lead creation and stored; no PDF in MVP

- **Date:** 2026-09-29 · **Status:** Accepted
- **Decision:** Server-side renderer produces email-safe HTML (tables, inline styles, no remote assets)
  plus plain text. It is stored in `Report` so retries and resends are identical.
- **Consequences:** Later content edits don't change already-promised reports. PDF can be added from the
  same data.

## ADR-014 — Lightweight typed i18n, Spanish-first

- **Date:** 2026-09-29 · **Status:** Accepted (dictionary format amended by ADR-035)
- **Decision:** `messages/es.json` (source of truth) + `messages/en.json` with a small typed `t()` helper
  and a key-parity test. No i18n framework. Every new session starts in Spanish.
- **Consequences:** Minimal dependencies; routing is not language-based (single route).

## ADR-015 — Motion library: `motion` package (formerly Framer Motion)

- **Date:** 2026-09-29 · **Status:** Accepted
- **Context:** The brief specifies Framer Motion. The library is now published as `motion` (import from
  `motion/react`); `framer-motion` is the legacy package name of the same project.
- **Decision:** Use the `motion` package, only where motion improves the experience (scene zoom,
  crossfades, panel sheets, attract loop). Animate only `transform`/`opacity`; honour `prefers-reduced-motion`.
- **Consequences:** Same API and capabilities as specified; no architectural change.

## ADR-016 — Tailwind CSS 4 with brand tokens as CSS variables

- **Date:** 2026-09-29 · **Status:** Accepted (brand source amended by ADR-036)
- **Decision:** Tailwind 4 CSS-first configuration (`@theme`). Brand colors from `brand.json` are emitted as
  CSS variables in the root layout.
- **Consequences:** Rebranding needs no code change. Contrast of token pairs is unit-tested.

## ADR-017 — Testing: Vitest + Testing Library; Playwright for E2E

- **Date:** 2026-09-29 · **Status:** Accepted
- **Decision:** Vitest for unit, component (jsdom), and integration (temporary SQLite) tests. Playwright
  for E2E at 1080×1920 with touch emulation. In the cloud dev environment Playwright uses the preinstalled
  Chromium (`executablePath` if the pinned version differs). On Windows, a standard Playwright install.
- **Consequences:** Claims of passing tests are only made after actually running them.

## ADR-018 — No external network dependencies at runtime

- **Date:** 2026-09-29 · **Status:** Accepted (amended: system font stack instead of a self-hosted web font, see ADR-036)
- **Context:** The kiosk may be on a laptop hotspot without internet.
- **Decision:** Self-hosted fonts (`next/font/local`), local SVG/WebP assets, no CDNs, analytics, or
  third-party scripts. Only the email worker contacts the internet.
- **Consequences:** Works fully offline except email delivery, which is queued.

## ADR-019 — Report consent required to receive the report; follow-up consent optional

- **Date:** 2026-09-29 · **Status:** Proposed (needs legal/compliance confirmation)
- **Decision:** Two separate checkboxes, both unchecked by default. The report is sent only if report
  consent is given. A lead may be submitted with report consent only. Follow-up consent is optional. The
  exact text shown and its version are stored with the lead.
- **Open point:** Whether a visitor may submit with neither consent (a lead for sales without a report) —
  default: **no**. The submit button requires report consent, because the form's stated purpose is report
  delivery.

## ADR-020 — No free-text fields in the visitor flow

- **Date:** 2026-09-29 · **Status:** Accepted
- **Decision:** Apart from name, organization, email, and phone, all inputs are selections (persona,
  interests, language). No comments box.
- **Consequences:** Greatly reduces the risk of visitors entering patient information (PHI).

## ADR-021 — Free-mail email domains accepted and flagged internally

- **Date:** 2026-09-29 · **Status:** Proposed
- **Decision:** Accept any valid email address, to avoid convention friction. Store `emailIsFreeDomain` for
  sales qualification and lead scoring. The policy (`allow`/`warn`/`block`) is configurable in `settings.json`.

## ADR-022 — Page zoom disabled on the kiosk

- **Date:** 2026-09-29 · **Status:** Accepted
- **Context:** Pinch-zoom on a shared kiosk leaves the layout broken for the next visitor.
- **Decision:** Viewport disables user scaling. To compensate, base type is ≥ 22 px, targets are ≥ 64 px,
  and contrast is AA or better.
- **Consequences:** An accessibility trade-off accepted for kiosk context only. Revisit if the app is used
  on personal devices.

## ADR-023 — Dwell signals are bucketed and capped

- **Date:** 2026-09-29 · **Status:** Accepted
- **Decision:** Raw dwell time is never scored. A hotspot panel counts as "engaged" once open ≥ a
  threshold (default 4 s). Engaged signals carry small, capped weights.
- **Consequences:** An idle panel or a distracted visitor cannot distort recommendations.

## ADR-024 — Admin: CLI first; web admin disabled by default and credential-protected

- **Date:** 2026-09-29 · **Status:** Accepted
- **Context:** Admin functions must not be exposed through the visitor interface. The server listens on
  all interfaces, so any web route is reachable from the hotspot network.
- **Decision:** CSV export, outbox retry, purge, and content checks are CLI scripts run on the laptop (no
  network exposure). A minimal `/admin` UI exists but is off unless `ADMIN_ENABLED=true`. It requires HTTP
  Basic auth from env credentials, checked in both `proxy.ts` and each handler. It is never linked from the
  kiosk and is marked `noindex`.
- **Consequences:** Operators prefer the CLI; the web admin is a convenience for post-event review.

## ADR-025 — Server recomputes recommendations; the client's output is never trusted

- **Date:** 2026-09-29 · **Status:** Accepted
- **Decision:** `/api/leads` receives signals, not recommendations. The server recomputes with the same
  engine and content version.
- **Consequences:** Stored snapshots and reports are consistent and tamper-resistant (AC-14).

## ADR-026 — Anonymous session summaries are stored (booth metrics, not analytics)

- **Date:** 2026-09-29 · **Status:** Proposed
- **Decision:** On reset, the client sends an anonymous C1 summary (entry path, selections, scenes,
  outcome) via `sendBeacon`. This supports basic booth metrics and CSV export without an analytics SDK.
  Advanced analytics dashboards remain out of scope.

## ADR-027 — Flat governance fields on solutions and assets; market enum; no `kind` field

- **Date:** 2026-09-29 · **Status:** Accepted (amends ADR-007)
- **Context:** The Phase 2 brief specifies the governance fields `validationStatus`, `market`,
  `internalNotes`, `lastReviewedAt`, `reviewedBy` and `sourceLabel` on every solution and digital asset, with
  market values `puerto-rico | united-states-reference | global-reference | unknown`.
- **Decision:** These fields sit flat on `Solution` and `DigitalAsset`, plus `requiresSalesValidation: boolean`
  so pending sales validation is machine-checkable. Invariants: validated/unavailable ⇒ reviewer and date;
  validated ⇒ market `puerto-rico` and no pending sales validation; assumed/placeholder ⇒
  `requiresSalesValidation: true`. Other entities carry `validationStatus` only. The earlier `kind` field is
  dropped. The content type follows from the entity, and the pending indicator applies to non-validated
  solutions and assets.
- **Consequences:** The schema itself enforces "never present an assumption as a confirmed local offering".

## ADR-028 — Recommendation rules are a separate collection, one rule per solution

- **Date:** 2026-09-29 · **Status:** Accepted (amends ADR-008)
- **Decision:** `content/recommendation-rules.json` holds `RecommendationRule` records: weighted signal maps
  (personas, challenges, facility types, scenes, hotspots, explicit interests keyed by solution id; weights
  0 < w ≤ 10), `minimumScore`, `exclusions` (any match removes the solution), `explanationTemplate` with
  whitelisted placeholders plus a placeholder-free `fallbackExplanation`, `priority` (tie-breaker),
  `validationStatus`, and `internalNotes`. Exactly one rule per non-fallback solution. The fallback
  solution has none. Cross-checks reject unreachable thresholds and signals that are both weighted and
  excluded.
- **Alternatives:** Rules embedded in solutions (mixes sales-owned text with tuning data); several rules per
  solution (harder to explain).
- **Consequences:** Tuning never touches solution text. Every recommendation has exactly one explanation source.

## ADR-029 — Hotspot geometry in 0–100 percentages, center-based

- **Date:** 2026-09-29 · **Status:** Accepted
- **Decision:** `x`/`y` are the hotspot center as a percentage (0–100) of the scene art box. Optional
  `width`/`height` define a percentage hit area that must stay inside the box. The UI still enforces a
  ≥ 64 px minimum target. Hotspot types are `navigation`, `solution` and `information` (a discriminated
  union, each type requiring its own target). Hotspot ids are globally unique across scenes.
- **Consequences:** Replacing artwork only requires adjusting coordinates, not code.

## ADR-030 — Partial Phase 1 scaffold to host the content model

- **Date:** 2026-09-29 · **Status:** Accepted
- **Context:** Phase 2 (content model) was requested before the full Phase 1 foundation, but it needs lint,
  typecheck and tests.
- **Decision:** Scaffolded Next.js 16.3.7 with `create-next-app` (TypeScript strict, Tailwind 4, ESLint,
  App Router, `src/`) and added Zod 4, Vitest 5, tsx and Prettier. Removed the scaffold's Google-font
  import (ADR-018) and demo assets. The page is a minimal Spanish-first placeholder. Prisma, Playwright,
  env validation, logging and the health route remain Phase 1 work.
- **Consequences:** `npm run check` runs content check, lint (zero warnings), typecheck (with
  `next typegen`), Prettier check and unit tests.

## ADR-031 — Two-stage content validation; missing placeholder art is a warning

- **Date:** 2026-09-29 · **Status:** Accepted
- **Decision:** `content:check` validates each file independently first, so errors name the exact file,
  path and record id. Cross-record checks run only when every file is valid, to avoid cascades of
  misleading errors. Missing local image files are warnings for `placeholder` art and errors for
  `approved` art. Only the fs loader (`src/server/content/load-content.ts`) omits `server-only`, so CLI
  scripts can import it. It is Node-only by construction.
- **Consequences:** Fixing content is iterative: schema errors first, then reference errors.

## ADR-032 — Internal fields are stripped by the visibility filter

- **Date:** 2026-09-29 · **Status:** Accepted
- **Decision:** `visibleContent()` returns a `PublicContentBundle` without `internalNotes`, `reviewedBy`,
  `sourceLabel`, `lastReviewedAt`, `requiresSalesValidation`, `market` or exclusion reasons. It keeps
  `validationStatus` so the UI can show the pending indicator.
- **Consequences:** Internal review notes can never leak into the kiosk bundle or reports. Tests assert it.

## ADR-033 — Runtime payloads are strict and privacy-preserving by schema

- **Date:** 2026-09-29 · **Status:** Accepted
- **Decision:** `LeadSubmission` sends signals, not recommendations. It requires report-delivery consent
  (`literal(true)`, per ADR-019) and a separate boolean follow-up consent, and rejects unknown fields
  (a lead score or free-text comments). `ReportPayload` is strict and allows only https resource links.
  `EmailDeliveryEvent` never contains recipients or bodies, and its error text may not contain email
  addresses. `RecommendationResult` and `ReportPayload` reject pending-validation content in production mode.
- **Consequences:** Privacy and content-governance rules are enforced at every boundary, not only in the UI.

## ADR-034 — Source folder structure

- **Date:** 2026-09-29 · **Status:** Accepted
- **Context:** The foundation brief asks for a maintainable structure such as `src/app`, `components`,
  `features`, `lib`, `data`, `types`, `styles` and `public/assets`. Phase 2 had already created `src/domain`
  and `src/server`.
- **Decision:** Adopt the suggested folders and keep `src/domain` (pure, isomorphic schemas and logic) and
  `src/server` (server-only modules). They were working and tested, and their separation protects client
  bundles. Responsibilities per folder are listed in ARCHITECTURE §3.1. Visitor-facing content stays in
  `/content` (JSON edited and validated outside the bundle), and `src/data` holds only static app data (UI
  dictionaries). The planned `src/kiosk/` folder becomes `src/features/*`.
- **Consequences:** Placeholder scene paths moved to `/assets/scenes/placeholder/...` so all static assets
  live under `public/assets`.

## ADR-035 — UI dictionaries as typed TypeScript modules

- **Date:** 2026-09-29 · **Status:** Accepted (amends ADR-014)
- **Decision:** `src/data/i18n/es.ts` (`as const`, source of truth) and `en.ts` typed as `Messages`
  replace the planned `messages/*.json`. Missing or extra English keys fail `tsc`, and `t()` keys are typed
  dot-paths. A runtime test also checks key and placeholder parity. `LanguageProvider` keeps the language in
  React state only (no cookies or storage), so every load and reset starts in Spanish.
- **Alternatives:** JSON dictionaries (no compile-time key safety); next-intl or i18next (unnecessary weight
  for two languages on a single route).

## ADR-036 — Brand configuration in TypeScript, validated by Zod; system font stack

- **Date:** 2026-09-29 · **Status:** Accepted (amends ADR-016, ADR-018)
- **Decision:** `src/lib/config/brand-config.ts` (not `content/brand.json`) holds the product name, tagline,
  organization (null), logo (null), palette and `approvalStatus: "placeholder"`, parsed by a Zod schema at
  load. Colors become `--brand-*` CSS variables on `<html>` and Tailwind tokens. Branding changes are rare
  developer edits that should be type-checked. Typography uses the OS font stack (Segoe UI / Roboto),
  which needs no download and no licence.
- **Consequences:** No corporate logo or brand mark ships. A unit test enforces WCAG AA contrast for the
  palette.

## ADR-037 — Environment validation at boot, values never echoed

- **Date:** 2026-09-29 · **Status:** Accepted
- **Decision:** `src/server/env.ts` (`server-only`) parses the known variables with Zod. Empty values count
  as unset. There are safe defaults for development and conditional requirements (SMTP settings when
  `EMAIL_PROVIDER=smtp`, admin credentials with a ≥ 12-character password when `ADMIN_ENABLED=true`).
  Placeholder preview is forced off in production. `instrumentation.ts` validates at server start, so
  misconfiguration fails fast. Errors list variable names and reasons, never values. Port and host are CLI
  flags, not env variables. No `NEXT_PUBLIC_*` secrets exist; the only public value is the app version,
  inlined from package.json.
- **Consequences:** `.env.example` documents every variable. `.env*` is git-ignored except the example.

## ADR-038 — Health route with a dependency-free SQLite probe; Prisma deferred to Phase 7

- **Date:** 2026-09-29 · **Status:** Accepted (amends ADR-010 timing; probe amended by ADR-052: it stays on
  `node:sqlite` and now also requires all migrations to be applied)
- **Context:** The foundation phase needs a health route reporting database readiness, and should add only
  the dependencies it needs. No data is stored until lead capture (Phase 7).
- **Decision:** `GET /api/health` reports app info, configuration validity (variable names only), content
  validity and database status. The database probe opens the SQLite file **read-only** with Node's built-in
  `node:sqlite` (loaded through `process.getBuiltinModule`, so there is no bundler resolution and no native
  dependency) and never creates the file. Statuses are `ready`, `not_initialized` (file missing, expected
  before Phase 7) and `unavailable`. The overall status is `ok`, `degraded` or `error` (HTTP 503 only for
  error). Prisma 7.10 and its migrations arrive in Phase 7, where the probe becomes a Prisma `SELECT 1`.
- **Consequences:** Health shows `degraded` until the database exists, which is documented. `node:sqlite`
  prints an ExperimentalWarning on Node 22 when a database file exists; this is acceptable for a probe that
  is replaced in Phase 7.

## ADR-039 — Localhost by default; explicit network scripts

- **Date:** 2026-09-29 · **Status:** Accepted
- **Context:** Next.js 16's `next dev` and `next start` bind to `0.0.0.0` by default, which would expose
  the laptop to every network it joins during everyday development.
- **Decision:** `npm run dev` / `npm run start` pass `-H localhost`. `npm run dev:network` /
  `npm run start:network` pass `-H 0.0.0.0` for the kiosk. `allowedDevOrigins` allows HMR from private LAN
  ranges (`192.168.*.*`, `10.*.*.*`, `172.*.*.*`, `*.local`) plus `DEV_ALLOWED_ORIGINS`. It affects the
  dev server only.
- **Consequences:** Verified in the dev container: the localhost scripts refuse LAN connections, and the
  network scripts accept them. The README documents both modes and the Windows firewall prompt.

## ADR-040 — Playwright added in the foundation phase

- **Date:** 2026-09-29 · **Status:** Accepted (amends ADR-017 timing)
- **Decision:** `@playwright/test` with three projects (kiosk 1080×1920 touch, laptop 1440×900, phone
  390×844 touch) against a production build on localhost. It verifies the foundation acceptance criteria:
  home renders, language switch, no persisted language, not-found, ≥ 48 px targets, no horizontal overflow,
  kiosk fits without scrolling, and health. The config uses a preinstalled Chromium when present
  (`/opt/pw-browsers/chromium` or `PLAYWRIGHT_CHROMIUM_PATH`); otherwise `npx playwright install chromium`.
- **Consequences:** `test-results/` is git-ignored. E2E is part of the standard phase checks from now on.

## ADR-041 — Recommendation engine implemented with code-level tuning constants

- **Date:** 2026-09-30 · **Status:** Superseded by ADR-050 for the tuning constants (now in `content/engine-settings.json`)
- **Context:** The convention content seed must prove that persona-only, challenge-only, persona + challenge,
  exploration-only and blended journeys produce relevant results. That needs the engine now (Phase 3 work).
- **Decision:** `src/domain/recommendations/engine.ts` is a pure function over `PublicContentBundle`. Rule
  weights stay in content. Combination constants (scene cap 3, hotspot cap 8, hotspot affinity 2, engaged
  bonus 1, implied-challenge factor 0.5 capped at 3, default 3 results) live in `engine-config.ts`, because
  they are engine behaviour, not sales content. Every contribution is recorded as a `MatchedSignal` with a
  `kind`. "Why this appeared" is generated from the matched signals (quoted labels, so no grammar
  guessing). Implied signals are phrased as "related to what you explored". The rule template becomes a
  claim-free "relevance" sentence, and `fallbackExplanation` is now required only when the template uses
  placeholders. `RecommendationItem.explanation` is replaced by `whyThisAppeared` + `relevance`.
- **Consequences:** Coverage (what each persona, challenge or hotspot alone yields) is generated into
  CONTENT_VALIDATION.md §11.10 for sales review. `maxAchievableScore` is cap-aware.

## ADR-042 — Sales-review worksheet stored with each solution; CSV export generated from seed data

- **Date:** 2026-09-30 · **Status:** Accepted
- **Decision:** `Solution.salesReview` holds `decision` (pending/keep/remove/rename), `proposedName`,
  `puertoRicoAvailability` (requires-verification/available/not-available), `conventionPriority` and
  `priorityConfirmedBySales`. The schema enforces consistency with `validationStatus`: validated ⇒ available
  and kept or renamed; removed or not-available ⇒ unavailable. It is internal and stripped by the visibility
  filter. `npm run content:export` generates `exports/content-validation.csv` (every content item, blank
  `sales_*` columns, UTF-8 BOM, CRLF, formula-injection guard) and the Markdown sections between markers
  in CONTENT_VALIDATION.md §11. `--check` runs in `npm run check`, and a unit test fails when the committed
  files are stale.
- **Consequences:** Sales can work in Excel or through the JSON. Decisions and the documentation cannot drift.

## ADR-043 — Stricter claim policy for convention content

- **Date:** 2026-09-30 · **Status:** Accepted
- **Decision:** The prohibited-claim scan also rejects local-availability wording ("disponible/available en/in
  Puerto Rico"), regulatory and standards references (NFPA, FDA, OSHA, CMS, USP, Joint Commission, ISO
  numbers), cost-reduction wording, performance wording ("24/7", "uptime", "sin interrupciones"), ™ ® ©, and
  superlatives. A manual review softened statements that implied outcomes or clinical guidance, for example
  "supply **and use** of medical oxygen" → "supplying medical oxygen", "makes it possible to act in time" →
  "teams often want to know the status before it becomes urgent", and "procedures to maintain supply" →
  "supply procedures for …".
- **Consequences:** Descriptions state scope and potential relevance only. Any future need for such wording
  requires a new ADR.

## ADR-044 — Token-based touchscreen design system

- **Date:** 2026-09-30 · **Status:** Accepted
- **Decision:** `src/styles/tokens.css` defines the design tokens with Tailwind 4 `@theme`: semantic brand
  colors (including new info, success and danger pairs in brand-config, all contrast-tested), a
  kiosk-readable type scale whose minimum is 1rem (about 23 px on the kiosk), touch spacing (48/64/80 px),
  radius, subtle shadows, easing and animations, plus a shared `focus-ring` utility. Components live in
  `src/components/{shell,actions,cards,navigation,explorer,content,overlay,forms,feedback}`, take content
  strings already localized, and use `useLanguage()` for their own labels. `LanguageProvider` moved to
  `src/lib/i18n` so shared components don't depend on a feature. The earlier Button, StatusScreen and
  LanguageSwitcher were replaced (not duplicated) by PrimaryAction/SecondaryAction, the feedback states and
  LanguageToggle.
- **Accessibility rules:** targets ≥ 48 px (defaults 64 px); visible labels; state in ARIA (`aria-pressed`,
  `aria-current`, `aria-invalid`, `aria-disabled` for explainable disabled cards); color never the only
  signal; animation only under `motion-safe:` plus a global reduced-motion override; no glass or blur effects.
- **Overlays:** `Modal` and `Sheet` wrap the native `<dialog>` with `showModal()`, so the browser provides
  focus containment, Esc, an inert background and focus return. Initial focus uses `data-autofocus`, applied
  after `showModal()`, because React's `autoFocus` fires before the dialog opens. The backdrop colour is a
  literal, since `::backdrop` may not inherit custom properties.
- **Consequences:** Kiosk screens (Phases 4–7) compose these components. The Motion library remains unused
  until the explorer's zoom transitions need it (Phase 6).

## ADR-045 — Development-only component gallery gated before rendering

- **Date:** 2026-09-30 · **Status:** Accepted
- **Decision:** `/dev/components` shows every component with real seed content and live engine output. It is
  enabled under `next dev`, and in production only when `ENABLE_COMPONENT_GALLERY=true`. The gate
  (`isComponentGalleryEnabled`) runs in `src/proxy.ts`, which returns a real HTTP 404 before rendering, and
  again in the page. Page-level `notFound()` alone would stream a 200 status because of the root
  `loading.tsx` Suspense boundary. The route is `noindex` and never linked.
- **Consequences:** E2E tests run a second production server with the flag, to prove both the default 404
  and the enabled gallery.

## ADR-046 — Component tests with Testing Library in a jsdom Vitest project; readiness markers for E2E

- **Date:** 2026-09-30 · **Status:** Accepted
- **Decision:** Vitest `projects`: `unit` (node) and `components` (jsdom, `@testing-library/react`,
  `user-event`, `jest-dom`, a `<dialog>` polyfill). E2E waits for React to be interactive before acting:
  `<html data-hydrated>` covers the shell, and pages inside the root Suspense boundary expose their own
  marker via `useHydrated()`. Earlier intermittent E2E failures came from key presses sent before hydration.
- **Consequences:** Interaction tests are deterministic. Phase 4 can use `useHydrated()` to ignore taps made
  during hydration.

## ADR-047 — Kiosk session store, reset flow and per-visit accessibility

- **Date:** 2026-09-30 · **Status:** Accepted
- **Context:** The attract and welcome phase needs a session store that never carries one visitor's
  selections to the next. The kiosk LAN is plain HTTP, and a passer-by may leave the screen in English or
  with large text on.
- **Decision:**
  - The session store is a pure reducer (`src/features/kiosk/state/kiosk-state.ts`) behind a React
    context (`KioskSessionProvider`), with no global state library (ADR-005). A session exists only after
    the first touch.
  - Actions other than `START_SESSION` are ignored while there is no session.
  - `RESET` returns the initial state with a new `resetCount`, used as a remount key.
  - Session ids are opaque UUID v4 values. `crypto.randomUUID` is used when available. Otherwise the id is
    built from `crypto.getRandomValues`, because `randomUUID` is missing in insecure (HTTP) contexts.
  - Reset order: dispatch `RESET`, restore Spanish, clear accessibility attributes, then
    `window.location.replace("/")`. The hard reload is injectable for tests. The anonymous `sendBeacon`
    summary is added in Phase 7, where `/api/sessions` exists.
  - The idle timer ignores global activity while the "¿Sigue ahí?" warning is open, so only the warning's
    own buttons decide.
  - Accessibility options (larger text, reduced motion) belong to the session and are applied as
    `data-*` attributes on `<html>`. The system `prefers-reduced-motion` setting is honoured regardless.
  - The attract screen reverts to Spanish and its first phrase after 30 s without touches.
  - Navigation choices use a new `ActionCard` (a button without `aria-pressed`, unlike the selectable
    `TouchCard`).
  - Public content is loaded once per mode through `getPublicContent()` and validated at server boot in
    `instrumentation.ts`.
  - The attract motion uses CSS keyframes rather than the Motion library.
- **Consequences:** Leak-free resets are covered at three levels: reducer unit tests, component tests and
  E2E with a real reload. Path screens remain placeholders until Phases 5–6. Invalid content now stops the
  server at boot instead of failing on the first request.

## ADR-048 — Role journey: several-areas persona, derived recommendations and anonymous session events

- **Date:** 2026-09-30 · **Status:** Accepted
- **Context:** The "Trabajo en…" path must accept "My role spans several areas", offer "Something else"
  without free text, calculate recommendations immediately, and record only non-personal session events.
- **Decision:**
  - **Several areas:**
    - "My role spans several areas" is a content persona (`multiple-areas`) with the new field
      `scope: "multiple"`, so its label is reviewed with the rest of the content and hidden in production
      until validated.
    - The bundle check allows at most one such persona and rejects any rule that weights it, because it names
      no area.
    - Its recommendations come from the challenges chosen, or the fallback when none are chosen.
  - **Something else:**
    - "Algo más / Something else" is a UI option, not a challenge: it is stored as
      `ActiveSession.otherChallengeSelected` plus an event, does not count toward the limit of three, and never
      shows a text field.
    - `SessionSignals` (the engine input) is unchanged.
  - **Recommendations:**
    - They are derived, not stored first: `KioskExperience` memoizes `recommend(signals, content)`, so they
      exist as soon as a persona is selected.
    - The snapshot is written to the session when shown, only if it changed. The engine and its result schema
      were already explainable (`matchedSignals` and bilingual `whyThisAppeared`) and stay unchanged.
  - **Session events:**
    - `SessionEvent` is `{seq, type, targetId}` in a strict schema.
    - The reducer maps actions to events itself; UI code never writes events.
    - A target must be a kebab-case id containing a letter. Free text, email addresses and digit-only strings
      such as phone numbers are dropped.
    - There are no timestamps, and the list is capped at 200 per session.
  - **Transition:** the tailoring transition is a real screen with a configurable duration
    (`kiosk.tailoringTransitionMs`, 1.8 s) announced as a status.
  - **Persona text:** descriptions are shortened to about two lines so all 11 options fit the kiosk screen.
    Labels keep the owner-provided names.
- **Consequences:**
  - Events are not yet part of `VisitorSession`. Phase 7 decides whether the anonymous summary includes them.
  - Path B and the explorer reuse `ChallengePicker`, `ScreenFrame` and the next-steps pattern.
  - The optional facility-type step is still to do.

## ADR-049 — 2D illustrated scene engine, generated placeholder art and recommendation threshold

- **Date:** 2026-09-30 · **Status:** Accepted
- **Context:** The explorer must feel spatial on a portrait kiosk, laptop and phone. It must stay 2D (no
  Three.js, Babylon.js, WebGL or free camera), keep hotspots aligned with the art at every size, work with
  reduced motion, and be easy to re-calibrate when approved art arrives.
- **Decision:**
  - **Art box:** one canonical box, `SCENE_ART` (1200 × 1500), for every layer.
    - Hotspot `x`/`y` are percentages of it.
    - The viewer fits the box with container-query units and `overflow: clip`.
  - **Hotspot layout:** a pure function lays hotspots out for the measured size.
    - It keeps authored points when there's room, pushes overlapping markers apart deterministically, and
      chooses label placement and alignment.
    - Small boxes (< 36 rem) use compact markers (≥ 48 px) and show labels on touch or focus only.
  - **Scene transitions:** zoom-in into a child, zoom-out to an ancestor, pan between siblings.
    - They use CSS keyframes on `transform` and `opacity` (560 ms) with a temporary inert outgoing layer.
    - With reduced motion the scene swaps instantly.
    - The Motion library is not needed.
  - **Placeholder art:** generated from code (`scripts/placeholder-art.ts`) rather than hand-drawn files.
    - Each drawing registers its hotspot anchors, and `--sync-content` writes them into content, so art and
      hotspots cannot drift apart.
  - **Content rules:**
    - The content check warns about scenes missing a hotspot type and about hotspots closer than 8 %.
    - Seven hotspots were added so every scene has all three types (content v0.4.0).
  - **Recommendation threshold:** "Ver mis recomendaciones" uses a configurable `RECOMMENDATION_THRESHOLD`.
    - It is met by any of: a role, ≥ 1 challenge, ≥ 3 opened hotspots or ≥ 1 explicit interest.
    - This refines the brief's default (role + ≥ 1 challenge) because the role journey already shows
      preliminary recommendations from the role alone (ADR-048).
  - **Session:** it stores `currentSceneId`, which lets the explorer reopen where the visitor left it.
    `scene-visited` is recorded on every entry, and the signal lists each scene once.
  - **Back navigation:** `previousScreen` gives shared screens a sensible "Volver". The explorer's "Volver"
    goes up the scene tree.
  - **Calibration:** a developer page at `/dev/scenes` with its own flag, `ENABLE_SCENE_CALIBRATION`. It is
    404 in production unless enabled, enforced by both the proxy and the page. It is never linked from the
    visitor UI.
- **Consequences:**
  - Replacing art means drawing on the same box and re-checking coordinates with `/dev/scenes`.
  - Hotspots may move slightly on phones to avoid overlap; the E2E tests bound this to 1.5 marker
    diameters.
  - Transition smoothness on the real Android kiosk is still to be measured (Phase 10).

## ADR-050 — Engine v2: data-file tuning, tiered explainable output, readiness service, conversion prompt

- **Date:** 2026-09-30 · **Status:** Accepted (supersedes ADR-041's code constants and ADR-049's threshold)
- **Context:** The engine must use whole-number weights from data files, exclude content by status and mode,
  resist repeated interactions, break ties deterministically and return tiered, explainable output.
  "Ready" must follow explicit conditions, and a conversion prompt must never interrupt the visitor.
- **Decision:**
  - **Settings file:** tuning moves to `content/engine-settings.json`, validated by `EngineSettingsSchema` as
    part of the content bundle and passed to the kiosk with the public content. It holds:
    - scene and hotspot caps, the engagement bonus, the affinity weight, the implied-challenge divisor and
      its cap;
    - primary and secondary result sizes;
    - relevance thresholds;
    - readiness thresholds.

    All values are whole numbers. Rule weights (1–10) and `minimumScore` are now integer-only in the schema.
    Implied challenges count as ⌊weight ÷ divisor⌋, with a minimum of 1, so no fractional score can occur.

  - **Engine v2 (`ENGINE_VERSION` 2.0.0):**
    1. Normalize (dedupe and drop hidden ids).
    2. Apply exclusions before scoring.
    3. Skip, defensively, any solution not visible in the result's mode.
    4. Score with caps.
    5. Sort by score, then explicit score, then priority, then id.

    The output is ≤ 3 `primary` items then ≤ 3 `secondary` items. Each item carries a `relevanceLevel`
    (high, medium or possible: words, never a percentage), the reason, `sceneId`, validated
    `digitalAssetIds` only, the next step and `validationStatus` for internal use. The lead score stays a
    separate, server-only concern.

  - **`RecommendationReadiness.assess()`:** ready when any of these holds: a role plus ≥ 1 challenge, ≥ 2
    challenges, meaningful interaction in ≥ 2 distinct scenes, or ≥ 3 unique meaningful hotspots.
    - Meaningful means an information or solution panel was opened; navigation is not meaningful.
    - Readiness gates the explorer's "Ver mis recomendaciones" (also shown once the visitor has already seen
      recommendations) and the prompt.
    - The role journey's explicit "Ver recomendaciones preliminares" option stays, because the visitor asked
      for it.
  - **Conversion prompt:** a pure `conversionPromptDecision` plus a hook.
    - It is blocked by any open `<dialog>` (MutationObserver), by a focused form field, for 2.5 s after a
      scene change and 1.5 s after an interruption, and for 2 minutes after it was last shown.
    - It is allowed only on the explorer (and future path B) screens.
    - It never takes focus. Showing, accepting and dismissing it are recorded as anonymous events.
    - Timings live in `app-config.ts`.
  - **Recommendations screen:** it shows the relevance chip, a "También podría interesarle" section, approved
    resources, and "Verlo en el hospital", which opens the explorer at the relevant scene.
- **Consequences:**
  - Sales or marketing can retune the engine by editing one validated data file, then running
    `npm run content:export` to refresh the coverage tables.
  - Persona-only visitors are no longer "ready" in the explorer until they add a challenge or explore
    meaningfully, but they can still open preliminary recommendations from the role journey.
  - The recommendation snapshot's shape changed (tiers and extra fields). No stored data existed yet
    (Phase 7), so no migration is needed.

## ADR-051 — Value screen, evidence-based stable recommendations, path B and the explorer tray

- **Date:** 2026-09-30 · **Status:** Accepted
- **Context:** The visitor-facing recommendations must show value before any form, never pressure the
  visitor or overclaim, mark demo content, preserve progress, update when there is new meaningful evidence,
  and not reshuffle cards after trivial interactions.
- **Decision:**
  - **Value screen:** the heading, a summary, a disclaimer (not a complete assessment or clinical advice), a
    demo notice, 3 primary plus ≤ 3 secondary cards and a single primary action, "Enviarme mi resumen
    personalizado".
    - That action leads to a summary-request screen that explains the summary and how contact details and
      consent are handled. It records the `summary-requested` event. The lead form stays in Phase 7.
    - The secondary actions are continue exploring, review my priorities and start over (with confirmation).
    - A unit test enforces the copy rules on every UI string.
  - **Recommendation evidence:** only evidence drives recommendations: choices, content opened and the scenes
    where content was opened. Navigation and passing through scenes never do.
    - `recommendationEvidence` defines evidence and `evidenceKey` decides when to recalculate.
    - The Phase 7 server recomputation must use the same evidence function.
  - **Order stability:** `stabilizeRecommendations` keeps the order the visitor last saw unless the set changed
    or a swap is backed by ≥ `results.reorderMargin` points (seed 2, in `engine-settings.json`).
    - `recommendationChanges` drives the "Nuevo" marks and the "updated" notice. It covers new cards and
      changed order, relevance or reasons.
  - **Resources:** they now include demo-status (assumed) assets in demo mode, marked "pendiente de
    validación". Placeholder or unavailable assets are never offered, and production offers validated
    assets only. This relaxes ADR-050's validated-only rule, as the prompt asked for "approved or demo-status
    resources".
  - **Path B "Necesito…":** all challenges (≤ 3, or "Algo más"), then an optional role, then the tailoring
    transition, then recommendations. `PathScreen` placeholders are removed.
  - **Explorer tray:** a compact "Vista rápida" sheet with the current primary recommendations and new marks.
    Opening it commits the snapshot.
  - **Conversion prompt screens:** now only the explorer; selection screens count as the visitor "still
    choosing".
- **Consequences:**
  - Exploration adds weight to recommendations only through content the visitor actually opened. Scenes merely
    visited no longer score, which is a deliberate change from the engine's raw-signal tests (those still pass
    on raw signals).
  - The facility-type step and path C's optional "tailor" step remain open.

## ADR-052 — Lead storage: Prisma 7 + better-sqlite3, layered services, idempotent submissions, opaque status tokens

- **Date:** 2026-09-30 · **Status:** Accepted (implements ADR-010 and ADR-011's storage half; amends ADR-038;
  replaces the planned data model in ARCHITECTURE §9.3 for this phase)
- **Context:** The phase brief defines the stored data: `Lead`, `LeadInterest`, `VisitorSessionSummary` and
  `EmailDelivery` with specified fields. It asks for migrations, a safe seed, repository/service layers,
  transactions, leads surviving email failures, double-tap protection by request token, Zod validation,
  email normalization, masked logs, backup/export guidance, a retention placeholder and three routes (create,
  status by opaque token, health), with no listing endpoint. The earlier architecture draft planned more
  tables (snapshot, report, consent records, delivery events, audit log) and a lead score.
- **Decision:**
  - **Stack:** `prisma@7.10.0`, `@prisma/client@7.10.0`, `@prisma/adapter-better-sqlite3@7.10.0`, and
    `better-sqlite3@12.11.1` (pinned, ADR-010). The client is generated to `src/generated/prisma`
    (git-ignored) by `postinstall`, `build` and `typecheck`. `prisma.config.ts` reads `DATABASE_URL` from the
    shell with the same default as `env.ts`. Driver timeout is 5 s for lock waits.
  - **Data model:** exactly the brief's four models, plus `SessionSummaryItem`, which holds challenges,
    scenes, hotspots and recommendation ids as normalized, de-duplicated related records (not JSON, not
    events).
    - Extra `Lead` columns needed by the requirements: `idempotencyKey` (unique), `requestFingerprint`,
      `statusTokenHash` (unique), `contentVersion`.
    - `EmailDelivery` adds `nextAttemptAt` for retries.
    - Relevance is stored in words (`high`/`medium`/`possible`), never as a score.
    - `Lead.status` is `active | archived | erasure_requested`. No workflow uses the last two yet; they exist
      so post-event handling does not need a migration. `roleLabel` is the Spanish persona label.
  - **Deferred, not dropped:** `RecommendationSnapshot`, `Report`, `ConsentRecord` rows and
    `EmailDeliveryEvent` history (Phase 8); `AdminAuditLog` (Phase 9); the server-only lead score (Phase 7b,
    with the form). Consent wording is identified by `consentTextVersion`; the texts are versioned in git.
  - **Database constraints:** SQLite stores enums as TEXT, so the initial migration adds hand-written `CHECK`
    constraints for every enum, `attempts ≥ 0`, the `errorCode` shape and `reportConsent = 1`. Prisma does
    not model them; a test fails if a future table-redefining migration drops them. Foreign keys cascade from
    `Lead` to interests and deliveries (erasure deletes them); the anonymous session summary remains.
  - **Layers:** route handler → `lead-http.ts` (HTTP mapping) → `lead-service.ts` (use case) → repositories
    (`lead-repository.ts`, `email-delivery-repository.ts`) → Prisma. Only `db/client.ts` and the repositories
    import Prisma (the CLI export module and scripts are admin tooling). A unit test enforces the boundaries.
  - **Transaction:** summary upsert (+ item replacement), lead, interests and a `pending` email delivery are
    written in one interactive transaction. Email outcomes update only `EmailDelivery`
    (`recordAttempt`: `retrying` with exponential backoff capped at 1 h, `failed` at the ceiling or on a
    permanent error, `sent` with the provider message id). Any provider error becomes a sanitized
    UPPER_SNAKE code; raw messages and responses are never stored or logged.
  - **Idempotency:** the kiosk sends a v4 UUID request token per form (`idempotencyKey`, nil UUID rejected).
    - The same token with the same normalized payload (SHA-256 fingerprint, client clock excluded) returns
      the original result (HTTP 200, `replayed: true`).
    - The same token with a different payload returns 409.
    - When two taps race past the lookup, the unique index makes the loser answer as a replay.
  - **Status token:** `base64url(HMAC-SHA256(key = idempotencyKey, msg = "lead-status:v1:" + leadId))`.
    - It is unguessable without the request token.
    - It is re-derivable, so replays return the same token without storing it; only its SHA-256 is stored.
    - It is separate from the request token because it travels in URLs.
    - The status response contains only `{ submission: "stored", report: <delivery state> }`. Unknown and
      malformed tokens both answer 404.
  - **Validation:** strict Zod schema (unknown keys such as notes or patient fields are rejected). Email is
    trimmed and lower-cased (ASCII addresses only). The server also checks the submission against the
    served content: consent version, role id, interest ids, and a session start that is not in the future.
    Signal ids unknown to the content are dropped before storage. Recommendations are recomputed from
    `recommendationEvidence` (ADR-025, ADR-051). Requests must be JSON (which forces a CORS preflight
    cross-site) and ≤ 16 KB. Responses never echo submitted values.
  - **Logging:** `src/server/logging/logger.ts` writes single-line JSON. It masks personal keys (email →
    `m***@domain`, names → initial, phone → last two digits, organization and tokens redacted) and any
    email-looking string anywhere. Services log ids and outcomes only.
  - **Health:** the probe stays on synchronous `node:sqlite` (it must work even if the Prisma client cannot
    start). `ready` now also requires every `prisma/migrations` folder to be applied.
  - **Seed:** `npm run db:seed` stores two synthetic leads (`example.test`, "(ficticio)") through the real
    service, refuses `NODE_ENV=production`, and is idempotent (fixed request tokens and timestamps).
  - **Operations:** `db:backup` (SQLite online backup API, safe while running) and `db:export` (CSV, UTF-8
    BOM, formula-injection guard, file mode 600). Both are CLI-only (ADR-024).
  - **Retention:** `LEAD_RETENTION_DAYS` is a placeholder. Unset means no period is configured, and nothing
    is deleted automatically. The period is Q7 (owner/compliance).
- **Consequences:**
  - A stored lead survives any email failure. Double taps and retries never create duplicates.
  - Contact data appears only in the database file, backups and CSV exports, which the README covers.
  - Recommendations stored on the server follow the engine's ranking. The kiosk's order-stability layer can
    show an older order, so the Phase 8 report must decide which order to present.
  - `npm audit` reports high-severity advisories in the Prisma CLI's transitive dependencies (`mysql2`,
    `deepmerge-ts`). They affect the dev-time CLI, not the SQLite runtime path; revisit on the next Prisma
    7.x patch.
  - Still open: per-IP rate limiting, the lead form, consent records, and verifying better-sqlite3 prebuilds
    on the Windows laptop.

## ADR-053 — Lead form: three touch steps, local-only contact state, status-aware confirmation

- **Date:** 2026-09-30 · **Status:** Accepted
- **Context:** The lead capture UI must follow the recommendations. It must be optimized for touchscreen
  typing, validate inline, keep two distinct consents with configurable versioned text, prevent double
  submission and show progress. The lead must be stored before email is attempted, an email failure must be
  explained without technical details, success must show a masked email, nothing may remain after reset,
  and "Correct my information" and cancel must be available.
- **Decision:**
  - **Flow:** the summary explainer's "Completar mis datos" opens a `lead-form` screen with three steps:
    contact details (five inputs, so the on-screen keyboard leaves them visible), preferences and permissions,
    and review. Review offers "Corregir mis datos" (back to step 1, everything kept) and "Enviar mi resumen".
    Cancel is always available; it asks for confirmation when contact data was typed and returns to the
    recommendations with the session untouched.
  - **Prefill:** the role comes from the session persona (required; a native select when missing), the
    report language from the current UI language, and interests from chosen challenges, primary recommended
    solutions and explicit interests (pre-selected, ≤ 15, removable).
  - **Validation:** the client reuses the server's Zod field schemas (exported from `lead-submission.ts`) with
    localized messages. Blur validates non-empty fields; a field with an error is re-checked as it changes;
    "Continuar" validates the step, shows a summary and focuses the first invalid field. Server 422 issues map
    back onto fields; the server stays authoritative.
  - **Consents:** two `ConsentCheckbox` controls, both unchecked by default, using the text in
    `content/consent.json`. The version is shown, and a "pending legal and privacy review" notice appears while
    `validationStatus` is not `validated`. The report permission is required; the follow-up permission is
    optional and independent.
  - **Submission:** an in-flight ref plus replacing the button with the sending view prevent double requests.
    The request token (v4 UUID) is reused for a retry of identical data and rotated when data changes or after
    a 409. Requests time out after 15 s and are treated as failures, which is safe to retry.
  - **Email outcome:** after the server stores the lead, the client polls the status endpoint up to 3 times,
    1.2 s apart. It shows `sent`, `delayed` (failed or retrying: "saved, we will try again automatically") or
    `queued` (still pending: "saved, we will send it shortly"). The email worker is Phase 8, so real
    submissions currently end as `queued`.
  - **Privacy:** contact values live only in `LeadFormScreen` state, never in the kiosk session store or
    browser storage. They are cleared once the lead is stored and discarded on cancel, and every reset
    unmounts the component and hard-reloads. The result shows `maskEmailForDisplay` (first one or two
    characters, `•••`, full domain so typos are recognizable). The confirmation auto-resets after
    `confirmationResetMs` (15 s) or on "Terminar". While the form is open, the inactivity allowance is the
    configured 120 s + 20 s.
  - **Events:** `lead-form-opened`, `lead-form-cancelled` and `lead-submitted` are added to the anonymous
    session events, with no target and no personal data.
- **Consequences:**
  - The visitor never sees a delivery claim the server has not confirmed.
  - A lost response followed by a retry never creates a second lead.
  - The consent text shown is identified by its version only; storing the exact text and language per
    consent (ConsentRecord) is part of Phase 8.
  - The report language can differ from the UI language; the consent text is shown in the UI language.
