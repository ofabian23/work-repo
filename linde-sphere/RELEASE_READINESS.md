# Release readiness — Linde Sphere MVP

This is the final audit of Linde Sphere (codename _Mockup Vision_), the Spanish-first portrait kiosk for
the healthcare convention in Puerto Rico. It records what is built, how to run it, what still needs
approval, and whether it can go live.

- **Audit date:** 2026-09-30
- **Branch:** `claude/project-vision-planning-hfwe5m`

**Bottom line:**

- **Software:** every automated check passes (§1).
- **Demo-mode rehearsals:** the MVP is ready for them.
- **Production at the event:** **not ready**. Content, legal text, IT settings and physical-kiosk tests
  still need approval (§9–§14 and the go/no-go checklist, §15).

## 1. Software checks (run for this audit)

| Check                                     | Command                                      | Result                                                                                                                  |
| ----------------------------------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Content validation (demo)                 | `npm run content:check`                      | ✅ 0 errors, 0 warnings                                                                                                 |
| Content validation (production readiness) | `npm run content:check -- --mode production` | ❌ 7 blockers, **expected**: nothing is validated or approved yet (§11)                                                 |
| Content export freshness                  | `npm run content:export -- --check`          | ✅ up to date                                                                                                           |
| Lint                                      | `npm run lint`                               | ✅ 0 warnings                                                                                                           |
| Typecheck                                 | `npm run typecheck`                          | ✅                                                                                                                      |
| Unit, integration and component tests     | `npm test` (inside `npm run check`)          | ✅ 878 passed, 3 skipped (PowerShell runtime tests; they need `pwsh`, and passed separately: 15/15 with PowerShell 7.4) |
| Formatting                                | `npm run format:check`                       | ✅                                                                                                                      |
| Production build                          | `npm run build`                              | ✅                                                                                                                      |
| Client bundle scan                        | `npm run security:bundle`                    | ✅ clean (12 markers: secrets, server-only code, lead scoring)                                                          |
| Dependency audit                          | `npm run security:audit` / `npm audit`       | ✅ 0 vulnerabilities                                                                                                    |
| End-to-end, every test twice, fresh build | `CI=1 npx playwright test --repeat-each=2`   | ⏳ running at the time of this commit; result recorded in the next commit                                               |

**Manual inspection.** A scripted browser pass (239 checks, all passing after the fixes below) covered:

- **Screens:** attract → lead completion at 1080 × 1920 portrait, 800 × 1280 tablet and 1440 × 900 laptop,
  in Spanish and English.
- **Conditions:** reduced motion, a failed email (real SMTP to a closed port), a missing database,
  production mode and demo mode.
- **Checks on every screen:** no horizontal overflow, touch targets ≥ 48 px, exactly one `h1`, and no
  console errors.
- **Screenshots:** reviewed by eye.

**Issues found and fixed in the audit:**

| Severity       | Issue                                                                                                                                                   | Fix                                                                                       |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| High           | A long work email did not wrap on the review step: kiosk and tablet screens overflowed and part of the address was hidden where the visitor verifies it | Values wrap anywhere; regression E2E test at all viewports                                |
| MVP acceptance | Internal lead scoring (brief M12, AC-34) was never built                                                                                                | Server-only score, tier and factors, admin and CSV only (ADR-061); database CHECKs; tests |
| Medium (docs)  | README status described an early phase                                                                                                                  | Updated                                                                                   |

**Found earlier in the final phases:**

- WAL mode made lead saves fail under concurrency. It was reverted (ADR-058).
- Backups never finished while the server was writing. They are now copied in one step.
- Admin pages overflowed phone screens once zoom was allowed.
- Production mode sent placeholder legal text to the kiosk. It is now withheld (ADR-060).

## 2. Completed functions

- **Visitor experience (Spanish first, English toggle):**
  - Attract screen; three entry paths ("Trabajo en…", "Necesito…", "Explorar el hospital").
  - An illustrated hospital explorer with hotspots and zoom/pan transitions.
  - Accessibility sheet: larger text and reduced motion.
- **Recommendations:**
  - Deterministic and explainable, with a "why this appeared" reason per item.
  - Readiness rules, stable ranking that changes only on meaningful new evidence, and a fallback.
  - Recomputed by the server on submission.
