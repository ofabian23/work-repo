# Linde Sphere

Interactive healthcare discovery experience for a portrait touchscreen kiosk at a healthcare convention
in Puerto Rico (internal codename _Mockup Vision_).

**Status:** content model implemented (Phase 2). Kiosk screens are not built yet.

## Documentation

| Document                                         | Purpose                                                      |
| ------------------------------------------------ | ------------------------------------------------------------ |
| [PROJECT_BRIEF.md](./PROJECT_BRIEF.md)           | Scope, journey, MVP boundaries, acceptance criteria          |
| [ARCHITECTURE.md](./ARCHITECTURE.md)             | Stack, content model, engine, data model, privacy boundaries |
| [DECISIONS.md](./DECISIONS.md)                   | Architecture decision records                                |
| [TASKS.md](./TASKS.md)                           | Phased implementation plan and progress                      |
| [CONTENT_VALIDATION.md](./CONTENT_VALIDATION.md) | Content statuses, visibility rules, validation workflow      |

## Quick start

Requires Node.js 22 LTS (≥ 20.9).

```bash
npm install
npm run check            # content check + lint + typecheck + format check + unit tests
npm run dev              # http://localhost:3000
```

## Scripts

| Script                                       | What it does                                               |
| -------------------------------------------- | ---------------------------------------------------------- |
| `npm run content:check`                      | Validate every file in `content/` (exit 1 on errors)       |
| `npm run content:check -- --mode production` | Also enforce production readiness (only validated content) |
| `npm run content:check -- --strict`          | Treat warnings as errors                                   |
| `npm run test` / `npm run test:watch`        | Vitest unit tests                                          |
| `npm run lint`                               | ESLint (zero warnings allowed)                             |
| `npm run typecheck`                          | Generate Next route types, then `tsc --noEmit`             |
| `npm run format` / `npm run format:check`    | Prettier                                                   |
| `npm run build`                              | Production build                                           |

## Editing content

Content lives in `content/` as JSON (Spanish and English required for every visitor-facing string). All
sample solutions are **demonstrative assumptions** that require Puerto Rico sales validation. Run
`npm run content:check` after every edit. See CONTENT_VALIDATION.md for the rules.
