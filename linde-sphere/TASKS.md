# Linde Sphere — Task Plan

Legend: `[x]` done · `[ ]` to do · `[~]` in progress · `[!]` blocked.
Each phase ends with: checks run, errors fixed, and a summary (files changed, commands run, validation
results, assumptions, remaining risks). Every phase must leave the app in a working state.

**Standard phase checks** (once the project exists): `npm run lint` · `npm run typecheck` · `npm run test`
· `npm run content:check` · `npm run build` · `npm run test:e2e` (from Phase 4 on).

---

## Phase 0 — Discovery and documentation ✅

- [x] Inspect the repository (existing `client-facing/` UBI-K-LO project is unrelated and left untouched)
- [x] Check the toolchain (Node 22.22, npm 10.9, Next.js 16.3.7 stable, Prisma 7.10 stable, Playwright Chromium present)
- [x] PROJECT_BRIEF.md — scope, journey, personas, environments, MVP/non-MVP, acceptance criteria
- [x] ARCHITECTURE.md — stack, layout, state machine, content model, engine, data model, outbox, privacy
- [x] DECISIONS.md — ADR-001 … ADR-026 (later phases add more)
- [x] TASKS.md — this plan
- [x] CONTENT_VALIDATION.md — statuses, visibility matrix, workflow, registers

## Phase 1 — Project foundation ✅

- [x] Scaffold Next.js 16.3.7 (App Router, TS strict + `noUncheckedIndexedAccess`, Tailwind 4, ESLint, `src/`, `@/*` alias); adapted, not recreated
- [x] Folder structure: `src/app`, `components`, `features`, `lib`, `data`, `types`, `styles`, plus existing `domain` and `server`; `public/assets` (ADR-034)
- [x] Centralized app config (`src/lib/config/app-config.ts`) and Zod-validated brand config with placeholder values and no logo (`brand-config.ts`)
- [x] ES/EN typed dictionaries (`src/data/i18n`), `translate()`, `LanguageProvider` + `useLanguage()`, large `LanguageSwitcher` (ADR-035)
- [x] Portrait kiosk `AppShell` (wordmark, language switch, demo-mode footer), home screen, brand CSS variables → Tailwind tokens, kiosk hardening CSS
- [x] Global `error.tsx` (Next 16 `retry`), `global-error.tsx` (bilingual), `not-found.tsx`, `loading.tsx`
- [x] `src/server/env.ts` Zod env validation at boot via `instrumentation.ts`; `.env.example` (names only) (ADR-037)
- [x] `GET /api/health`: app, configuration, content and SQLite readiness, no secrets, `no-store` (ADR-038)
- [x] Scripts: `dev`/`start` (localhost), `dev:network`/`start:network` (0.0.0.0), `build`, `lint`, `typecheck`, `test`, `test:e2e`, `check`; `allowedDevOrigins` for LAN (ADR-039)
- [x] Prettier; Vitest with `server-only` alias; Playwright (kiosk/laptop/phone projects, preinstalled Chromium fallback) (ADR-040)
- [x] README: exact run commands, localhost versus local-network access, kiosk connection steps, health check
- [x] Security headers; removed scaffold Google-font import and demo assets (ADR-018)
- **Deferred (with rationale):** Prisma + migrations → Phase 7, the first phase that stores data (ADR-038). PII-safe logger → Phase 7. Testing Library/jsdom → first component tests (Phase 4). Self-hosted font → replaced by the system font stack (ADR-018 amendment).
- **Verified:** dev server starts; home renders; ES/EN switch; layout at 1080×1920, 1440×900 and 390×844; lint, typecheck, unit and E2E tests pass; build clean.

## Phase 2 — Content model and seed content ✅