- **Lead capture:**
  - Shown only after recommendations.
  - Three steps: contact, preferences with two separate unchecked consents, and review.
  - Validated on the client and the server, protected against double taps (idempotent), and rate-limited.
- **Storage and email:**
  - One SQLite transaction stores the lead, interests, session summary, rendered report and a pending
    email delivery.
  - An outbox retries with backoff, recovers after a crash, and supports manual retry.
  - Email providers: development preview and SMTP with required TLS.
- **Report:** personalized HTML and text email in the visitor's language, with a pending-validation note in
  demo mode.
- **Session isolation:**
  - Inactivity warning, then reset; the completion countdown also resets.
  - Nothing is kept in browser storage; back/forward cannot reveal the previous visitor.
- **Local admin (optional, off by default):**
  - A configurable hidden path and a scrypt-hashed passphrase.
  - Lead list and detail; retry; mark exported.
  - Confirmed, formula-safe CSV exports (leads with internal score, interests, content validation, sales
    validation) and a consistent database backup.
- **Sales validation:** admin page "Validación de ventas", `exports/sales-validation.csv` and
  SALES_VALIDATION_GUIDE.md.
- **Production-content guard:**
  - Production shows only content that is validated **and** sales-approved.
  - Consent and report text are withheld until validated, so no leads are captured.
  - Empty paths are hidden.
- **Security and privacy:** host allowlist, same-origin checks, CSP and headers, no third-party requests,
  masked logs, internal lead score kept off the kiosk.
- **Deployment:** Windows PowerShell launch scripts for production and development on the local network,
  a README deployment guide and CONVENTION_STARTUP_CHECKLIST.md.
- **Quality:**
  - WCAG 2.2 AA automated checks, performance budgets, and ten critical journeys end to end.
  - TESTING.md maps every requirement to its tests.

## 3. Exact run instructions

From the `linde-sphere/` folder, on the event laptop (Windows PowerShell shown):

```powershell
npm install                      # Node.js 22 LTS (≥ 20.9) and npm required
Copy-Item .env.example .env      # then edit .env (§5)
npm run db:deploy                # create or upgrade data\linde-sphere.db
npm run build                    # production build
powershell -NoProfile -File scripts\windows\start-kiosk-server.ps1
```

The script:

- checks Node.js, npm, the dependencies, `.env`, the database, the build and the port;
- starts the production server on `0.0.0.0:<PORT>` (default 3000) and waits for `/api/health`;
- prints the kiosk URLs.

Other ways to run it:

- **Stop:** Ctrl+C in that window.
- **Check without starting:** add `-CheckOnly`.
- **Without the script:** `npm run start:network` (network) or `npm run start` (this computer only).
- **Development on this computer:** `npm run dev`.
- **Development on the network:** `scripts\windows\start-dev-network.ps1`.

## 4. Exact local-network instructions

1. Connect the laptop and the kiosk to the **same approved network**: the Windows Mobile Hotspot or the
   venue network (**[Linde IT]**, §9).
2. Start the server (§3). The script lists the laptop's IPv4 addresses; with the Mobile Hotspot it is
   usually `192.168.137.1`. By hand: `ipconfig`, then the adapter on the shared network.
3. On the kiosk, open Chrome at `http://<laptop-IPv4>:3000/`, for example `http://192.168.137.1:3000/`.
   Use `http://`, include the port, and never use `0.0.0.0`.
4. Check `http://<laptop-IPv4>:3000/api/health`: it should show `"status":"ok"`.
5. If it works on the laptop but not on the kiosk:
   - **Firewall:** inbound TCP 3000 for Node.js is usually blocked. Changing that is a **[Linde IT]**
     decision; the scripts never change firewall rules.
   - **Other causes:** a different network, guest-network isolation, a stale IP, a VPN, or the laptop
     asleep. See README → Deployment, step 10.

## 5. Environment variables

`.env` is git-ignored. `.env.example` documents every variable with dummy values only. The server
validates them at start-up, and `/api/health` lists invalid ones by name.

