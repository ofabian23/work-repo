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
- [x] DECISIONS.md — ADR-001 … ADR-026
- [x] TASKS.md — this plan
- [x] CONTENT_VALIDATION.md — statuses, visibility matrix, workflow, registers

## Phase 1 — Project foundation
- [ ] Scaffold Next.js 16 (App Router, TS strict, Tailwind 4, ESLint) in `linde-sphere/`
- [ ] Prettier + `prettier-plugin-tailwindcss`; `format`/`format:check` scripts
- [ ] Vitest (node + jsdom projects) + Testing Library; a smoke test
- [ ] Playwright config (1080×1920, `hasTouch`, Chromium executable fallback); a smoke test
- [ ] Prisma 7.10 + SQLite adapter; `prisma.config.ts`; initial schema (all models in ARCHITECTURE §9.3); first migration
- [ ] `src/server/env.ts` (Zod env schema) + `.env.example`; `.gitignore` for `.env`, `data/`
- [ ] `src/server/log.ts` PII-safe logger; `/api/health`
- [ ] Self-hosted font; base `globals.css` with kiosk hardening CSS
- [ ] `README.md` quick start; `check` script aggregating fast checks
- **Done when:** clean install, lint, typecheck, unit + e2e smoke tests, migration, and build all pass.

## Phase 2 — Content model and seed content
- [ ] Zod schemas for all entities (ARCHITECTURE §6) + inferred types
- [ ] `visibleContent(bundle, mode)` + reference pruning, with unit tests for the full visibility matrix
- [ ] Seed content: brand, settings, 10 personas, 12 challenges, facility types, 8 scenes with hotspots, solution categories (all `assumed`), consent (`placeholder`), report copy, sales contact (`unavailable`)
- [ ] `messages/es.json` + `messages/en.json`, typed `t()`, key-parity test
- [ ] `scripts/content-check.ts`: schema, cross-references, translations, duplicate IDs, prohibited-claim scan, production-readiness summary
- [ ] Server content loader with per-process cache; boot fails on invalid content
- **Done when:** `content:check` passes in demo mode and reports production readiness counts.

## Phase 3 — Recommendation engine and lead scoring (pure logic)
- [ ] `SessionSignals` types + normalization (dedupe, caps, max challenges)
- [ ] `recommend()` with weights, per-type caps, min score, tie-breakers, top-N, fallback
- [ ] Reason codes + localized explanation templates
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
- [ ] `npm run start:kiosk` (`next start -H 0.0.0.0 -p 3000`)
- [ ] Rehearsal script: 20 consecutive visitor sessions with resets; offline email test
- **Done when:** all acceptance criteria are verified (automated or documented manual check).

---

## Backlog (post-MVP)
PDF report · Microsoft Graph email provider · CRM integration · sales notification email · QR hand-off
to phone · badge scanning · multi-kiosk sync · content editor UI · analytics dashboard · approved
illustration integration · additional languages.

## Blockers and external dependencies
| Item | Needed for | Status |
|---|---|---|
| SMTP account + sender address (Q2) | Real email delivery | Open — `file` provider used meanwhile |
| Validated PR solution catalog (Q5) | Production mode | Open — demo mode with `assumed` content |
| Approved consent text (Q3) | Production mode | Open — placeholder text |
| Sales contact details (Q4) | Report CTA in production | Open |
| Scene illustrations (Q6) | Final visual quality | Open — local placeholder SVGs |
