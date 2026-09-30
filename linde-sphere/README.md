# Linde Sphere

Interactive healthcare discovery experience for a portrait touchscreen kiosk at a healthcare convention
in Puerto Rico (internal codename _Mockup Vision_).

**Status:** foundation, content model, convention seed content, recommendation engine, touchscreen design
system and the kiosk shell (attract → welcome, session store, inactivity reset) are implemented (Phases 1–4).
The three entry paths open placeholder screens until Phases 5–6. See [TASKS.md](./TASKS.md).

## Documentation

| Document                                         | Purpose                                                     |
| ------------------------------------------------ | ----------------------------------------------------------- |
| [PROJECT_BRIEF.md](./PROJECT_BRIEF.md)           | Scope, journey, MVP boundaries, acceptance criteria         |
| [ARCHITECTURE.md](./ARCHITECTURE.md)             | Stack, structure, content model, engine, privacy boundaries |
| [DECISIONS.md](./DECISIONS.md)                   | Architecture decision records                               |
| [TASKS.md](./TASKS.md)                           | Phased implementation plan and progress                     |
| [CONTENT_VALIDATION.md](./CONTENT_VALIDATION.md) | Content statuses, visibility rules, validation workflow     |

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

| Command                                      | What it does                                                              |
| -------------------------------------------- | ------------------------------------------------------------------------- |
| `npm run dev`                                | Development server on **this computer only** (`localhost:3000`)           |
| `npm run dev:network`                        | Development server reachable from **other devices** on the network        |
| `npm run build`                              | Production build                                                          |
| `npm run start`                              | Serve the production build on this computer only (`localhost:3000`)       |
| `npm run start:network`                      | Serve the production build to the network (kiosk use)                     |
| `npm run lint`                               | ESLint (zero warnings allowed)                                            |
| `npm run typecheck`                          | Generate Next.js route types, then `tsc --noEmit`                         |
| `npm run test`                               | Unit tests (Vitest)                                                       |
| `npm run test:e2e`                           | End-to-end tests (Playwright) at kiosk, laptop and phone sizes            |
| `npm run content:check`                      | Validate every file in `content/` (exit code 1 on errors)                 |
| `npm run content:check -- --mode production` | Also require production readiness (validated content only)                |
| `npm run content:export`                     | Regenerate the sales CSV (`exports/`) and CONTENT_VALIDATION.md §11       |
| `npm run check`                              | content check + export freshness + lint + typecheck + format + unit tests |
| `npm run format`                             | Format all files with Prettier                                            |
| `npm run db:deploy`                          | Apply database migrations (creates `data/linde-sphere.db` if missing)     |
| `npm run db:migrate`                         | Development only: create a new migration after editing the schema         |
| `npm run db:seed`                            | Development only: add two synthetic leads (refuses `NODE_ENV=production`) |
| `npm run db:backup`                          | Consistent backup of the database to `data/backups/`                      |
| `npm run db:export`                          | Export leads to CSV in `data/exports/` (contains personal data)           |

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
- The first time, Windows Defender Firewall may ask whether Node.js can accept connections. Allow it on
  **Private networks only**, or add an inbound rule for TCP port 3000 on the Private profile.
- `npm run dev:network` also works for testing on the kiosk. The dev server accepts hot-reload
  connections from private LAN addresses (192.168.x.x, 10.x.x.x, 172.x.x.x). Add other hostnames with
  `DEV_ALLOWED_ORIGINS` in `.env`. At the event, always use `build` + `start:network`.

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
- Do not copy `linde-sphere.db` by hand while the server runs: recent writes may still be in the
  `-wal` file. Stop the server first, or use `db:backup`.
- Suggested event routine: back up at the end of each event day and before any update, to an
  **encrypted** USB drive or approved company storage. Keep at least the last two backups.
- Restore: stop the server, replace `data/linde-sphere.db` with the backup file (delete any
  `linde-sphere.db-wal` / `-shm` files next to it), run `npm run db:deploy`, then start the server.

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

## Configuration

- Environment variables: see [`.env.example`](./.env.example) (names only, no secrets). They are
  validated at startup; an invalid value stops the server with a message naming the variable.
- App settings: `src/lib/config/app-config.ts`. Branding (placeholder values, no logos):
  `src/lib/config/brand-config.ts`.
- UI text: `src/data/i18n/es.ts` (source) and `en.ts`. Content text: `content/` (see CONTENT_VALIDATION.md).

## Editing content

Content lives in `content/` as JSON. Spanish and English are required for every visitor-facing string.
All sample solutions are **demonstrative assumptions pending Puerto Rico validation**. Run
`npm run content:check` and `npm run content:export` after every edit. The sales team reviews
`exports/content-validation.csv` or CONTENT_VALIDATION.md §11.