| Variable                                                                                                      | Purpose                                                                                              | Default / event value                                            |
| ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `CONTENT_MODE`                                                                                                | `demo` shows assumed content with indicators; `production` shows only validated and approved content | `demo` until sign-off; `production` at the event after approvals |
| `CONTENT_PREVIEW_PLACEHOLDERS`                                                                                | Development-only preview of placeholder content                                                      | `false` (ignored in production builds)                           |
| `DATABASE_URL`                                                                                                | SQLite file                                                                                          | `file:./data/linde-sphere.db`                                    |
| `PORT`                                                                                                        | Port for the launch scripts                                                                          | `3000`                                                           |
| `LEAD_RETENTION_DAYS`                                                                                         | Retention placeholder; nothing is deleted automatically                                              | empty, until privacy/legal decide                                |
| `EMAIL_PROVIDER`                                                                                              | `preview` (writes files, never sends) or `smtp`                                                      | `smtp` at the event (**[Linde IT]** relay)                       |
| `EMAIL_FROM`, `EMAIL_REPLY_TO`                                                                                | Sender and reply-to                                                                                  | approved addresses                                               |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_REQUIRE_TLS`, `SMTP_USER`, `SMTP_PASS`                         | SMTP relay; TLS required in production                                                               | from **[Linde IT]**                                              |
| `EMAIL_MAX_ATTEMPTS`, `EMAIL_WORKER_INTERVAL_MS`, `EMAIL_PREVIEW_DIR`                                         | Retry ceiling, worker interval, preview folder                                                       | `12`, `15000`, `data/email-preview`                              |
| `KIOSK_IDLE_WARNING_SECONDS`, `KIOSK_IDLE_COUNTDOWN_SECONDS`, `KIOSK_FORM_IDLE_*`, `KIOSK_COMPLETION_SECONDS` | Inactivity and completion timings                                                                    | 60 + 15 s; form 120 + 20 s; completion 15 s                      |
| `ALLOWED_HOSTS`                                                                                               | Extra hostnames (private IPs and `.local` names always allowed)                                      | empty                                                            |
| `LEAD_RATE_LIMIT_PER_MINUTE`                                                                                  | Lead submissions per client per minute                                                               | `10`                                                             |
| `ADMIN_ENABLED`, `ADMIN_PATH`, `ADMIN_PASSPHRASE_HASH`, `ADMIN_SESSION_MINUTES`                               | Local admin (hash from `npm run admin:passphrase`)                                                   | `false` unless needed                                            |
| `ENABLE_COMPONENT_GALLERY`, `ENABLE_SCENE_CALIBRATION`, `DEV_ALLOWED_ORIGINS`                                 | Development tools                                                                                    | `false` / empty at the event                                     |

## 6. Database location

- **File:** SQLite at `data/linde-sphere.db`, relative to the project folder (`DATABASE_URL`). It is
  git-ignored and not served by any route.
- **Setup:** created and upgraded with `npm run db:deploy`. The four migrations include database CHECK
  constraints.
- **Contents:** leads with business contact details and the internal score, interests, anonymous session
  summaries, rendered reports, and email delivery history.
- **Protection:** it contains personal data. The laptop disk must be encrypted (**[Linde IT]**,
  PRIVACY_REVIEW A5).

## 7. Backup procedure

1. Run `npm run db:backup`. It writes a consistent copy to `data\backups\linde-sphere-<timestamp>.db` and is
   safe while the server runs (single-step online backup). Alternatively, with admin enabled, use
   "Exportaciones y respaldo" → confirmed backup download.
2. Back up at the end of each event day and before any update.
3. Move backups only to encrypted storage approved by **[Linde IT] [Linde Privacy]** (PRIVACY_REVIEW A9).
   Keep at least the last two.
4. **Restore:**
   1. Stop the server.
   2. Replace `data\linde-sphere.db` with the backup, deleting any `-journal` file next to it.
   3. Run `npm run db:deploy`, then start the server.
5. Never copy the live database file by hand while the server runs.

## 8. Known limitations

- **Content:** all of it is a demonstrative assumption. Production mode shows nothing until items are
  validated and approved (§11), and scene art and digital assets are placeholders (§12).
- **Real email:**
  - Real delivery needs an approved SMTP relay. Only failure paths are exercised end to end, since a
    successful SMTP send needs a trusted relay.
  - Microsoft Graph is not implemented.
- **Admin security:** the admin uses one passphrase and in-memory sessions. This is **not enterprise
  authentication**; any use beyond the convention needs approved authentication and a security review.
- **Deletion and retention:** there is no delete or anonymize function and no automatic retention (retention
  period undecided).
- **Lead scoring:** the weights are project-team assumptions (`0.1.0-assumed`).
- **Sales worksheet:** answers are applied to the content files by the project team. There is no CSV import.
- **Not built:** anonymous booth metrics without a lead (`POST /api/sessions`), a PDF report, and QR
  hand-off.
- **Plain HTTP:** the local network uses plain HTTP; an HTTPS certificate is an IT/security decision.
- **Rate limits:** per-client limits rely on addresses that can be spoofed on a LAN; there is also a global
  cap.
- **Missing database:** if the database was never created, the email worker logs a "table missing" error
  every tick. The kiosk stays usable, lead submission shows a safe "could not save" message, and health
  says `degraded`. Run `npm run db:deploy`.

## 9. Items requiring corporate IT approval

Each item links to its PRIVACY_REVIEW §9 number. Nothing in this project assumes these are permitted.

- **A16 Network:** Windows Mobile Hotspot or venue network, and which devices may join.
- **A17 Firewall:** an inbound rule for Node.js on the server port (profile and scope).
- **A18 Script execution:** PowerShell execution policy or script signing for the launch scripts.
- **A19 Laptop and runtime:** power, sleep and lid settings; Node.js installation.
- **A5 Laptop hardening:** disk encryption, accounts, screen lock, custody.
- **A6 Kiosk browser:** lockdown on the tablet (kiosk mode, autofill off, portrait lock).
- **A7 Email relay:** SMTP relay, sender address, SPF/DKIM, and a dedicated least-privilege account.
- **A4 Transport:** plain HTTP on an isolated network vs a local HTTPS certificate (with Linde Security).
- **A14 Logs:** log capture and retention on the laptop (with Privacy).
- **A9 Data handling:** approved storage for backups and exports, and the transfer channel to sales/CRM
  (with Privacy).

## 10. Items requiring privacy/legal approval

- **A1 Consent and notice:** final consent wording (ES/EN), and the privacy notice with controller and
  contact. `content/consent.json` is a placeholder; production collects no leads until it is validated.
- **A2 Consent record:** whether storing the consent version (not the exact text) is sufficient.
- **A3 Retention and requests:** retention periods, deletion method, and the data-subject request process
  (`LEAD_RETENTION_DAYS` is empty).
- **A10 Follow-up rule:** follow-up only with visitors who consented.
- **A11 Report wording:** report copy, disclaimer and footer (with Marketing). `content/report.json` is a
  placeholder; production sends no reports until it is validated.
- **A20 Lead scoring:** internal scoring of business contacts: acceptability, and any profiling notice.
- **A8 and A15 (Security):** whether the MVP admin protection is acceptable for the event, and a security
  review before any wider use.

## 11. Items requiring sales validation

- **Content review:** every persona (11), challenge (12), solution (11, including the fallback) and digital
  asset (3). Each needs:
  - Puerto Rico availability, keep/remove/rename, and the local name;
  - corrections and approved claims;
  - missing material and priority;
  - a sales owner and an approval.

  Use the admin page "Validación de ventas" or `exports/sales-validation.csv`, following
  SALES_VALIDATION_GUIDE.md. Today 0 of 37 items are approved.

- **Other content:** scenes, hotspots, recommendation rules and facility types must be validated for
  production.
- **Sales contact:** the contact in the report (`content/report.json` uses `ventas@example.com`, a dummy
  address).
- **Internal routing:** who receives leads internally (guide question 10).
- **Lead-scoring weights:** `src/server/leads/lead-scoring.ts`.

`npm run content:check -- --mode production` lists what is still missing. Today there are 7 blockers:

- **Personas, challenges and scenes:** none validated or approved.
- **Solutions:** the fallback solution is not validated and approved.
- **Rules:** no validated rule.
- **Consent text:** not validated.
- **Report copy:** not validated.

## 12. Items requiring approved marketing assets

- **Brand:** the "Linde Sphere" name and brand usage (A12). The palette is a neutral placeholder and no
  logo is included (`src/lib/config/brand-config.ts`, `approvalStatus: placeholder`).
- **Scene illustrations:** the 8 scenes use generated placeholder SVGs. Replace them with approved art
  at 1200 × 1500, then re-calibrate hotspots with `/dev/scenes`. `content:check` enforces the asset
  budgets.
- **Digital assets:** the 3 linked assets are placeholders pointing to `example.com`. They need
  approved, publicly shareable brochures, videos or technical sheets (A13).
- **Report copy:** subject, introduction, call to action and disclaimer (A11).

## 13. Physical kiosk tests still required

Run on the event hardware (MANUAL_KIOSK_TEST.md), then the daily CONVENTION_STARTUP_CHECKLIST.md:

- **Browser settings:** Android Chrome or kiosk browser: kiosk mode, autofill off, portrait lock, page zoom
  100 %.
- **Touch:** real taps, pinch on and off the scene, long-press, swipes, and the on-screen keyboard over the
  form.
- **Assistive settings:** TalkBack, Android "Remove animations", and larger text.
- **Network and recovery:** a Wi-Fi drop mid-journey, a laptop restart, and a browser reload.
- **Real email:** a real SMTP delivery to a test mailbox (item 9 of the startup checklist).
- **Windows specifics:** the launch script under **Windows PowerShell 5.1**, the Mobile Hotspot, the
  firewall behavior, and Ctrl+C in a Windows console.
- **Endurance:** 20 consecutive visitor sessions with resets.
- **Speed:** a cold load in about 2 s on the booth network.

## 14. Approvals summary

| Owner                 | Open items                                                      |
| --------------------- | --------------------------------------------------------------- |
| Linde IT              | A4 (with Security), A5, A6, A7, A9 (with Privacy), A14, A16–A19 |
| Linde Privacy / Legal | A1, A2, A3, A10, A11 (with Marketing), A20                      |
| Linde Security        | A4, A8, A15, A16, A17                                           |
| Linde Marketing       | A11, A12, A13 (with PR sales)                                   |
| Puerto Rico sales     | §11 (37 items, rules, contact, routing, scoring weights)        |

## 15. Go / no-go checklist

| #   | Gate                                                                                                   | Status                                       |
| --- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------- |
| 1   | Lint, typecheck, formatting pass                                                                       | ✅ Go                                        |
| 2   | Unit, integration and component tests pass (878; 3 PowerShell tests need `pwsh`)                       | ✅ Go                                        |
| 3   | End-to-end suite passes twice on a fresh production build                                              | ⏳ pending the run in progress               |
| 4   | Production build succeeds; client bundle clean; dependency audit 0 vulnerabilities                     | ✅ Go                                        |
| 5   | Demo-mode content check passes                                                                         | ✅ Go                                        |
| 6   | Production-mode content check passes (validated and approved content, consent, report)                 | ❌ No-go (§11)                               |
| 7   | Consent text and privacy notice approved (A1–A3, A10)                                                  | ❌ No-go                                     |
| 8   | Report copy, brand and assets approved (A11–A13)                                                       | ❌ No-go                                     |
| 9   | IT approvals: network, firewall, scripts, laptop, kiosk lockdown, SMTP relay (A4–A7, A9, A14, A16–A19) | ❌ No-go                                     |
| 10  | Security acceptance of the admin protection, or admin kept off (A8, A15)                               | ⚠️ Keep `ADMIN_ENABLED=false` until accepted |
| 11  | Real SMTP test email delivered on the event network                                                    | ❌ Not yet run                               |
| 12  | MANUAL_KIOSK_TEST.md completed on the event hardware                                                   | ❌ Not yet run                               |
| 13  | Lead-scoring weights approved (A20), or scores not used for follow-up                                  | ⚠️ Pending                                   |

**Decision:**

- **Software:** GO. Every automated check in gates 1–5 passed in this audit, including the full E2E suite
  run twice on a fresh production build (536 passed, 0 failed).
- **Internal demo-mode rehearsals:** GO. Use `CONTENT_MODE=demo` and the preview email provider, which
  sends nothing.
- **Production use at the convention with real visitors:** **NO-GO** until gates 6–9, 11 and 12 are
  closed and gates 10 and 13 are resolved.
