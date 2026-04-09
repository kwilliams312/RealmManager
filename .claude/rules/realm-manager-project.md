# Project: RealmManager

**Last Updated:** 2026-04-09

## Overview

Web-based management dashboard for AzerothCore WoW private servers. Build server images from source, create/manage multiple realms, monitor status — all from one UI. Runs as a Docker Compose stack.

## Technology Stack

- **Language:** TypeScript (strict mode)
- **Framework:** Next.js 15 (App Router, standalone output)
- **Runtime:** Node.js 22
- **UI:** React 19 (no component library — custom CSS in `globals.css`)
- **Database:** MySQL 8.4 via `mysql2` (raw queries, no ORM)
- **Auth:** iron-session (cookie-based sessions, SRP6 password hashing)
- **Editor:** CodeMirror (YAML manifest editing)
- **Package Manager:** Bun (`bun.lock`)
- **Deployment:** Docker Compose (multi-stage Dockerfile)

## Directory Structure

```
src/
  app/                    # Next.js App Router pages + API routes
    api/                  # Server-side API routes
      realms/[realmId]/   # Per-realm operations (start/stop/config/console/logs)
      builds/             # Build sources and build history
      auth/               # Login/logout/register/password
      settings/           # Sources, tokens, branding, DB config
      setup/              # First-run wizard
    dashboard/            # Main overview page
    realms/               # Realm management UI
    builds/               # Build management UI
    manifests/            # YAML manifest editor
    settings/             # Settings UI
  components/             # Shared React components
    realm-tabs/           # Realm detail tab panels
    settings-tabs/        # Settings tab panels
  lib/                    # Server-side utilities
    db.ts                 # MySQL connection pool + query helpers
    auth.ts               # requireLogin() / requireAdmin() guards
    session.ts            # iron-session config + helpers
    docker.ts             # Docker CLI wrapper
    realm-compose.ts      # Per-realm docker-compose.yml generator
    build-pipeline.ts     # Source clone + Docker build orchestration
    manifest.ts           # YAML manifest parsing + validation
  hooks/                  # React hooks (useRealms, useBranding)
  types/                  # TypeScript type definitions
  data/seed/              # Seed data for first-boot source seeding
sql/                      # Database migration SQL files
data/realms/              # Runtime realm data (configs, logs)
docs/                     # Documentation
```

## Key Files

- **Entry:** `src/app/layout.tsx` (root layout with SetupGuard)
- **Middleware:** `src/middleware.ts` (auth guard for all routes)
- **DB:** `src/lib/db.ts` (pool for auth DB, per-connection for realm DBs)
- **Config:** `.env` (env vars), `src/lib/settings.ts` (JSON file with env fallbacks)
- **Docker:** `docker-compose.yml`, `Dockerfile`, `src/lib/realm-compose.ts`
- **Types:** `src/types/realm.ts` (Realm, BuildSource, GlobalBuild, etc.)
- **Manifests:** `docs/manifests.md` (full manifest schema reference)

## Development Commands

| Task | Command |
|------|---------|
| Install deps | `bun install` |
| Dev server | `bun dev` (port 5555) |
| Build | `bun run build` |
| Type check | `bun tsc --noEmit` |
| Lint | `bun run lint` |
| Docker up | `docker compose up -d` |
| Docker rebuild | `docker compose up -d --build ac-webui` |
| Full reset | `make reset` |
| Logs | `make logs` (webui), `make logs-db`, `make logs-auth` |
| Status | `make status` |

## Architecture Notes

- **Auth pattern:** API routes use `requireLogin()` / `requireAdmin()` from `src/lib/auth.ts`. Admin = gmlevel >= 3. Super-admin = username "ADMIN".
- **DB access:** Auth DB uses a shared connection pool. Per-realm DBs (`acore_world_N`, `acore_characters_N`) use temporary connections via `queryDb()` / `executeDb()`.
- **Realm containers:** Each realm runs as separate Docker containers (`ac-worldserver-N`, `ac-db-import-N`). Compose files are generated dynamically in `src/lib/realm-compose.ts`.
- **Docker socket:** WebUI container mounts `/var/run/docker.sock` to manage realm containers.
- **Port mapping:** World: 8085+N-1, RA: 3443+N-1, SOAP: 7878+N-1 per realm.
- **Manifests:** YAML build recipes for AzerothCore forks. Support modules, extra databases, env vars, build steps. Placeholders (`{realmId}`, `{dbHost}`, etc.) resolved at realm start.
- **Settings priority:** `settings.json` > env vars > defaults.
- **Path alias:** `@/*` maps to `./src/*`.
- **No test suite currently.**
