# Linde Sphere

Interactive healthcare discovery experience for a portrait touchscreen kiosk at a healthcare convention
in Puerto Rico (internal codename _Mockup Vision_).

**Status:** MVP feature-complete. The three journeys, hospital explorer, recommendations, lead capture,
report email with retries, session reset, local admin, sales validation and the Windows launch scripts are
built and tested. All content is still a demonstrative assumption pending Puerto Rico validation.

Release status, run instructions and open approvals are in [RELEASE_READINESS.md](./RELEASE_READINESS.md).

## Documentation

| Document                                                             | Purpose                                                              |
| -------------------------------------------------------------------- | -------------------------------------------------------------------- |
| [PROJECT_BRIEF.md](./PROJECT_BRIEF.md)                               | Scope, journey, MVP boundaries, acceptance criteria                  |
| [ARCHITECTURE.md](./ARCHITECTURE.md)                                 | Stack, structure, content model, engine, privacy boundaries          |
| [DECISIONS.md](./DECISIONS.md)                                       | Architecture decision records                                        |
| [TASKS.md](./TASKS.md)                                               | Phased implementation plan and progress                              |
| [CONTENT_VALIDATION.md](./CONTENT_VALIDATION.md)                     | Content statuses, visibility rules, validation workflow              |
| [PRIVACY_REVIEW.md](./PRIVACY_REVIEW.md)                             | Data, storage, transmission, consent, open approvals                 |
| [SALES_VALIDATION_GUIDE.md](./SALES_VALIDATION_GUIDE.md)             | How the Puerto Rico sales team reviews and approves content          |
| [CONVENTION_STARTUP_CHECKLIST.md](./CONVENTION_STARTUP_CHECKLIST.md) | Daily startup, test and shutdown checklist at the booth              |
| [RELEASE_READINESS.md](./RELEASE_READINESS.md)                       | Final audit, run instructions, open approvals, go/no-go              |
| [TESTING.md](./TESTING.md)                                           | How the app is tested; requirement-to-test map; what cannot run here |
| [MANUAL_KIOSK_TEST.md](./MANUAL_KIOSK_TEST.md)                       | Physical-device test of the Android kiosk                            |

## Requirements

- Node.js 22 LTS (≥ 20.9) and npm
- Windows, macOS or Linux

## Quick start

Run these from the `linde-sphere/` folder:

```bash
npm install                 # also generates the Prisma client
cp .env.example .env        # Windows PowerShell: Copy-Item .env.example .env
npm run db:deploy           # create/upgrade the SQLite database in data/
npm run dev                 # open http://localhost:3000
```

`.env` is optional in development (safe defaults apply) and is git-ignored. Never commit it.

## Scripts

| Command                                      | What it does                                                                                |
| -------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `npm run dev`                                | Development server on **this computer only** (`localhost:3000`)                             |
| `npm run dev:network`                        | Development server reachable from **other devices** on the network                          |
| `npm run build`                              | Production build                                                                            |
| `npm run start`                              | Serve the production build on this computer only (`localhost:3000`)                         |
| `npm run start:network`                      | Serve the production build to the network (kiosk use)                                       |
| `npm run lint`                               | ESLint (zero warnings allowed)                                                              |
| `npm run typecheck`                          | Generate Next.js route types, then `tsc --noEmit`                                           |
| `npm run test`                               | Unit tests (Vitest)                                                                         |
| `npm run test:e2e`                           | End-to-end tests (Playwright) at kiosk, laptop and phone sizes                              |
| `npm run content:check`                      | Validate every file in `content/` (exit code 1 on errors)                                   |
| `npm run content:check -- --mode production` | Also require production readiness (validated content only)                                  |
| `npm run content:export`                     | Regenerate the content and sales-validation CSVs (`exports/`) and CONTENT_VALIDATION.md §11 |
| `npm run check`                              | content check + export freshness + lint + typecheck + format + unit tests                   |
| `npm run format`                             | Format all files with Prettier                                                              |
| `npm run db:deploy`                          | Apply database migrations (creates `data/linde-sphere.db` if missing)                       |
| `npm run db:migrate`                         | Development only: create a new migration after editing the schema                           |
| `npm run db:seed`                            | Development only: add two synthetic leads (refuses `NODE_ENV=production`)                   |
| `npm run db:backup`                          | Consistent backup of the database to `data/backups/`                                        |
| `npm run db:export`                          | Export leads to CSV in `data/exports/` (contains personal data)                             |
| `npm run email:status`                       | Email deliveries by status, and those needing attention (ids and codes)                     |
| `npm run email:retry -- --delivery <id>`     | One immediate attempt for a delivery (`--all-failed` for every failed one)                  |
| `npm run security:bundle`                    | After `build`: fail if server secrets or server-only code reach the browser bundle          |
| `npm run security:audit`                     | `npm audit` of the runtime dependency tree (high severity fails)                            |
| `npm run email:preview`                      | Sample reports (ES and EN, synthetic data) in `data/email-preview/`                         |
| `scripts\windows\start-kiosk-server.ps1`     | Windows: checks, then production server on the network, with kiosk URLs                     |
| `scripts\windows\start-dev-network.ps1`      | Windows: checks, then development server on the network (not for the event)                 |

