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
- **Moved to later phases:** `settings.json`, `report.json`, `sales-contacts.json` (Phases 3–8); brand config and ES/EN dictionaries with `t()` were delivered in Phase 1; cached server loader that refuses to boot on invalid content (Phase 4, first page that reads content); placeholder SVG files (Phase 6)

## Phase 3 — Recommendation engine and lead scoring (pure logic)

- [ ] `content/settings.json` (topN, per-type caps, hotspot-signal discount, explicit-interest weight, engagement threshold) + schema

- [ ] `SessionSignals` types + normalization (dedupe, caps, max challenges)
- [ ] `recommend()` with weights, per-type caps, min score, tie-breakers, top-N, fallback
- [ ] Render `explanationTemplate` placeholders from matched labels (lower-casing, ES "y" / EN "and" joins) with `fallbackExplanation` when a placeholder has no match
- [ ] Output validated against `RecommendationResultSchema`
- [ ] `hasMinimumInfo` / prompt selectors
- [ ] `lead-scoring.ts` (server-only) + config
- [ ] Unit tests: determinism, ordering, caps, reasons, fallback, mode filtering, scoring bounds/tiers
- **Done when:** the engine suite passes with high branch coverage and no I/O in `src/domain`.

## Phase 4 — Kiosk shell

- [ ] State machine (reducer, actions, context, selectors) with reducer unit tests
- [ ] Root layout: viewport, `lang`, brand CSS variables, fonts
- [ ] Attract screen (motion loop, ES/EN toggle, fullscreen request on first touch)
- [ ] Entry screen with three paths
- [ ] Idle timer + "Are you still there?" overlay + reset controller (sendBeacon + hard reload)
- [ ] Shared components: large buttons, selectable chips/cards, pending-validation indicator, "Start over"
- [ ] E2E: attract → entry; idle reset returns to attract; language resets to ES
- **Done when:** the shell runs at 1080×1920 and reset guarantees are verified by E2E.

## Phase 5 — Entry paths and recommendations UI

- [ ] Role selection · challenge multi-select (max 3) · optional facility type
- [ ] Preliminary recommendations screen: cards with reasons, environments, next step, resources
- [ ] Persistent "View my recommendations" action + contextual prompt (once per session)
- [ ] Path B ordering (challenges → role) and path C "tailor" step
- [ ] Value screen ("We found opportunities…" + what the report includes)
- [ ] E2E: quick path to recommendations in both languages
- **Done when:** AC-03, AC-04, AC-06, AC-07, AC-13, AC-15 pass.

## Phase 6 — Hospital Explorer

- [ ] Original placeholder SVG isometric art for 8 environments (`assetStatus: placeholder`)
- [ ] Scene renderer (layered art box, normalized hotspot layer)
- [ ] Hotspot kinds: navigate (zoom transition), inform (bottom-sheet panel), recommend (solutions + "Add to my interests")
- [ ] Parallax/ambient motion; reduced-motion fallbacks
- [ ] Signals: visited scenes, opened/engaged hotspots, explicit interests → live recommendation refinement
- [ ] Campus hub navigation + back-to-campus control; recommendations reachable from every scene
- [ ] E2E: discovery path changes recommendations; explore-only path reaches minimum info
- **Done when:** AC-05, AC-10, AC-11 pass; transitions are smooth in a throttled-CPU Playwright run.

## Phase 7 — Lead capture and persistence

- [ ] Prisma 7.10 + SQLite driver adapter; `prisma.config.ts`; schema for all models (ARCHITECTURE §9.3); first migration; verify install on Windows (ADR-010)
- [ ] Replace the `node:sqlite` health probe with a Prisma `SELECT 1` (ADR-038)
- [ ] `src/server/log.ts` PII-safe logger

- [ ] Lead form (fields per PROJECT_BRIEF §10), localized validation, autofill suppression
- [ ] Configurable, versioned consent checkboxes (separate, unchecked by default)
- [ ] `POST /api/leads`: strict Zod schema, server recomputation, lead scoring, single transaction, idempotency key, rate limit
- [ ] Confirmation screen (no claim of delivery) + auto reset
- [ ] `POST /api/sessions` for anonymous summaries
- [ ] Integration tests: transaction contents, response excludes score, idempotency, validation errors
- **Done when:** AC-21 … AC-24 and AC-16 pass.

## Phase 8 — Report and email delivery

- [ ] Report renderer (HTML + text, ES/EN, all nine sections, demo indicator, disclaimer, sales contact)
- [ ] `EmailProvider` interface; `file` and `smtp` providers; Graph stub
- [ ] Outbox worker (claim, backoff, stuck-row recovery, max attempts) started from `instrumentation.ts`
- [ ] Integration tests: provider failure keeps lead and schedules retry; success marks sent; production mode report excludes non-validated content
- [ ] Manual check: report renders acceptably in common email clients (documented)
- **Done when:** AC-25, AC-26, AC-36 pass (offline → online simulated in tests).

## Phase 9 — Admin and data operations

- [ ] CLI: `leads:export` (CSV, UTF-8 BOM), `outbox:retry`, `leads:purge`
- [ ] Optional `/admin` (disabled by default, Basic auth, `noindex`): outbox status, retry, export, content readiness
- [ ] `proxy.ts` guard + handler-level checks; audit log entries
- [ ] Tests: admin disabled → 404; wrong credentials → 401; CSV columns and encoding
- **Done when:** AC-29, AC-34 pass.

## Phase 10 — Hardening, accessibility, deployment

- [ ] E2E: full quick/discovery/explore journeys; post-reset storage/DOM/history assertions; no external requests
- [ ] Accessibility pass: target sizes, contrast test, focus order, screen-reader labels, reduced motion
- [ ] Performance pass: bundle budget, asset sizes, throttled-device run
- [ ] `DEPLOYMENT.md`: Windows setup (Node LTS, install, `.env`, migration, firewall, hotspot, startup script, power settings, BitLocker), Android kiosk setup (Chrome, screen pinning, autofill off, portrait lock), event-day checklist, recovery procedures
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
