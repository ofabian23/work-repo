# Linde Sphere — Privacy and security review (MVP)

> **Status:** engineering self-assessment for review. It is **not** an approval. Every item marked with an
> owner label below needs a decision or sign-off from that team before real visitor data is collected:
>
> - **[Linde Security]** — information security
> - **[Linde Privacy]** — data protection / privacy office
> - **[Linde Legal]** — legal and compliance
> - **[Linde Marketing]** — brand, wording and communications
> - **[Linde IT]** — devices, network, accounts and email infrastructure
>
> Scope: the Linde Sphere kiosk (Android tablet in Chrome, portrait), the laptop that runs the server and
> SQLite database, report email delivery, and the optional local administration utility.
> Technical decisions are recorded in DECISIONS.md (ADR-052 to ADR-057).

---

## 1. Data collected

### 1.1 Anonymous visit data (no identity)

| Data                                                                  | When            | Required | Stored                                                      |
| --------------------------------------------------------------------- | --------------- | -------- | ----------------------------------------------------------- |
| Random session id (UUID v4)                                           | First touch     | —        | Browser memory; with a lead, in `VisitorSessionSummary`     |
| Role (persona), challenges, facility type, "something else" flag      | While exploring | No       | Browser memory; with a lead, as summary items and interests |
| Hospital areas visited, information points opened, explicit interests | While exploring | No       | Browser memory; with a lead, as summary items and interests |
| Ordered interaction events (type + content id only, no timestamps)    | While exploring | —        | Browser memory only (discarded at reset)                    |
| Recommendations shown                                                 | While exploring | —        | Browser memory; with a lead, recomputed by the server       |
| Language and accessibility preferences                                | While exploring | —        | Browser memory only                                         |

If the visitor does not submit the form, **nothing is stored on the server** and everything is discarded
at reset. (A future anonymous booth-metrics summary, `POST /api/sessions`, is not built.)

### 1.2 Business contact data (only after the visitor chooses to request the report)

| Data                                                       | Required | Notes                                                           |
| ---------------------------------------------------------- | -------- | --------------------------------------------------------------- |
| First name, last name                                      | Yes      | Letters, spaces, apostrophes, periods, hyphens; ≤ 80 characters |
| Organization                                               | Yes      | ≤ 160 characters, restricted character set                      |
| Role or function                                           | Yes      | Chosen from a list (stored as its Spanish label)                |
| Business email                                             | Yes      | Trimmed and lower-cased; ASCII only                             |
| Phone                                                      | No       | Digits and common separators                                    |
| Preferred report language                                  | Yes      | es / en                                                         |
| Interests confirmed on the form                            | No       | Content ids only                                                |
| Report consent (required) and follow-up consent (optional) | —        | Two separate checkboxes; version of the consent text stored     |

**Never collected:** patient or health information, free-text fields (notes, comments), photos, location,
payment data, government identifiers. The server rejects unknown fields, and an automated test fails if a
patient-like field is ever added to the database schema or the submission.

### 1.3 Technical and derived data

| Data                                                                      | Purpose                                                                                                                                                                           |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Request token (idempotency key) and payload fingerprint                   | Prevent duplicate leads from double taps and retries                                                                                                                              |
| SHA-256 hash of the status token                                          | Let the kiosk check delivery status without identity                                                                                                                              |
| Server-recomputed recommendations with relevance words                    | Report content and sales context (never a score)                                                                                                                                  |
| Rendered report (subject, HTML, text)                                     | Retries send exactly what was promised                                                                                                                                            |
| Email delivery status, attempts, timestamps, error codes                  | Delivery and retry; codes only, never provider text                                                                                                                               |
| Export timestamp (`exportedAt`)                                           | Track which leads were handed to sales                                                                                                                                            |
| Consent text version, content version                                     | Traceability of what the visitor saw                                                                                                                                              |
| Internal lead score (0–100), tier A/B/C, factor codes and weights version | Order sales follow-up; server and admin/CSV only, never shown to the visitor or in the report (AC-16). Weights are assumptions — **[Linde Privacy] [Linde Sales]** approval (A20) |

**Not recorded:** IP addresses (not stored or logged by the application), device identifiers, cookies on
visitor screens, analytics or tracking of any kind.

### 1.4 Administration

| Data                                      | Where                                                     |
| ----------------------------------------- | --------------------------------------------------------- |
| Admin passphrase                          | Never stored; only its scrypt hash in `.env`              |
| Admin session token                       | HttpOnly cookie on the laptop's browser; hash in memory   |
| Audit log lines (sign-in, export, retry…) | Application log: counts, filters and ids, no contact data |

## 2. Purpose

