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
npm install
cp .env.example .env        # Windows PowerShell: Copy-Item .env.example .env
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

## Component gallery (development only)

`npm run dev` → <http://localhost:3000/dev/components> shows every design-system component with real
content, live recommendations, and both languages (use the header toggle). Production builds answer 404 at
that URL unless `ENABLE_COMPONENT_GALLERY=true` is set in `.env`. Keep it off at the event.

## Health check

`GET /api/health` returns JSON with the application version, content mode, configuration validity (by
variable name only), content validity and database readiness. It is never cached and contains no secrets.

- `status: "ok"`: everything ready.
- `status: "degraded"`: serving, but not every dependency is ready. This is expected until the database
  is created in Phase 7 (`database.status: "not_initialized"`).
- `status: "error"` (HTTP 503): invalid configuration or content, or an unreadable database.

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