Use another port with `-- -p <port>`, for example `npm run dev -- -p 4000`.

First-time E2E setup on a new machine: `npx playwright install chromium`.

## Localhost versus local-network access

| Mode          | Command                                         | Listens on                 | Who can open it                                                   |
| ------------- | ----------------------------------------------- | -------------------------- | ----------------------------------------------------------------- |
| Local only    | `npm run dev` / `npm run start`                 | `localhost` only           | Only a browser on the same computer: `http://localhost:3000`      |
| Local network | `npm run dev:network` / `npm run start:network` | `0.0.0.0` (all interfaces) | Any device on the same Wi-Fi/hotspot: `http://<laptop-IPv4>:3000` |

Use **local-only** for everyday development: nothing is exposed to other devices. Use **network** mode
only when the Android kiosk (or another test device) must connect.

### Connecting the Android kiosk

1. Put the laptop and the kiosk on the same network. The recommended option is the laptop's Windows
   **Mobile Hotspot** (Settings → Network & internet → Mobile hotspot), with the kiosk joined to it.
2. Find the laptop's IPv4 address:
   - Windows: `ipconfig` → the adapter the kiosk uses. For Mobile Hotspot this is usually
     `Local Area Connection* …` with **`192.168.137.1`**.
   - macOS/Linux: `ipconfig getifaddr en0` or `hostname -I`.
3. Build and serve for the network:
   ```bash
   npm run build
   npm run start:network
   ```
4. On the kiosk, open Chrome at `http://<laptop-IPv4>:3000`, for example `http://192.168.137.1:3000`.
5. Check readiness from any device: `http://<laptop-IPv4>:3000/api/health`.

Notes:

- Next.js prints `Network: http://0.0.0.0:3000` in network mode. That means "all interfaces". Browse
  to the laptop's real IPv4 address, not `0.0.0.0`.
