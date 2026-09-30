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

- **Date:** 2026-09-29 · **Status:** Accepted (amends ADR-010 timing)
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

- **Date:** 2026-09-30 · **Status:** Accepted (amends the planned `content/settings.json`)
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
