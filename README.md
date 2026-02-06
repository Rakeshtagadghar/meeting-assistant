# AINotes

AI-powered meeting notes app. Desktop-first meeting capture, web-first notes management.

## What it does

- **Rich note-taking** with TipTap editor, tags, pins, and autosave
- **Live meeting transcription** via desktop app (Whisper.cpp / Cloudflare Workers AI)
- **AI summaries** — key points, action items, decisions, and risks extracted from your notes
- **Privacy-first** — notes are private by default, no audio stored unless you opt in, local AI processing preferred
- **Restricted sharing** — share notes with specific email addresses, with expiration and revocation

## Tech stack

| Layer        | Technology                                                               |
| ------------ | ------------------------------------------------------------------------ |
| Monorepo     | pnpm + Turborepo                                                         |
| Web          | Next.js 16, Tailwind CSS v4, React 19                                    |
| Desktop      | Tauri (TypeScript + Rust)                                                |
| Domain logic | Pure TypeScript (packages/core)                                          |
| AI           | Whisper.cpp (ASR), extractive summarizer, Cloudflare Workers AI fallback |
| Database     | Supabase Postgres (free tier)                                            |
| Auth         | NextAuth (Google OAuth)                                                  |
| Testing      | Vitest, React Testing Library, Playwright                                |
| CI           | GitHub Actions                                                           |

## Project structure

```
apps/
  web/          — Next.js 16 web app (App Router, SSR/SSG)
  desktop/      — Tauri desktop app (meeting capture)
packages/
  core/         — Domain types, entities, pure business logic
  ui/           — Shared React components (Tailwind CSS)
  api/          — API client + contracts
  ai/           — AI providers + summarizers
  config/       — Shared tsconfig, ESLint, Prettier configs
requirements/
  initial.json  — Core product requirements
  seo.json      — SEO, GDPR, CMP requirements
```

## Prerequisites

- Node.js >= 20.9.0
- pnpm 9.15.4+

## Getting started

```bash
# Install dependencies
pnpm install

# Run all checks
pnpm lint && pnpm typecheck && pnpm test

# Start development server
pnpm dev
```

## Scripts

| Command             | Description                        |
| ------------------- | ---------------------------------- |
| `pnpm dev`          | Start all apps in development mode |
| `pnpm build`        | Build all packages and apps        |
| `pnpm lint`         | Lint all packages                  |
| `pnpm typecheck`    | Type-check all packages            |
| `pnpm test`         | Run unit tests across all packages |
| `pnpm test:e2e`     | Run Playwright E2E tests           |
| `pnpm format`       | Format all files with Prettier     |
| `pnpm format:check` | Check formatting                   |

## Architecture

**Functional core, imperative shell.** All domain logic in `packages/core` is pure functions with no I/O or side effects. Entities use branded types (`UUID`, `ISODateString`) for compile-time safety at zero runtime cost.

**Strict TDD.** Tests are written before implementation. Coverage thresholds: 85% statements, 75% branches, 85% functions, 85% lines.

**TypeScript strict mode.** No `any`, `noUncheckedIndexedAccess` enabled, `readonly` on all entity fields.

## Domain layer (packages/core)

Pure functions for all business logic:

- **Notes** — create, update, soft-delete, restore, serialize, tag management, pin/unpin
- **Share links** — permission checks, expiration, email-restricted access
- **AI summaries** — payload validation for 5 summary kinds (summary, action items, decisions, risks, key points)
- **Transcripts** — chunk sorting, merging adjacent same-speaker chunks, time-range filtering

## Implementation roadmap

1. Repo bootstrap + quality gate
2. Domain layer (packages/core) with TDD
3. DB + API endpoints with integration tests
4. Web UI critical flows with component tests
5. AI summarize endpoint with provider mocks
6. Desktop meeting HUD with smoke tests
7. E2E tests for MVP flows

## License

Private — all rights reserved.