- The first time, Windows Defender Firewall may ask whether Node.js can accept connections. Whether to
  allow it, and on which network profile, is decided by Linde IT (see
  [Deployment on the event laptop](#deployment-on-the-event-laptop-windows), step 9).
- `npm run dev:network` also works for testing on the kiosk. The dev server accepts hot-reload
  connections from private LAN addresses (192.168.x.x, 10.x.x.x, 172.x.x.x). Add other hostnames with
  `DEV_ALLOWED_ORIGINS` in `.env`. At the event, always use `build` + `start:network`.

## Deployment on the event laptop (Windows)

This section runs the kiosk from a Windows laptop and opens it on the Android kiosk over the same network
(a venue network or the laptop's Windows Mobile Hotspot). Steps marked **[Linde IT]** are organizationally
controlled. This project does not assume that corporate policy allows them, and the scripts never change
them. Before each event, use [CONVENTION_STARTUP_CHECKLIST.md](./CONVENTION_STARTUP_CHECKLIST.md) and, for
new hardware, [MANUAL_KIOSK_TEST.md](./MANUAL_KIOSK_TEST.md).

Commands run in **PowerShell** from the `linde-sphere` folder.

1. **Install dependencies.** Install Node.js 22 LTS (at least 20.9), which includes npm, then:

   ```powershell
   npm install
   ```

   Installing software on a company laptop may need **[Linde IT]** approval.

2. **Create the environment configuration.**

   ```powershell
   Copy-Item .env.example .env
   notepad .env
   ```

   Set at least `CONTENT_MODE` (`demo` until content is validated), the email settings (see
   [Personalized report email](#personalized-report-email)) and, only if needed, `PORT`. Keep secrets only
   in `.env`, which is git-ignored.

3. **Initialize SQLite.** This creates `data\linde-sphere.db` and applies migrations. Run it again after
   every update.

   ```powershell
   npm run db:deploy
   ```

4. **Create the production build.** Run it again after every update or content change.

   ```powershell
   npm run build
   ```

5. **Start the local server.**

   ```powershell
   powershell -NoProfile -File scripts\windows\start-kiosk-server.ps1
   ```

   What the script does:
   - It checks Node.js and npm, the dependencies, `.env`, the database, the build (and whether it is out of
     date) and the port.
   - It starts the production server on `0.0.0.0` (all adapters) and waits for `/api/health`.
   - It prints the laptop's candidate IPv4 addresses and the exact URL format for the kiosk.
   - If anything is wrong, it says what and how to fix it, and does not start the server.

   Options:
   - `-Port 3001`: use another port. The default is the `PORT` environment variable, then `PORT` in
     `.env`, then 3000.
   - `-CheckOnly`: run the checks and show the addresses without starting.

   Keep the window open while the kiosk is in use. For development on the kiosk, use
   `scripts\windows\start-dev-network.ps1` instead (hot reload, not for the event).

   If PowerShell refuses to run scripts ("running scripts is disabled on this system"), the execution
   policy is managed by **[Linde IT]**: ask them to approve or sign the scripts. Do not change the policy
   yourself. The equivalent manual command is `npm run start:network` (add `-- -p 3001` for another port).

6. **Connect the laptop and the kiosk to the same network.** Use either:
   - the venue or office Wi-Fi, if both devices may join it and the network allows device-to-device
     traffic (many guest networks do not); or
   - the laptop's **Windows Mobile Hotspot** (Settings → Network & internet → Mobile hotspot), with the
     kiosk joined to it.

   Using a hotspot, and joining the kiosk to a given network, are **[Linde IT]** decisions. Only use a
   network IT has approved.

7. **Find the laptop's IPv4 address.** The launch script lists the candidates.
   - **Mobile Hotspot:** usually **`192.168.137.1`**.
   - **By hand:** `ipconfig` shows the IPv4 Address of the adapter on the shared network. The hotspot
     adapter is named `Local Area Connection* …`.
   - Addresses starting with `169.254.` mean that adapter has no working network.
   - Public addresses are refused by the server's host allowlist unless added to `ALLOWED_HOSTS`.

8. **Open the address in Chrome on the kiosk:** `http://<laptop-IPv4>:3000/`, for example
   `http://192.168.137.1:3000/`.
   - Use `http://`, not `https://`, and include the port.
   - Never use `0.0.0.0`.
   - Then set that address as the kiosk browser's start page. Kiosk browser lockdown is a **[Linde IT]**
     setting (PRIVACY_REVIEW A6).

9. **Check the health route.** Open `http://<laptop-IPv4>:3000/api/health` on the kiosk, or
   `http://localhost:3000/api/health` on the laptop.
   - `"status":"ok"`: ready.
   - `"degraded"`: usually the database is missing or not migrated (step 3).
   - `"error"`: configuration or content is invalid; `invalidVariables` lists the variable names.
   - See [Health check](#health-check).

   **Windows firewall (organizationally controlled).** If the page opens on the laptop (`localhost`) but
   not on the kiosk, Windows Defender Firewall is the usual cause. It blocks inbound connections to
   Node.js on TCP port 3000 until a rule allows them.
   - Allowing it (for example, the Private network profile only, never Public) is a **[Linde IT]** change.
   - The scripts never modify firewall rules. Do not approve the Windows prompt or add rules unless IT has
     authorized it.

10. **If the kiosk cannot connect,** check these common causes, in order:
    - **Different networks:** the kiosk is on another Wi-Fi, mobile data, or a guest network with client
      isolation.
    - **Wrong address:** an old IP (it can change when the network changes), `0.0.0.0`, `https://`, or a
      missing `:3000`.
    - **Server not running:** the window was closed, the laptop slept, or the script stopped with
      `[FAIL]`. Check on the laptop with `http://localhost:3000/api/health`.
    - **Firewall:** see step 9 (**[Linde IT]**).
    - **VPN or security software:** it may block local traffic. Ask **[Linde IT]**; do not disable it
      yourself.
    - **"Misdirected request" (421):** the address is not local or private. Add the hostname to
      `ALLOWED_HOSTS` only if IT approves.
    - **Laptop asleep:** screen and sleep settings follow the approved IT configuration.

11. **Back up the database** at the end of each event day and before any update. This is safe while the
    server is running.

    ```powershell
    npm run db:backup
    ```

    The backup goes to `data\backups\linde-sphere-<timestamp>.db` and contains personal data. Move it only
    to encrypted storage approved by **[Linde IT] [Linde Privacy]** (see [Backup](#backup) and
    PRIVACY_REVIEW A9).

12. **Shut down safely.**
    1. Let the current visitor finish, or let the kiosk return to the attract screen.
    2. Run `npm run db:backup` in a second PowerShell window.
    3. Press **Ctrl+C** in the server window. The script stops the server and frees the port.
    4. Close the kiosk browser, then shut down or lock the laptop as IT requires.

    Do not unplug the laptop or close the lid while the server is running. Do not copy
    `data\linde-sphere.db` by hand while it runs; use `db:backup`.

What could not be verified in the development environment:

- The launch scripts were exercised with PowerShell 7 on Linux:
  - checks, a real start with the health check, Ctrl+C;
  - failure paths: invalid port, port in use, missing Node.js, dependencies, build or database, invalid
    configuration;
  - a project path with spaces.
- PSScriptAnalyzer found no syntax or command incompatibilities with Windows PowerShell 5.1.
- Not verified here, and to be checked on the event laptop: running under Windows PowerShell 5.1 itself,
  the Windows Mobile Hotspot, the firewall prompt, `ipconfig` adapter names, Ctrl+C in a Windows console,
  and a physical Android kiosk connecting over Wi-Fi.

## Development tools (development only)

- **Component gallery:** `npm run dev` → <http://localhost:3000/dev/components> shows every design-system
  component with real content, live recommendations, and both languages (use the header toggle).
- **Scene calibration:** <http://localhost:3000/dev/scenes>. Pick a scene and tap the illustration to read
  normalized hotspot coordinates (percent of the art box), then use "Copy coordinates" and paste into
  `content/scenes/<id>.json`.

Production builds answer 404 at both URLs unless `ENABLE_COMPONENT_GALLERY=true` or
`ENABLE_SCENE_CALIBRATION=true` is set in `.env`. Keep both off at the event.

## Scene art

The placeholder illustrations in `public/assets/scenes/placeholder/` are original and generated by
`npm run art:placeholders`. Add `-- --sync-content` to also write the hotspot anchors drawn in each scene into
`content/scenes`. Approved art replaces these files at the same 1200 × 1500 size. Then re-check the hotspot
positions with the calibration tool.

## Health check

`GET /api/health` returns JSON with the application version, content mode, configuration validity (by
variable name only), content validity and database readiness. It is never cached and contains no secrets.

- `status: "ok"`: everything ready.
- `status: "degraded"`: serving, but not every dependency is ready — usually the database has not been
  created or migrated yet (`database.status: "not_initialized"`, reason `database_file_missing`,
  `migrations_not_applied` or `migrations_pending`). Run `npm run db:deploy`.
- `status: "error"` (HTTP 503): invalid configuration or content, or an unreadable database.

## Database (leads)

Leads are stored locally in SQLite (`data/linde-sphere.db`, git-ignored) through Prisma. The kiosk sends
leads to `POST /api/leads`; the only other lead route returns a delivery status for an opaque token.
**No web route lists or exports leads** — exports run on the laptop.

- **Create or upgrade:** `npm run db:deploy`. Run it after every update that adds a migration; the health
  check reports `migrations_pending` until you do.
- **Where the file is:** `DATABASE_URL` (default `file:./data/linde-sphere.db`). Prisma CLI commands read it
  from the shell, not from `.env`: `DATABASE_URL=file:./data/other.db npm run db:deploy`
  (PowerShell: `$env:DATABASE_URL="file:./data/other.db"; npm run db:deploy`).
- **Test data:** `npm run db:seed` adds two obviously fictitious leads (`@example.test`) for development.
  Never seed the event laptop; the command refuses to run with `NODE_ENV=production`.

### Backup

- `npm run db:backup` writes a consistent copy to `data/backups/linde-sphere-<timestamp>.db` using SQLite's
  online backup, so it is safe while the kiosk is running. Use `-- --out <path>` to choose the file.
- Do not copy `linde-sphere.db` by hand while the server runs: a copy taken mid-write can be inconsistent.
  Stop the server first, or use `db:backup`.
- Suggested event routine: back up at the end of each event day and before any update, to an
  **encrypted** USB drive or approved company storage. Keep at least the last two backups.
- Restore: stop the server, replace `data/linde-sphere.db` with the backup file (delete any
  `linde-sphere.db-journal` file next to it), run `npm run db:deploy`, then start the server.

### Export

- `npm run db:export` writes `data/exports/leads-<timestamp>.csv` (UTF-8 with BOM for Excel). It holds one
  row per lead: contact fields, role, language, consents and consent-text version, report-delivery state,
  selected challenges and recommended solution ids. Use `-- --out <path>` to choose the file.
- Follow up only with leads whose `followUpConsent` is `true`; `reportConsent` covers the requested
  report only.
- The CSV contains personal contact data. Keep it on encrypted storage, share it only through the
  company's approved channel, and delete local copies after import. Cells that start with `=`, `+`, `-`
  or `@` are prefixed with `'` so spreadsheet programs do not run them as formulas.

### Retention

The retention period for leads **has not been decided** (open question Q7, owner/compliance).
`LEAD_RETENTION_DAYS` in `.env` is a placeholder: leave it empty until a period is approved. Nothing is
deleted automatically in any case; a purge command will be added once the policy exists.

### Privacy safeguards

- The form collects business contact data only: no patient information, no free-text fields. The server
  rejects unknown fields.
- Application logs never contain full contact records: names, emails, phones and organizations are
  masked, and only record ids and outcomes are logged.
- Email delivery keeps a status, an attempt count and a short error code only; never credentials or
  provider responses.

## Kiosk session timing

Each visit resets itself for the next visitor's privacy: after a period without touches a "¿Sigue ahí?"
warning appears with a countdown and a **"Continuar mi sesión"** button; with no answer the kiosk returns
to the attract screen with a fresh session. A submission that is being sent is never interrupted. After a
successful submission the completion screen shows the delivery status and a short countdown, with
**"Finalizar ahora"**.

The intervals can be changed in `.env` without rebuilding (restart the server; values in seconds):

| Variable                            | Default | Meaning                                         |
| ----------------------------------- | ------- | ----------------------------------------------- |
| `KIOSK_IDLE_WARNING_SECONDS`        | 60      | No touches before the warning (most screens)    |
| `KIOSK_IDLE_COUNTDOWN_SECONDS`      | 15      | Warning countdown before the reset              |
| `KIOSK_FORM_IDLE_WARNING_SECONDS`   | 120     | Same on the contact form                        |
| `KIOSK_FORM_IDLE_COUNTDOWN_SECONDS` | 20      | Warning countdown on the contact form           |
| `KIOSK_COMPLETION_SECONDS`          | 15      | Completion screen before returning to the start |

## Personalized report email

When a visitor sends the form, the server stores the lead, builds their personalized report (in their
chosen language) and stores it with a pending email — all in one step — and then tries to send it. If
sending fails, the lead is safe: the email is retried automatically with increasing waits, up to
`EMAIL_MAX_ATTEMPTS` times, and then marked failed for a manual retry. Nothing ever loops forever.

The report contains the visitor's name, organization and role, their priorities, the areas they explored,
the top recommendations with why each appeared, approved resources only, the sales contact with a
consultation button, the applicability disclaimer and a privacy footer. It never contains scores,
internal notes, session details or anyone else's data. Its wording and the sales contact live in
`content/report.json` (placeholder text marked [BORRADOR]/[DRAFT] and a dummy `example.com` contact until
marketing, legal and sales approve them).

### Development: preview without sending (default)

1. Leave `EMAIL_PROVIDER=preview` in `.env` (or leave it unset).
2. Submit the form in the kiosk (or run `npm run db:seed`).
3. Open `data/email-preview/index.html` in a browser. Each email is saved as `.html` (open or print),
   `.txt` and `.eml` (open in any mail client). File names contain only a timestamp and an id.
4. `npm run email:preview` writes `sample-es.html` and `sample-en.html` from fictitious data, for reviewing
   the design without submitting the form.

Preview files contain the visitor's contact details: they stay in `data/` (git-ignored), readable by your
user only. Delete them when you no longer need them.

### Event: real delivery through SMTP

1. Ask IT for an SMTP relay account and an approved sender address (PROJECT_BRIEF Q2).
2. In `.env` (never commit it), set — dummy values shown:

   ```dotenv
   EMAIL_PROVIDER=smtp
   EMAIL_FROM=Linde Sphere <reportes@example.com>
   EMAIL_REPLY_TO=ventas@example.com
   SMTP_HOST=smtp.example.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_REQUIRE_TLS=true
   SMTP_USER=reportes@example.com
   SMTP_PASS=change-me
   ```

   For implicit TLS use `SMTP_PORT=465` and `SMTP_SECURE=true`. The connection always uses TLS 1.2+ with
   certificate verification; with `SMTP_SECURE=false` the server must offer STARTTLS or nothing is sent.

3. Restart the server. `GET /api/health` shows `"email": { "provider": "smtp", "deliversExternally": true }`.
   An invalid configuration stops the server with a message naming the variable (never its value).
4. Send one test submission to your own address and check `npm run email:status`.

The SMTP password lives only in `.env` on the laptop. It is read by the server, never sent to the kiosk
screen, and never logged; provider errors are stored as short codes such as `SMTP_TRANSIENT_FAILURE`.

### Checking and retrying deliveries

- `npm run email:status` — counts by status and the deliveries that failed or are waiting to retry, with
  their error code. No names or addresses are printed.
- `npm run email:retry -- --delivery <id>` — one immediate attempt for that delivery.
- `npm run email:retry -- --all-failed` — one immediate attempt for each failed delivery (for example after
  fixing the SMTP settings or the network).

These commands run only on the laptop (there is no web page for them) and use the same `.env`.

Microsoft Graph (Microsoft 365) sending is not available: it needs an organizational app registration and
admin consent. The code is structured so a Graph provider can be added later.

## Accessibility, performance and device testing

- `tests/e2e/accessibility.spec.ts` runs axe-core (WCAG 2.2 AA) on every screen and dialog, plus keyboard,
  focus, form-error and language checks.
- `tests/e2e/kiosk-device.spec.ts` checks the kiosk-device behavior (zoom, gestures, selection, rotation)
  and the performance budgets: first-load JavaScript, no third-party requests.
- Both run with the rest of the E2E suite (`npx playwright test`).
- Asset size budgets are part of `npm run content:check`. Replacement scene art should be exported at
  1200 × 1500 as WebP, AVIF or SVG, under 1 MB per file.
- Before each event, go through [MANUAL_KIOSK_TEST.md](./MANUAL_KIOSK_TEST.md) on the real touchscreen:
  browser settings, touch and gestures, TalkBack, reset and privacy, network drop and recovery.

## Privacy and security

- **What is collected, where it goes, and what still needs approval:** see [PRIVACY_REVIEW.md](./PRIVACY_REVIEW.md).
  Items marked [Linde Security], [Linde Privacy], [Linde Legal], [Linde Marketing] or [Linde IT] must be
  approved before real visitor data is collected.
- The kiosk sends nothing to third parties (no analytics, fonts or CDNs) and stores nothing in the tablet's
  browser. Contact details exist only on the laptop (database, backups, exports) and in the report email.
- The server answers only to local names and private network addresses; add others in `ALLOWED_HOSTS`.
- Before an event, run `npm run build && npm run security:bundle` and `npm run security:audit`.

## Local administration (optional)

A small admin area on the laptop lets the event team see lead counts, filter leads, open a lead's
business contact details, interests and email status, retry a failed email, mark leads as exported,
download CSV exports (leads, interests, content validation) and a database backup, review content still
pending Puerto Rico validation, and run the **sales validation** of every role, challenge, solution and
digital asset ("Validación de ventas", with a CSV worksheet; see
[SALES_VALIDATION_GUIDE.md](./SALES_VALIDATION_GUIDE.md)). There is no delete function.

> **This is simple MVP protection, not enterprise authentication.** It uses one passphrase and an
> in-memory sign-in. A production deployment requires approved authentication and a security review.

1. Create the passphrase hash (the passphrase is typed twice and never shown or stored):

   ```bash
   npm run admin:passphrase
   ```

2. In `.env`, set (dummy values shown):

   ```dotenv
   ADMIN_ENABLED=true
   ADMIN_PATH=/gestion-equipo
   ADMIN_PASSPHRASE_HASH=scrypt:32768:8:1:…:…   # the line printed in step 1
   ```

3. Restart the server and open `http://localhost:3000/gestion-equipo` on the laptop. The path is not linked
   anywhere in the kiosk; choose your own and share it only with the admin.

Good practice:

- Keep `ADMIN_ENABLED=false` at the event unless someone needs the admin area.
- Sign out when done ("Cerrar sesión"); the sign-in also expires after 30 minutes without activity
  (`ADMIN_SESSION_MINUTES`) and whenever the server restarts.
- Every export and backup asks for confirmation. The files contain personal data: keep them on
  encrypted storage, share them only through the approved channel and delete local copies after use.
- Five wrong passphrases in a row lock sign-in for a minute (longer after further failures).

## Configuration

- Environment variables: see [`.env.example`](./.env.example) (names only, no secrets). They are
  validated at startup; an invalid value stops the server with a message naming the variable.
- App settings: `src/lib/config/app-config.ts`. Branding (placeholder values, no logos):
  `src/lib/config/brand-config.ts`.
- UI text: `src/data/i18n/es.ts` (source) and `en.ts`. Content text: `content/` (see CONTENT_VALIDATION.md).

## Editing content

Content lives in `content/` as JSON. Spanish and English are required for every visitor-facing string.
All sample solutions are **demonstrative assumptions pending Puerto Rico validation**. Run
`npm run content:check` and `npm run content:export` after every edit.

The Puerto Rico sales team reviews `exports/sales-validation.csv` (or the admin page "Validación de
ventas") following [SALES_VALIDATION_GUIDE.md](./SALES_VALIDATION_GUIDE.md). Their answers are recorded in
each item's `salesReview`. **Production mode shows only content that is validated and approved by sales**,
and collects no leads until the consent text and report copy are validated (ADR-060).
`npm run content:check -- --mode production` lists what is still missing.
