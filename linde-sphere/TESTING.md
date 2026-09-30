# Testing

This document explains how Linde Sphere is tested and where each required behavior is covered. Every row
below points to tests that run in CI-like conditions with `npm run check` (unit, integration, component)
or `npx playwright test` (end to end). The last section lists what these suites cannot verify.

## 1. How to run

| Layer                       | Command                                    | What it runs                                                                      |
| --------------------------- | ------------------------------------------ | --------------------------------------------------------------------------------- |
| Everything fast             | `npm run check`                            | content check, export freshness, lint, typecheck, format, and all Vitest projects |
| Unit and integration (Node) | `npx vitest run --project unit`            | `tests/unit/**`: pure logic, plus real SQLite databases in temporary folders      |
| Component (jsdom)           | `npx vitest run --project components`      | `tests/components/**`: the kiosk rendered with React Testing Library              |
| End to end                  | `npx playwright test`                      | `tests/e2e/**` against production builds, in three browser profiles               |
| Critical journeys only      | `npx playwright test critical-journeys`    | The ten journeys in §4                                                            |
| Stability check             | `CI=1 npx playwright test --repeat-each=2` | Every E2E test twice on a fresh build (how each phase is verified)                |

**Integration tests.** They live in `tests/unit/db/**` and use a **real SQLite database**: every test
creates one with the real migrations (`tests/helpers/test-database.ts`). Only the email provider is faked.

**End-to-end setup.** Playwright builds the app once and starts four servers on the same production build
(`playwright.config.ts`):

| Port | Purpose                                                                                                  |
| ---- | -------------------------------------------------------------------------------------------------------- |
| 3100 | Main kiosk: demo content, development preview email provider (writes files, never sends)                 |
| 3101 | Short kiosk timings (warning after 10 s, 5 s countdown), dev tools, and the local admin utility          |
| 3102 | `CONTENT_MODE=production`: only validated, sales-approved content                                        |
| 3103 | Real SMTP provider pointed at a closed local port (every attempt fails), admin enabled, its own database |

It runs three browser profiles: kiosk portrait (1080 × 1920, touch), laptop (1440 × 900) and phone
(390 × 844, touch).

**Test conventions.**

- **Selectors:** `data-testid` attributes and accessible roles and names only, never CSS structure.
- **No sleeps:** waits are web-first assertions (`toBeVisible`, `toHaveAttribute`, `expect.poll`) with
  explicit timeouts. The only long timeouts are the inactivity journeys, which wait for the configured
  10 s + 5 s.
- **Test data:** synthetic only, with `@example.test` addresses and "(ficticio)" organizations. Each test
  uses unique values, so parallel workers never share a lead.

## 2. Unit tests

| Required area            | Where                                                                                                                                                                                                                                                                                                |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Schemas                  | `content/primitives-and-taxonomy`, `content/offering`, `content/scene`, `content/recommendation-rule`, `content/sales-review` (approval ⇔ validation rules per type), `runtime/lead-report-email` and `runtime/session-and-results` (lead, consent, delivery, session and result schemas), `app/env` |
| Recommendation scoring   | `recommendations/scoring` (weights, thresholds, tie-breaks, demo vs production), `recommendations/engine`, `recommendations/explanations`                                                                                                                                                            |
| Exclusions               | `recommendations/engine` "applies exclusion rules…", `recommendations/scoring` "applies before ranking, so the excluded solution frees its place", `content/recommendation-rule` (exclusion schema)                                                                                                  |
| Content validation       | `content/seed-and-bundle` (references, reachability, translations, prohibited claims), `content/visibility`, `content/production-guard`, `review/content-review`, `review/sales-validation`                                                                                                          |
| Ranking stability        | `recommendations/stability` (no reordering without meaningful new evidence), `recommendations/engine` "ranking does not depend on the order signals were collected"                                                                                                                                  |
| Readiness thresholds     | `recommendations/readiness` (role + challenge, two challenges, two scenes, unique hotspots, navigation does not count)                                                                                                                                                                               |
| Duplicate interactions   | `recommendations/duplicate-interactions` (repeated hotspot, scene, challenge and interest actions give the same signals, readiness, scores and ranking as doing each once), `kiosk/session-events` "does not repeat an event…"                                                                       |
| Consent handling         | `runtime/lead-report-email` (report consent required, two separate consents, one record per type, shared version), `db/lead-service` (consent version mismatch), `content/production-guard` (no lead capture without validated consent text)                                                         |
| Email template rendering | `report/report` (every section in email-safe HTML and plain text, Spanish and English, escaping, no pending content in production), `email/providers`, `perf/performance-budget` (render time and size)                                                                                              |
| CSV escaping             | `lib/csv` (formula injection incl. full-width and leading-space forms, quoting, BOM and CRLF), `db/admin` (exports), `review/sales-validation`                                                                                                                                                       |
| Lead scoring (internal)  | `db/lead-scoring` (rules, caps, tiers, storage, never in the API response or report, database CHECKs), `db/admin` (CSV `internal_score`)                                                                                                                                                             |
| Session reset            | `kiosk/kiosk-state` "never leaks the previous visitor's state…", "counts resets…", `kiosk/session-events` "a reset discards every event", `kiosk/session-phase`, and component tests `session-management` and `throughput`                                                                           |

Paths are relative to `tests/unit/`, except the component tests in `tests/components/`.