- [x] Strict Zod schemas + inferred types: Persona, Challenge, FacilityType, Scene, Hotspot, Solution, DigitalAsset, RecommendationRule, ConsentTextSet, ContentManifest
- [x] Runtime schemas: VisitorSession (+ SessionSignals), RecommendationResult, LeadSubmission (+ response), ConsentRecord, ReportPayload, EmailDeliveryEvent
- [x] Governance invariants (ADR-027), hotspot geometry (ADR-029), rule model with thresholds/exclusions/templates/priority (ADR-028)
- [x] Cross-record checks (`checkContentBundle`) incl. prohibited-claim scan and unreachable thresholds
- [x] `visibleContent(bundle, mode)` with reference pruning and internal-field stripping (ADR-032)
- [x] Seed content: 10 personas, 12 challenges, 7 facility types, 8 scenes with 24 hotspots, 13 solutions (all `assumed`, requiring PR sales validation), 12 rules, 3 placeholder assets, draft consent, manifest
- [x] Loader with per-file errors (`src/server/content/load-content.ts`) + `npm run content:check` (demo/production/strict, exit codes)
- [x] 171 unit tests covering schema success/failure, cross-checks, loader errors, visibility, seed content
- **Moved to later phases:** `settings.json`, `report.json`, `sales-contacts.json` (Phases 3–8); brand config and ES/EN dictionaries with `t()` were delivered in Phase 1; cached server loader that refuses to boot on invalid content (delivered in Phase 4: `public-content.ts` + `instrumentation.ts`); placeholder SVG files (Phase 6)

## Phase 2b — Convention-focused content seed ✅

- [x] 10 personas (unchanged); 12 customer-language challenges (v0.2.0 list: aging infrastructure, visibility and monitoring, cylinders and inventory, patient and staff safety, clinical workflow, …)
- [x] 10 assumed solution categories + fallback, each marked **PENDING PUERTO RICO VALIDATION** with a `salesReview` worksheet (decision, proposed name, PR availability, convention priority) (ADR-042)
- [x] Scenes/hotspots reworked around the new categories (27 hotspots); placeholder assets relinked
- [x] Deterministic rules (threshold 3) covering persona-only, challenge-only, persona + challenge, exploration-only and blended journeys, with a plain-language "Why this appeared" for every recommendation
- [x] Wider prohibited-claim scan (local availability, regulatory references, cost reduction, uptime, trademarks, superlatives) and manual wording review; ambiguous statements softened (ADR-043)
- [x] `npm run content:export` → `exports/content-validation.csv` + generated CONTENT_VALIDATION.md §11 (Keep, Remove, Rename, Available / Not available in PR, Requires verification, Missing asset, Priority at convention, coverage); `--check` in `npm run check`

## Phase 3 — Recommendation engine and lead scoring (pure logic)