| Purpose                                                  | Data used                                                          | Basis (to confirm)                    |
| -------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------- |
| Show relevant recommendations during the visit           | Anonymous visit data (browser memory)                              | Visitor's interaction                 |
| Send the personalized report the visitor requested       | Contact data, visit summary, recommendations                       | Report consent — **[Linde Legal]**    |
| Sales follow-up                                          | Contact data and interests, **only where follow-up consent = yes** | Follow-up consent — **[Linde Legal]** |
| Operate delivery (retries, status)                       | Technical data                                                     | Needed to fulfil the request          |
| Booth statistics (aggregate counts in the admin utility) | Stored leads                                                       | **[Linde Privacy]** to confirm        |

Exports include the follow-up consent column; the README and the export screen instruct staff to follow up
only with visitors who consented. **[Linde Privacy]** should confirm this handling rule for the sales team.

## 3. Storage locations

| Location                                         | Content                                              | Protection                                                                                  |
| ------------------------------------------------ | ---------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Kiosk browser memory                             | Visit data; contact data only while the form is open | Cleared on every reset (hard reload); no localStorage, sessionStorage, IndexedDB or cookies |
| Laptop: `data/linde-sphere.db` (+ `-wal`/`-shm`) | Leads, interests, summaries, reports, deliveries     | Git-ignored; not served by any route; **disk encryption required — [Linde IT]**             |
| Laptop: `data/backups/`                          | Full database copies (`npm run db:backup`)           | Git-ignored; **encrypted storage required — [Linde IT]**                                    |
| Laptop: `data/exports/` or browser downloads     | CSV exports (`db:export`, admin utility)             | Git-ignored; confirmation required; **handling rule — [Linde Privacy]**                     |
| Laptop: `data/email-preview/`                    | Development email previews (contain contact data)    | Git-ignored; files mode 600; development only                                               |
| Application log (console)                        | Events with ids, counts and masked values            | Personal fields masked; no exported data or message content                                 |
| SMTP relay and recipient mailbox                 | The report email                                     | TLS to the relay; **relay and sender account — [Linde IT]**                                 |

## 4. Transmission paths

1. **Tablet → laptop** (convention Wi-Fi hotspot or LAN, `http://<laptop-ip>:3000`): page, content,
   the lead submission (JSON, ≤ 16 KB) and status checks. **This traffic is plain HTTP on the local network.**
   Mitigations: private hotspot with WPA2/WPA3 password, host allowlist (loopback, private IPv4, `.local`),
   same-origin checks, CSP, no third-party requests. **[Linde Security] [Linde IT]:** approve plain HTTP on
   an isolated hotspot, or provide a trusted local certificate for HTTPS.
2. **Laptop → SMTP relay:** the rendered report. TLS 1.2+ with certificate verification, implicit TLS or
   required STARTTLS; plain SMTP is refused in production. **[Linde IT]:** relay, sender address, SPF/DKIM.
3. **Relay → visitor's mailbox:** outside the application's control.
4. **Laptop → sales team:** CSV exports or backups moved manually. **[Linde Privacy] [Linde IT]:** approved
   transfer channel and destination (e.g., CRM import), and deletion of local copies.
5. **No other outbound traffic:** no analytics, fonts, CDNs or remote images (verified by an automated test
   that fails on any cross-origin request during a full visit).

## 5. Consent points

| Point                         | What the visitor sees                                                                | Status                                                                                   |
| ----------------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| Welcome screen → "Privacidad" | Four plain-language statements (no contact data to explore; reset clears selections) | Draft wording — **[Linde Legal] [Linde Marketing]**                                      |
| Form step 1                   | "Use sus datos de trabajo. No incluya información de pacientes."                     | Draft wording — **[Linde Marketing]**                                                    |
| Form step 2 — consent 1       | Permission to send the requested report (required, unchecked by default)             | Placeholder text v0.1.0 marked [BORRADOR] — **[Linde Legal]**                            |
| Form step 2 — consent 2       | Optional permission for sales follow-up (independent, unchecked by default)          | Placeholder text v0.1.0 marked [BORRADOR] — **[Linde Legal]**                            |
| Form step 2 — privacy notice  | Purpose statement                                                                    | Placeholder — must name the controller and a contact — **[Linde Legal] [Linde Privacy]** |
| Report email footer           | Why the visitor receives it; how to ask about their data                             | Placeholder [BORRADOR] — **[Linde Legal] [Linde Privacy]**                               |

Consent text lives in `content/consent.json` (versioned). The server rejects submissions made with an
outdated consent version. Only the **version** is stored with each lead, not the exact text or the language
shown. **[Linde Legal]:** confirm the version is sufficient evidence, or require storing the exact text and
language per consent (a planned `ConsentRecord` table).

