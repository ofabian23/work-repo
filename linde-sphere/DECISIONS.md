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

- **Date:** 2026-09-29 · **Status:** Accepted
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

- **Date:** 2026-09-29 · **Status:** Accepted
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

- **Date:** 2026-09-29 · **Status:** Accepted
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

- **Date:** 2026-09-29 · **Status:** Accepted
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