- [x] Engine tuning in `content/engine-settings.json`: whole-number caps, bonus, affinity, implied divisor, result sizes, relevance and readiness thresholds (ADR-050, supersedes ADR-041's code constants)
- [x] Signal normalization (unknown/hidden ids, duplicates), per-type caps, implied challenges, hotspot affinity, engaged bonus
- [x] `recommend()` with weights, exclusions, thresholds, tie-breakers, top-N, fallback; output validated against `RecommendationResultSchema`
- [x] "Why this appeared" generation (ES/EN, quoted labels) + relevance template rendering with placeholder fallback
- [x] Unit tests: five journey types, full persona/challenge/hotspot coverage, determinism and order independence, exclusions, thresholds, tie-breaks, caps, fallback, production mode
- [x] Engine v2 (ADR-050): integer weights enforced by schema, exclusions before ranking, defensive mode/status
      filtering, 3 primary + ≤ 3 secondary, relevance label in words, relevant scene, approved assets only,
      next action, internal validation status; lead score never part of the result
- [x] `RecommendationReadiness` service (role + challenge · 2 challenges · 2 distinct scenes · N unique
      meaningful hotspots) replacing the Phase 6 threshold
- [x] Contextual conversion prompt ("Encontramos oportunidades…") with a pure scheduling policy: never while a
      dialog is open, during data entry, right after a scene change, or more than once per interval
- [x] Unit tests: deterministic scoring, exclusions, duplicate interactions, readiness, demo vs production
      filtering, explanation generation, tie-breaking, prompt policy; component + E2E tests for the prompt
- [ ] `lead-scoring.ts` (server-only) + `config/lead-scoring.json` + tests
- **Done when:** lead scoring is implemented and tested; the engine suite already passes with no I/O in `src/domain`.

## Phase 3b — Touchscreen design system ✅

- [x] Design tokens (`src/styles/tokens.css`): color, typography, spacing/touch, radius, shadow, motion, focus ring; status color pairs in brand config (ADR-044)
- [x] Components: AppShell, KioskHeader, LanguageToggle, PrimaryAction, SecondaryAction, TouchCard, PersonaCard, ChallengeCard, ProgressIndicator, SceneBreadcrumb, HotspotButton, RecommendationCard, SolutionPanel, BottomActionBar, Modal/Sheet, ConsentCheckbox, FormField, StatusBanner, InactivityWarning, ResetExperienceButton, LoadingState, EmptyState, ErrorState
- [x] Keyboard operability, visible focus, reduced motion, ≥ 48 px targets, logo only if approved and local
- [x] Dev-only gallery `/dev/components`, 404 in production unless `ENABLE_COMPONENT_GALLERY=true` (proxy + page gate) (ADR-045)
- [x] Component tests (Testing Library + jsdom) and gallery E2E at kiosk, laptop and phone sizes (ADR-046)

## Phase 4 — Kiosk shell (attraction and welcome) ✅

- [x] Session store: pure reducer + context in `src/features/kiosk/state/` (no global state library), opaque
      UUID v4 session id (HTTP-safe fallback), no personal data; tracks entry path, role, challenges, facility,
      scenes, hotspots (opened/engaged), interests, recommendations and per-visit accessibility (ADR-047)
- [x] Reducer unit tests (start, paths, selections, caps, reset, no leakage between visitors)
- [x] Root layout: viewport, `lang`, brand CSS variables, fonts (Phase 1) + session provider and header actions
- [x] Attract screen: product name, rotating ES value phrase, bilingual "touch to begin", calm motion,
      whole screen is the target; returns to Spanish after 30 s idle; remounts to its initial state on reset
- [x] Welcome screen: three paths (Trabajo en… / Necesito… / Explorar el hospital), language switch,
      accessibility options (larger text, reduced motion), discreet reset, privacy link, recommendations
      promise, no contact fields
- [x] Idle timer + "¿Sigue ahí?" overlay + reset controller (in-memory reset, language back to ES, hard reload)
- [x] Component tests (start, reset, timeout reset, language, each entry path, back to welcome, accessibility)
- [x] E2E at kiosk, laptop and phone sizes: attract → welcome, language, three paths and back, explicit reset
      with real reload, privacy sheet, reduced motion, 1080 × 1920 fit without scrolling
- [x] Shared components (delivered in Phase 3b) + `ActionCard` for navigation choices
- [ ] Path screens are honest placeholders ("se completa en la próxima fase") → replaced in Phases 5–6
- [ ] Anonymous session summary via `sendBeacon` on reset → Phase 7 (needs `/api/sessions`)
- [ ] Fullscreen request on first touch → Phase 10 (kiosk hardening; Fully Kiosk Browser already runs fullscreen)
- [x] Readiness and contextual prompt → delivered with engine v2 (ADR-050)
- **Done when:** the shell runs at 1080×1920 and reset guarantees are verified by E2E. ✅

## Phase 5 — Entry paths and recommendations UI

- [x] **Path A "Trabajo en…"** (ADR-048): persona grid (one primary persona, plain-language cards, concise
      descriptions, "Mi función abarca varias áreas"), ≤ 4 role-relevant challenges + "Algo más" (no free text),
      recommendations calculated immediately, "Estamos adaptando la experiencia a sus prioridades" transition,
      next steps (view recommendations · refine with challenges · explore relevant areas)
- [x] Anonymous session events written by the reducer (`SessionEvent`: seq, type, id only)
- [x] Recommendation (value) screen (ADR-051): "Identificamos oportunidades…" heading, role/priorities/explored
      summary, disclaimer (not a complete assessment or clinical advice), demo notice, 3 primary cards ("Por qué es
      relevante", related areas, approved or demo-status resources, next step, "Verlo en el hospital"), secondary
      items; primary CTA "Enviarme mi resumen personalizado"; "Seguir explorando" · "Revisar mis prioridades" ·
      "Empezar de nuevo"
- [x] Evidence-based, order-stable updates ("Nuevo" marks, "Actualizamos…" notice); explorer "Vista rápida" tray
- [x] Summary request screen (what the summary includes; form → Phase 7)
- [x] Refine screen with all challenges (max 3) → updated recommendations
- [x] Tests: engine reasons for operations/facilities, procurement/supply chain, clinical/respiratory care and
      executive leadership (unit), the same four journeys rendered end to end in jsdom (integration) and in
      Playwright at kiosk, laptop and phone sizes (E2E), plus several-areas, "Algo más", English and layout fit
- [ ] Optional facility type step (not in this prompt; engine already supports `facilityTypeId`)
- [x] Persistent "View my recommendations" (explorer, once ready) + contextual prompt (once per interval, ADR-050)
- [x] Path B "Necesito…": all challenges (≤ 3 or "Algo más") → optional role → tailoring → recommendations
- [ ] Path C optional "tailor" step (role + challenges before recommendations) — "Revisar mis prioridades" covers it for now
- [x] Tests: short role, challenge-based, explorer-only, continued exploration, updates after new evidence
      (component + E2E at three viewports); stability, evidence and copy-principle unit tests
- [~] E2E: quick path to recommendations in both languages (path A done; path B pending)
- **Done when:** AC-03, AC-04, AC-06, AC-07, AC-13, AC-15 pass.

## Phase 6 — Hospital Explorer (scene and hotspot engine) ✅

- [x] Original placeholder SVG art for the 8 environments + 2 foreground layers, generated from code on a
      shared 1200 × 1500 art box (`npm run art:placeholders`, `--sync-content` writes hotspot anchors) (ADR-049)
- [x] Every scene has ≥ 1 navigation, information and solution hotspot (content-check warning + seed test);
      7 hotspots added (content v0.4.0)
- [x] `SceneViewer`: fixed-ratio art box fitted to any viewport, background + foreground layers, hotspots by
      percentage, overlap avoidance and label placement for the measured size, compact markers on small screens
- [x] Hotspot kinds: navigation (zoom-in / zoom-out / pan illusion), information (bottom sheet), solution
      (solutions + "Añadir a mis intereses"); labels always for main and wayfinding hotspots, on touch/focus for the rest
- [x] Reduced motion (system setting or visitor option): instant scene swap, no pulse or settle motion
- [x] Signals and events: scene entries, opened and engaged (panel open ≥ 6 s) hotspots, explicit interests
- [x] Breadcrumbs, "Volver" (up one level; leaves the explorer from the campus), relevant areas highlighted
      after the role journey
- [x] "Ver mis recomendaciones" once the threshold is met (role, ≥ 1 challenge, ≥ 3 hotspots or ≥ 1 interest),
      with progress text before that
- [x] Developer calibration at `/dev/scenes` (tap → normalized x/y, copy), 404 in production unless
      `ENABLE_SCENE_CALIBRATION=true` (proxy + page)
- [x] Tests: layout/transition/threshold/gating units, viewer and explorer components, E2E responsive
      positioning and overlap for all 8 scenes at kiosk/laptop/phone, navigation, panels, threshold, reduced
      motion, calibration
- [ ] Throttled-CPU transition check on the actual Android kiosk (Phase 10)
- **Done when:** AC-05, AC-10, AC-11 pass; transitions are smooth in a throttled-CPU Playwright run.

## Phase 7 — Lead capture and persistence

**7a — Storage (ADR-052) ✅**

- [x] Prisma 7.10.0 + `@prisma/adapter-better-sqlite3`; `prisma.config.ts`; schema: Lead, LeadInterest,
      VisitorSessionSummary (+ normalized SessionSummaryItem), EmailDelivery; first migration with CHECK
      constraints behind the enums; client generated to `src/generated/prisma` (git-ignored) on install/build/typecheck
- [x] Health probe keeps `node:sqlite` but now requires every migration to be applied (ADR-038 amended)
- [x] Masked logger `src/server/logging/logger.ts` (names, emails, phones, organization, tokens)
- [x] Repository → service → HTTP layers; UI never touches Prisma (boundary test)
- [x] `POST /api/leads`: strict Zod schema, email normalization, content checks (consent version, role,
      interests), server recomputation, single transaction, idempotency by request token (replay 200, conflict
      409, double-tap race → one lead), 16 KB limit, JSON only
- [x] `GET /api/leads/status/:token` (opaque HMAC token, hash stored, 404 for unknown/malformed); no listing endpoint
- [x] Email failures only update `EmailDelivery` (retrying/failed with sanitized code); lead always kept
- [x] Safe seed (`db:seed`, synthetic `.test` data, refuses production, idempotent); `db:backup`, `db:export` (CSV
      with formula-injection guard); README backup/export guidance; `LEAD_RETENTION_DAYS` placeholder
- [x] Tests: service/repository on temp SQLite, real `prisma migrate deploy` + drift check, CHECK/FK/unique
      constraints, route handlers, logging/masking, error sanitizer, layer boundaries; E2E API spec
- [ ] Verify install and migration on the Windows event laptop (better-sqlite3 prebuild) — ADR-010

**7b — Form and consent experience (ADR-053) ✅**

- [x] Lead form after recommendations: summary explainer → contact details → preferences and permissions
      (role, language, interests prefilled from the session) → review with "Corregir mis datos" → sending → result
- [x] Touch typing: email/tel keyboards, capitalization hints, `enterKeyHint`, Enter to advance, autofill and
      spell-check off, five inputs per step
- [x] Inline validation (blur, live correction, step check with summary and focus) using the server's Zod schemas;
      server 422 mapped back to fields
- [x] Two separate consents from `content/consent.json` with visible version and "pending legal review" notice;
      report required, follow-up optional and unchecked by default
- [x] Double-tap guard and one request token per distinct payload; progress states; retry after failure keeps
      details and recommendation context
- [x] Result screen with masked email: sent / saved-and-queued / saved-but-delayed (no technical details);
      "Terminar" and auto reset after `confirmationResetMs`; explicit cancel with confirmation
- [x] Longer idle allowance on the form (120 s + 20 s); anonymous `lead-form-*` / `lead-submitted` events
- [x] Tests: 19 component (valid, invalid email, missing fields, separate consents, double tap, server error,
      email failure, reset, cancel, correct, keyboard), 12 unit (model, client, masking, reducer), 5 E2E at three
      viewports against the real server
- [ ] ConsentRecord rows (exact text shown + language) — with Phase 8 report storage
- [x] Lead scoring (server-only), added in the final audit (ADR-061); RecommendationSnapshot is covered by the stored
      recommendation interests and report
- [ ] Per-IP rate limit on `/api/leads`
- [ ] `POST /api/sessions` for anonymous summaries (table exists: VisitorSessionSummary)
- **Done when:** AC-21 … AC-24 and AC-16 pass.

## Phase 8 — Report and email delivery (ADR-054) ✅

- [x] `content/report.json` (versioned, governed, claim-scanned): title, subject, intro, consultation CTA, sales
      contact (dummy `example.com`), disclaimer, privacy footer, pending notice; production readiness checks
- [x] Report builder (server-recomputed top recommendations with reasons, priorities, explored areas, validated
      https resources only, demo pending marks) and renderer (responsive email-safe HTML + text, ES/EN, print
      styles, escaping, no remote assets)
- [x] `EmailProvider` interface; `DevelopmentPreviewProvider` (eml/html/txt + index, never sends), `SmtpProvider`
      (implicit TLS or required STARTTLS, TLS ≥ 1.2, verified certs, timeouts), `GraphProvider` stub rejected at startup
- [x] Migration 2: `Report`, `EmailDeliveryEvent`, `EmailDelivery.claimedAt`, provider `file` → `preview`, CHECKs
- [x] Workflow: lead + report + pending delivery + queued event in one transaction → attempt after the response →
      sent / retrying (backoff) / failed; bounded retries and batches; atomic claims; stale-claim recovery
- [x] Local admin CLI: `email:status`, `email:retry` (one attempt, `manual_retry` event), `email:preview`
- [x] Health shows the provider; `.env.example` and README with exact steps and dummy values
- [x] Tests: rendering ES/EN, escaping, privacy boundaries, provider selection and env rules, SMTP delivery and
      STARTTLS refusal against a local fake server, preview files, failure queueing, retry/backoff/give-up,
      manual retry, concurrent claims, batches, missing report, migration upgrade; E2E through the preview provider
- [x] Optional printable report: print styles in the email HTML (open the preview `.html` and print)
- [ ] Optional QR code to a short-lived local report view — not built (needs a public tokenized route; not required)
- [ ] Manual check: report in Outlook, Gmail and Apple Mail with the event SMTP account (needs Q2)
- [ ] ConsentRecord rows (exact text + language per consent)
- **Done when:** AC-25, AC-26, AC-36 pass (offline → online simulated in tests).

## Phase 8b — Convention session management (ADR-055) ✅

- [x] Session states: attracting, active, recommendation-ready, entering-contact, submitting, complete,
      resetting (pure `sessionPhase`; non-personal `leadFlow`, `resetting` and `deferredReset` in the
      store; `data-session-phase` on the kiosk root)
- [x] Inactivity: env-configurable intervals (`KIOSK_*_SECONDS`), warning overlay, "Continuar mi sesión",
      automatic reset; paused while submitting and on the completion screen; longer allowance on the form
- [x] Resets requested during a submission are deferred until it settles; header reset disabled while sending
- [x] Reset: store cleared at once → Spanish and accessibility defaults → hard reload; fresh session id; no
      previous recommendations or contact data; `no-store` kiosk page + bfcache reload for Back/Forward
- [x] Completion screen: delivery status, masked email, optional consultation step (report CTA + sales
      contact), visible countdown, "Finalizar ahora", automatic return to attract
- [x] Throughput: dominant "Ver recomendaciones preliminares" card; one dominant action per journey screen;
      short routes (6 and 5 taps); explorer optional and "Ver mis recomendaciones" persistent after readiness
- [x] Fix: lead request token uses `createSessionId` (no `crypto.randomUUID` on the kiosk's plain-HTTP origin)
- [x] Tests: fake-timer integration (states, warning, continuation, reset, form allowance, completion
      countdown and finish, submission in progress, deferred reset, failed submission), throughput audit,
      `sessionPhase`/reducer unit tests, E2E with short server timings and Back/Forward after reset

## Phase 9 — Admin and data operations

- [~] CLI: `db:export` ✅, `db:backup` ✅ (Phase 7a), `email:status` / `email:retry` ✅ (Phase 8); `leads:purge` (needs Q7)
- [x] Local administration utility (ADR-056): off by default, configurable `ADMIN_PATH`, internal segment
      hidden by the proxy, scrypt passphrase hash (`admin:passphrase`), in-memory session cookie, sign-in
      throttle, same-origin checks, `noindex` / `no-store`; separate layout from the kiosk (`(kiosk)` group)
- [x] Counts, filters (date, lead status, delivery, exported), lead detail with interests and delivery
      history, retry failed email, mark exported (migration 3), confirmed CSV exports (leads / interests /
      content validation), database backup download, pending-validation list; no delete
- [x] Shared CSV writer hardened (leading spaces, full-width formula characters); audit log lines without data
- [x] Tests: passphrase, sessions, throttle, proxy gating, filters, CSV escaping, authorization (disabled,
      unauthenticated, forged cookie, cross-site), confirmation, retry, mark exported, exports, backup; E2E on
      an admin-enabled server
- [ ] Persistent audit log table (log lines only for now)
- **Done when:** AC-29, AC-34 pass.

## Phase 9b — Privacy, security and reliability hardening (ADR-057) ✅

- [x] Shared request guards: host allowlist in the proxy (DNS rebinding), same-origin required for lead and
      admin POSTs, in-memory rate limits (`LEAD_RATE_LIMIT_PER_MINUTE`, global cap)
- [x] Safe errors everywhere (admin handlers wrapped; generic bodies; logs keep error name/code)
- [x] Security headers: production CSP (self only), COOP/CORP, extended Permissions-Policy, sandboxed assets
- [x] Static-asset safety: media-type allowlist for content paths; SVG scan in `content:check`
- [x] `npm run security:bundle` (client bundle scan) and `npm run security:audit` (0 vulnerabilities after
      `overrides` for the Prisma CLI's `mysql2` and `deepmerge-ts`)
- [x] `.gitignore` covers databases, WAL files, backups, email previews, lead CSVs and `.env*` (tested)
- [x] Tests: guards, limits, host check, headers, SVG scan, no patient fields, no client secrets, no
      analytics, git-ignore coverage, database unavailable, admin errors; E2E: headers, no CSP violations,
      same-origin traffic only, empty browser storage, network drop and reconnect, refresh, safe error bodies
- [x] PRIVACY_REVIEW.md with owner labels for every open approval

## Phase 10a — Accessibility and performance pass (ADR-058) ✅

- [x] axe-core (WCAG 2.2 A/AA) on every visitor screen and dialog (Spanish and English), on the admin
      pages, and at kiosk, laptop and phone sizes; one `h1` per screen; touch targets ≥ 48 px
- [x] Keyboard: visible focus (≥ 2 px outline), heading focused on screen change, dialog focus trap and
      return, Escape closes; scrollable regions focusable and labeled
- [x] Forms: labels, `aria-invalid`, errors linked by `aria-describedby`, icon plus text (never color alone);
      `lang` follows the language toggle
- [x] Zoom allowed (WCAG 1.4.4); pinch blocked on the scene only; no double-tap zoom
- [x] Selection, drag and long-press menu blocked on kiosk controls only; form fields and review entries
      selectable; admin behaves like a normal page
- [x] Rotation mid-journey (with a sheet open) keeps the state; the scene re-fits (E2E)
- [x] zod removed from the first load (zod-free constants and helpers, brand schema on the server, lazy
      lead form prefetched while idle, with retry on failure)
- [x] Scene images: intrinsic size, async decoding, priority for the current background, idle prefetch of
      neighboring scenes
- [x] Budgets: first-load JS from the build manifest (E2E); no third-party requests; asset size budget in
      `content:check`; report render time and size (unit)
- [x] Report rendered outside the transaction; idle timer without re-renders; SQLite WAL evaluated and
      rejected (ADR-058)
- [x] MANUAL_KIOSK_TEST.md: physical-device checklist
- Measured on the production build: first-load JS for the kiosk route went from ~277 KB to ~173 KB
  gzipped (~578 KB raw; framework 130 KB and app 43 KB; zod now only in the lazy lead-form chunk); interactive in about 0.5 s on the local E2E server.

## Phase 10b — Local-network launch (ADR-059) ✅

- [x] `scripts/windows/start-kiosk-server.ps1`:
  - checks runtime, dependencies, `.env`, database, build freshness and port;
  - starts on `0.0.0.0` with the configured port and waits for health;
  - lists candidate IPv4 addresses and the kiosk URL format;
  - explains failures; never touches the firewall
- [x] `scripts/windows/start-dev-network.ps1` (development on the network); `-CheckOnly` on both; `PORT` in
      `.env.example`
- [x] README "Deployment on the event laptop (Windows)": install, `.env`, SQLite, build, start, network,
      IPv4, Chrome, health, troubleshooting, firewall as a [Linde IT] step, backup, safe shutdown
- [x] CONVENTION_STARTUP_CHECKLIST.md; PRIVACY_REVIEW A16–A19 (hotspot, firewall, execution policy, power)
- [x] Tests:
  - static (ASCII, no 7-only syntax, no settings changes);
  - runtime with PowerShell 7 when available (check-only output, invalid port, port in use);
  - PSScriptAnalyzer with 5.1 compatibility rules (0 findings)
- [x] Backup completes under concurrent writes (single-step online backup)
- [ ] On the event laptop: Windows PowerShell 5.1 run, Mobile Hotspot, firewall behavior, physical kiosk
      connection (not verifiable in the development container)

## Phase 10c — Sales-validation workflow and production-content guard (ADR-060) ✅

- [x] `salesReview` worksheet on personas, challenges, solutions and digital assets:
  - PR availability yes/no/unknown, keep/remove/rename, correction, missing material, owner, approval
    status, priority;
  - schema rules tie approval to validation
- [x] Admin page "Validación de ventas": all 16 fields per item, summary, filters, confirmed CSV download;
      `exports/sales-validation.csv` from `content:export`
- [x] SALES_VALIDATION_GUIDE.md: the ten reviewer questions mapped to worksheet columns, and the approval
      flow
- [x] Production guard:
  - validated **and** approved required (filter layer + content check);
  - consent and report copy withheld until validated, so no lead capture;
  - empty paths hidden; neutral "being prepared" state
- [x] Tests:
  - exhaustive visibility combinations, internal-field stripping, loader refusal, lead refusal;
  - component tests;
  - production-mode E2E server
- [ ] Import of returned worksheets (answers are applied to `content/` by hand today)
- [ ] Sales review itself: owners, answers and approvals (**[Linde Marketing]** with PR sales, PRIVACY_REVIEW
      A13)

## Phase 10d — Focused automated testing ✅

- [x] TESTING.md: how to run each layer, and a map from every required unit, integration and E2E item to
      its tests, plus what cannot run here
- [x] New unit tests: duplicate interactions, CSV escaping, consent-version refusal
- [x] New integration tests (real SQLite):
  - the lead is committed before the provider is called;
  - a failing provider leaves the lead;
  - a database-level rejection is handled safely
- [x] `tests/e2e/critical-journeys.spec.ts`: the ten critical journeys in three browser profiles. A fourth
      E2E server (real SMTP to a closed port, own database, admin) covers email failure and admin retry.
- [x] Fixed: the admin lead-detail interests table widened the page at phone width (now a scroll region)
- [ ] Not automatable here: successful real SMTP delivery, physical kiosk, Windows PowerShell 5.1
      (TESTING.md §5)

## Phase 11 — Final product audit ✅

- [x] All software checks run (see RELEASE_READINESS.md); manual inspection harness at kiosk, tablet and laptop
      sizes, ES/EN, reduced motion, failed email, missing database, production and demo modes
- [x] Fixed (high): long email addresses overflowed the review step on kiosk and tablet widths (now wrap; E2E
      test)
- [x] Fixed (MVP acceptance): internal lead scoring (M12, AC-34) implemented, server-only (ADR-061)
- [x] Fixed (docs): README status was out of date
- [x] RELEASE_READINESS.md with go/no-go checklist

## Phase 10 — Hardening, accessibility, deployment

- [ ] E2E: full quick/discovery/explore journeys; post-reset storage/DOM/history assertions; no external requests
- [x] Accessibility pass: target sizes, contrast test, focus order, screen-reader labels, reduced motion
      (Phase 10a)
- [x] Performance pass: bundle budget, asset sizes (Phase 10a)
- [ ] Throttled or physical-device run: MANUAL_KIOSK_TEST.md, on the event hardware
- [ ] Remaining deployment documentation beyond README → Deployment (Phase 10b): Windows setup (Node LTS, install, `.env`, migration, firewall, hotspot, startup script, power settings, BitLocker), Android kiosk setup (Chrome, screen pinning, autofill off, portrait lock), event-day checklist, recovery procedures
- [x] `npm run start:network` (`next start -H 0.0.0.0`), done in Phase 1
- [ ] Rehearsal script: 20 consecutive visitor sessions with resets; offline email test
- **Done when:** all acceptance criteria are verified (automated or documented manual check).

---

## Backlog (post-MVP)

PDF report · Microsoft Graph email provider · CRM integration · sales notification email · QR hand-off
to phone · badge scanning · multi-kiosk sync · content editor UI · analytics dashboard · approved
illustration integration · additional languages.

## Blockers and external dependencies

| Item                               | Needed for               | Status                                  |
| ---------------------------------- | ------------------------ | --------------------------------------- |
| SMTP account + sender address (Q2) | Real email delivery      | Open — `file` provider used meanwhile   |
| Validated PR solution catalog (Q5) | Production mode          | Open — demo mode with `assumed` content |
| Approved consent text (Q3)         | Production mode          | Open — placeholder text                 |
| Sales contact details (Q4)         | Report CTA in production | Open                                    |
| Scene illustrations (Q6)           | Final visual quality     | Open — local placeholder SVGs           |