## 6. Retention — decisions required

Nothing is deleted automatically. `LEAD_RETENTION_DAYS` is an empty placeholder: no period has been invented.

| Data                                    | Current behavior                                      | Decision needed                                                          |
| --------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------ |
| Leads, interests, rendered reports      | Kept until manually removed                           | Retention period and deletion method — **[Linde Privacy] [Linde Legal]** |
| Visitors without follow-up consent      | Kept like other leads                                 | Delete after the report is sent? — **[Linde Privacy]**                   |
| Anonymous session summaries             | Kept (not personal data)                              | Confirm classification and period — **[Linde Privacy]**                  |
| Delivery status and event history       | Kept with the lead (deleted with it)                  | Period — **[Linde Privacy]**                                             |
| Database backups                        | Manual; kept until deleted                            | Where, how long, who holds them — **[Linde IT] [Linde Privacy]**         |
| CSV exports                             | Manual; kept until deleted                            | Destination and deletion after import — **[Linde Privacy]**              |
| Email previews (development)            | Kept until deleted                                    | Must not exist on the event laptop — **[Linde IT]**                      |
| Application logs                        | Console output (masked)                               | Whether logs are captured and for how long — **[Linde IT]**              |
| Data-subject requests (access, erasure) | `Lead.status = erasure_requested` exists; no workflow | Process, owner and contact channel — **[Linde Privacy] [Linde Legal]**   |

## 7. Access-control assumptions

The MVP is safe **only if** these hold. Each is an assumption for **[Linde Security]** and **[Linde IT]** to
confirm:

1. The laptop is company-managed, disk-encrypted (e.g., BitLocker), screen-locked when unattended, and
   physically guarded at the booth. Its OS account is not shared with the public.
2. The tablet runs a locked kiosk browser (e.g., Fully Kiosk Browser) that shows only the kiosk URL, with
   autofill and password saving disabled and no access to other apps.
3. The network is a private hotspot (WPA2/WPA3) used only by the kiosk and staff devices, not the public
   convention Wi-Fi. The server is never exposed to the internet.
4. The local administration utility is off at the event unless needed (`ADMIN_ENABLED=false`). When on, it
   is protected by **one passphrase** (scrypt hash only), an in-memory session and a sign-in throttle. **This
   is MVP protection, not enterprise authentication. A production deployment requires approved
   authentication (e.g., company SSO), role separation, a persistent audit log and a security review —
   [Linde Security].**
5. Only named staff know the admin passphrase and handle exports and backups. **[Linde Privacy]:** approve
   the list of people and the handling rule.
6. SMTP credentials exist only in the laptop's `.env` (git-ignored), never in source control or the client
   bundle (verified by `npm run security:bundle`). **[Linde IT]:** issue a dedicated, least-privilege
   sending account.

## 8. Implemented safeguards (for reference)

| Area               | Safeguard                                                                                                                                            | Verified by                                                |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Input validation   | Strict Zod schemas on every route; unknown fields rejected; content-aware checks                                                                     | Unit and API tests                                         |
| Body size          | Leads ≤ 16 KB (JSON only); admin forms ≤ 4 KB                                                                                                        | Unit tests                                                 |
| Duplicates         | Request token + fingerprint; unique index; UI double-tap guard                                                                                       | Unit, component and E2E tests                              |
| Rate limiting      | Leads 10/min per client, 60/min overall; status 120/min; admin sign-in lockout                                                                       | Unit tests                                                 |
| Origin / host      | Host allowlist (DNS rebinding); same-origin required for lead and admin POSTs                                                                        | Unit and E2E tests                                         |
| Headers            | CSP (self only, no frames), X-Frame-Options, nosniff, no-referrer, COOP/CORP, `no-store` kiosk page, sandboxed assets                                | Unit and E2E tests (no CSP violations during a full visit) |
| Errors             | Generic JSON or text bodies; logs keep error name/code only; Next production pages show a digest only                                                | Unit and E2E tests                                         |
| Output encoding    | React escaping; report HTML escapes every value; no raw HTML rendering                                                                               | Report tests                                               |
| CSV injection      | Apostrophe before `= + - @`, tab, CR (also after spaces and full-width)                                                                              | Unit tests                                                 |
| Logs               | Masked names, emails, phones, organizations, tokens; no exported data                                                                                | Unit tests                                                 |
| Browser            | No storage APIs used; reset hard-reloads; bfcache reload; `no-store`                                                                                 | Component and E2E tests                                    |
| Static assets      | Media-type allowlist; SVG scan (no script, handlers, external refs); sandbox CSP                                                                     | Content check and unit tests                               |
| Uploads            | None exist. Any future upload must use the same allowlist, re-encode images, and never store into `public/`                                          | Documented rule                                            |
| Secrets            | Env validated, values never echoed; plaintext admin credentials rejected; bundle scan                                                                | Unit tests and `security:bundle`                           |
| Dependencies       | `npm run security:audit` (runtime tree); Prisma CLI advisories patched via overrides                                                                 | Audit: 0 vulnerabilities at time of writing                |
| Separation         | Admin in its own segment and layout, reachable only via the configured path, off by default                                                          | Unit and E2E tests                                         |
| Source control     | `data/`, `*.db*`, `*.sqlite*`, `*.eml`, lead CSVs, `.env*` ignored                                                                                   | Unit test (`git check-ignore`)                             |
| Production content | Only validated, sales-approved content in production; unvalidated consent text and report copy withheld, so no lead capture until approved (ADR-060) | Unit, component and production-mode E2E tests              |