## 3. Integration tests (real SQLite)

| Required behavior                         | Where (`tests/unit/db/`)                                                                                                                                                                                                                                                                           |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lead stored before the email attempt      | `email-outbox` "when the provider is called, the lead, its report and the pending delivery are already stored" (production wiring: `schedule` after commit), "wakes the outbox after the lead commits…"                                                                                            |
| Email failure does not delete the lead    | `email-outbox` "a failing provider leaves the stored lead untouched", "queues a failed attempt for retry… keeps the lead", "is recorded as failed with REPORT_UNAVAILABLE (lead kept…)"; `lead-service` "keeps the lead… when waking the outbox throws"                                            |
| Retry updates the delivery status         | `email-outbox` "allows a manual retry of a failed delivery (one attempt, recorded)", "retries only when due…"; `admin` "retries only failed or retrying deliveries…"; E2E journey 5                                                                                                                |
| Unvalidated content hidden in production  | `../content/production-guard` (every status × approval × decision per type, served bundle, loader, lead refusal); E2E `production-content` and journey 10                                                                                                                                          |
| Demo content visible only in demo mode    | `../content/visibility`, `../content/production-guard` "shows assumed content in demo mode…", `../recommendations/scoring` "demo versus production content filtering"; component `production-content`                                                                                              |
| Database validation errors handled safely | `lead-routes` "the database itself rejects the data" (a SQLite constraint aborts the insert: generic 500, nothing stored, no personal data or database message in logs), "answers 500 without details when storage fails"; `lead-service` "rolls back the whole submission…"; `schema-constraints` |
| Idempotent lead submissions               | `lead-service` "returns the original result for a repeated request token…", "stores exactly one lead when two identical requests race", "rejects a reused request token with a different payload"; `lead-routes` "201… then 200 for a double tap", "409…"                                          |

## 4. End-to-end critical journeys

All ten are in `tests/e2e/critical-journeys.spec.ts` and run in every browser profile.

| #   | Journey                                                                 | Server | Key assertions                                                                                                                      |
| --- | ----------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Persona → challenge → recommendation → lead → email success → reset     | 3100   | delivery `sent`, masked email, the report file written by the provider, reset to attract, no contact text left                      |
| 2   | Challenge → recommendation → continue exploring → updated result → lead | 3100   | "Actualizamos sus recomendaciones…", different ranking after new evidence, lead sent                                                |
| 3   | Explorer only → readiness prompt → recommendation → lead                | 3100   | progress prompt and no button after one point; button after the second scene; explored areas in the summary; lead sent              |
| 4   | Invalid form → correction → successful submission                       | 3100   | `aria-invalid` on email and name, consent required, corrected values on review, lead sent                                           |
| 5   | Email failure → stored lead → completion message → admin retry          | 3103   | "delayed" completion message without technical text; admin shows "Reintentando", 1 attempt, `CONNECTION_FAILED`; retry → 2 attempts |
| 6   | Inactivity warning → continue                                           | 3101   | warning appears, "Continuar mi sesión" keeps the screen, the same recommendations and phase                                         |
| 7   | Inactivity warning → automatic reset                                    | 3101   | attract screen, phase `attracting`, previous role not selected                                                                      |
| 8   | Language change during a session                                        | 3100   | `lang` switches, same recommendations in English, form labels switch both ways                                                      |
| 9   | New visitor sees no previous visitor data                               | 3100   | back/forward shows nothing, role unselected, empty form, empty browser storage                                                      |
| 10  | Production mode hides non-validated content                             | 3102   | no paths, "being prepared" message, no demo or pending labels, neutral privacy notice                                               |

The same behaviors are covered in more depth by feature specs:

- `lead-form`, `session` and `resilience`: network drop, refresh, bfcache, CSP, storage.
- `value-screen` and `explorer`: scene layout, recommendation stability.
- `admin`, `accessibility` (axe WCAG 2.2 AA), `kiosk-device` (zoom, rotation, budgets) and
  `production-content`.

## 5. What these suites cannot verify

These are **not** claimed as tested; they need the physical setup or organizational systems:

| Not verified automatically                                                              | Why                                                                                               | How it is checked                                                                                      |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| A **successful** real SMTP delivery, and a failed email later succeeding on retry       | Needs an approved relay and trusted TLS; the E2E SMTP server can only fail                        | CONVENTION_STARTUP_CHECKLIST.md item 9 (test email confirmed)                                          |
| Android kiosk hardware: real touch, pinch, TalkBack, kiosk browser lockdown, Wi-Fi drop | Needs the device                                                                                  | MANUAL_KIOSK_TEST.md                                                                                   |
| Windows PowerShell 5.1, Mobile Hotspot, firewall prompt, console Ctrl+C                 | Container is Linux; scripts are tested with PowerShell 7 when available                           | README → Deployment; `tests/unit/scripts/windows-launch.test.ts` (runtime part skipped without `pwsh`) |
| Production mode **with** approved content                                               | No content is approved yet; simulated in unit and component tests by approving copies of the seed | `content:check -- --mode production` once approvals exist                                              |
| Real inactivity durations (60 s + 15 s by default)                                      | E2E uses 10 s + 5 s through the same settings                                                     | Component tests run the same timer logic with fake timers                                              |

The PowerShell runtime tests run only when `pwsh` (or `PWSH_PATH`) is available. They are reported as
**skipped**, not passed, otherwise.