## 9. Unresolved approvals

| #   | Item                                                                                                                                                   | Owner                                        | Blocks                      |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------- | --------------------------- |
| A1  | Final consent wording (ES/EN), privacy notice with controller and contact                                                                              | **[Linde Legal] [Linde Privacy]**            | Collecting real leads       |
| A2  | Whether storing the consent version (not exact text) is sufficient                                                                                     | **[Linde Legal]**                            | Collecting real leads       |
| A3  | Retention periods and deletion method for every row in §6; data-subject request process                                                                | **[Linde Privacy] [Linde Legal]**            | Post-event handling         |
| A4  | Plain HTTP on an isolated hotspot vs. local HTTPS certificate                                                                                          | **[Linde Security] [Linde IT]**              | Event deployment            |
| A5  | Laptop hardening: disk encryption, accounts, screen lock, custody                                                                                      | **[Linde IT]**                               | Event deployment            |
| A6  | Kiosk browser lockdown configuration on the tablet                                                                                                     | **[Linde IT]**                               | Event deployment            |
| A7  | SMTP relay, sender address, SPF/DKIM, dedicated account                                                                                                | **[Linde IT]**                               | Real email delivery         |
| A8  | MVP admin protection acceptable for the event; production authentication plan                                                                          | **[Linde Security]**                         | Enabling admin at the event |
| A9  | Who may handle exports/backups; approved transfer channel to sales/CRM                                                                                 | **[Linde Privacy] [Linde IT]**               | Handing leads to sales      |
| A10 | Follow-up only with consenting visitors (sales handling rule)                                                                                          | **[Linde Privacy] [Linde Legal]**            | Sales follow-up             |
| A11 | Report copy, disclaimer and footer wording; sales contact details                                                                                      | **[Linde Marketing] [Linde Legal]**          | Production mode             |
| A12 | "Linde Sphere" name and brand usage                                                                                                                    | **[Linde Marketing]**                        | Production mode             |
| A13 | Validated Puerto Rico solution catalog and approved resources                                                                                          | **[Linde Marketing]** (with PR sales)        | Production mode             |
| A14 | Log capture and retention on the laptop                                                                                                                | **[Linde IT] [Linde Privacy]**               | Event deployment            |
| A15 | Security review of this MVP before any use beyond the convention                                                                                       | **[Linde Security]**                         | Any wider deployment        |
| A16 | Network for the event: Windows Mobile Hotspot or venue network; which devices may join                                                                 | **[Linde IT] [Linde Security]**              | Event deployment            |
| A17 | Inbound firewall rule for Node.js on the server port (profile, scope)                                                                                  | **[Linde IT] [Linde Security]**              | Kiosk reaching the laptop   |
| A18 | Running the launch scripts: PowerShell execution policy or script signing                                                                              | **[Linde IT]**                               | Using the launch scripts    |
| A19 | Laptop power, sleep and lid settings for event use; Node.js installation                                                                               | **[Linde IT]**                               | Event deployment            |
| A20 | Internal lead scoring of business contacts: whether it is acceptable (profiling notice), and the weights (role, consent, engagement, personal mailbox) | **[Linde Privacy] [Linde Legal]** + PR sales | Using scores for follow-up  |

## 10. Residual risks (accepted for the MVP, pending review)

- Tablet–laptop traffic is unencrypted on the local network (A4).
- Rate limits key on client addresses that can be spoofed on a LAN; a global cap bounds the impact, and on a
  hostile network a flood could block submissions for up to a minute.
- Admin sessions are held in memory and have no roles; anyone with the passphrase has full admin access.
- The database, backups and exports are only as safe as the laptop and the people handling them (A5, A9).
- A browser refresh during the form discards what the visitor typed (privacy over convenience).
