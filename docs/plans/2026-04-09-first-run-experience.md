# First-Run Experience Implementation Plan

Created: 2026-04-09
Status: VERIFIED
Approved: Yes
Iterations: 0
Worktree: No
Type: Feature

## Summary

**Goal:** Streamline the first-run experience: simplify the setup wizard (drop DB step, add live build progress), auto-build the vanilla source after admin account creation, add Start/Stop/Restart controls to the dashboard realm tabs, and document .env configuration in a README.

**Architecture:** The setup wizard becomes Welcome -> Account -> Building (live progress). On account creation, the API triggers a background build of the first seeded source. The setup page shows live build logs until completion, then redirects to login. The dashboard gets realm control buttons that call the existing start/stop/restart API routes.

**Tech Stack:** TypeScript, Next.js, React (inline styles), existing Docker/build pipeline APIs

## Scope

### In Scope

- Simplify setup wizard: remove DB check step, add live build progress step
- Auto-build first seeded source after admin account creation
- Dashboard Start/Stop/Restart buttons per active realm tab
- README.md with .env configuration documentation
- Update .env.example with clear comments about password security

### Out of Scope

- DB password change via UI after initial setup (handled by .env before first docker compose up)
- Build progress notifications/websockets (existing polling pattern is sufficient)
- Realm creation from dashboard (existing /realms page handles this)

## Approach

**Chosen:** Extend existing setup wizard and dashboard with minimal new API surface

**Why:** Reuses existing build pipeline (`startBuild`), build polling (`/api/builds/live/{sourceId}`), and realm control APIs (`/api/realms/{id}/start|stop|restart`). No new backend infrastructure needed — just UI changes and one small API extension for auto-build.

**Alternatives considered:**
- WebSocket-based build progress — rejected: polling already works well, adds complexity
- Separate "getting started" wizard post-login — rejected: user wants builds to start during setup, not after

## Context for Implementer

> Write for an implementer who has never seen the codebase.

- **Patterns to follow:**
  - Setup wizard: `src/app/setup/page.tsx` — single-page React component with step state machine
  - Build polling: `src/app/builds/page.tsx:66-104` — polls `/api/builds/live/{sourceId}` every 2s during active builds
  - Dashboard: `src/app/dashboard/page.tsx` — realm tabs with `activeRealmId` state, `RealmTabContent` component
  - Realm status: `src/app/api/realms/status/route.ts` — returns online/offline per realm
  - Existing start/stop/restart API routes at `src/app/api/realms/[realmId]/{start,stop,restart}/route.ts`
- **Conventions:** Inline styles with CSS variables (`var(--accent)`, `var(--bg-card)`, etc.). Toast component for feedback. `requireAdmin()` auth guard on API routes.
- **Key files:**
  - `src/app/setup/page.tsx` — setup wizard UI (248 lines)
  - `src/app/api/setup/complete/route.ts` — creates admin account, marks setup done (105 lines)
  - `src/app/dashboard/page.tsx` — dashboard with realm tabs (435 lines)
  - `src/app/api/builds/route.ts` — POST triggers build (39 lines, requires admin auth)
  - `src/app/api/builds/live/[sourceId]/route.ts` — GET returns live build log
  - `src/app/api/realms/[realmId]/start/route.ts` — POST starts a realm
  - `src/app/api/realms/[realmId]/stop/route.ts` — POST stops a realm
  - `src/app/api/realms/[realmId]/restart/route.ts` — POST restarts a realm
  - `src/lib/build-pipeline.ts` — `startBuild()` function
  - `src/lib/build-state.ts` — `isSourceBuilding()`, `getBuildLog()`
  - `.env` / `.env.example` — environment configuration
- **Gotchas:**
  - The POST /api/builds route requires admin auth (`requireAdmin()`). The setup/complete endpoint doesn't set a session — the auto-build must be triggered server-side, not via client fetch to /api/builds
  - `startBuild()` is fire-and-forget (async, runs in background) — call it directly from the setup/complete route
  - The setup page is public (no auth) — the build progress polling needs to work without auth OR use a public status endpoint
  - Dashboard fetches realm status every 15s — realm control buttons should use optimistic UI + immediate re-fetch
  - The `realmStatus` data includes `online` boolean per realm — use this to determine which buttons to show (Start when offline, Stop/Restart when online)

## Runtime Environment

- **Start:** `docker compose up -d`
- **Port:** 5555 (webui)
- **Health:** `curl http://localhost:5555/api/server-info`
- **Rebuild:** `docker compose up -d --build ac-webui`

## Assumptions

- The setup/complete route can import and call `startBuild()` directly without auth — it runs server-side. Supported by: `startBuild` is a plain async function in `build-pipeline.ts`. Tasks 2, 3 depend on this.
- The `/api/builds/live/{sourceId}` endpoint returns build log lines without auth for the setup page to poll. Supported by: need to verify — if it requires admin, we need a public build-status endpoint. Task 3 depends on this.
- The dashboard's `realmStatus` data reliably reflects whether a worldserver container is running. Supported by: `src/app/api/realms/status/route.ts` does TCP checks. Task 4 depends on this.

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Build polling from unauthenticated setup page blocked by auth middleware | High | High | Add `/api/setup/build-status` as a public endpoint (only works during setup) |
| Auto-build fails silently after setup | Medium | Medium | Show build log on setup page; user sees errors in real-time |
| Start/Stop buttons clicked rapidly cause race conditions | Low | Low | Disable buttons during pending operations; re-fetch status after action |

## Goal Verification

### Truths

1. Fresh install: setup wizard shows Welcome -> Account -> Building (no DB step)
2. After admin account creation, the vanilla source build starts automatically
3. Setup page shows live build progress with scrolling log
4. After build completes, setup page directs user to login
5. Dashboard shows Start button for offline realms and Stop/Restart for online realms
6. Clicking Start/Stop/Restart on dashboard calls the correct API and updates status
7. README.md exists with clear .env configuration instructions

### Artifacts

- `src/app/setup/page.tsx` — simplified wizard with build progress step
- `src/app/api/setup/complete/route.ts` — triggers auto-build after account creation
- `src/app/api/setup/build-status/route.ts` — public build status endpoint for setup page
- `src/app/dashboard/page.tsx` — realm controls in tab header
- `README.md` — project documentation with .env setup

## Progress Tracking

- [x] Task 1: Simplify setup wizard (remove DB step, add building step)
- [x] Task 2: Auto-build on setup completion (server-side trigger)
- [x] Task 3: Public build status endpoint for setup page
- [x] Task 4: Dashboard realm Start/Stop/Restart controls
- [x] Task 5: README.md with .env documentation

**Total Tasks:** 5 | **Completed:** 5 | **Remaining:** 0

## Implementation Tasks

### Task 1: Simplify Setup Wizard UI

**Objective:** Remove the database check step from the setup wizard and add a "Building" step that shows live build progress after account creation.

**Dependencies:** Task 2 (auto-build trigger), Task 3 (build status endpoint)

**Files:**

- Modify: `src/app/setup/page.tsx`

**Key Decisions / Notes:**

- Change step type from `"welcome" | "database" | "account" | "done"` to `"welcome" | "account" | "building" | "done"`
- Remove the entire `step === "database"` block (lines 142-184)
- Update step indicator to show 4 steps: welcome, account, building, done
- Welcome step's "Get Started" button goes directly to "account" (not "database")
- After successful account creation (`res.ok`), transition to "building" step (not "done")
- "Building" step: poll `/api/setup/build-status` every 2s, show scrolling log area (reuse pattern from `builds/page.tsx:518-531`), show progress message
- When build completes (status becomes "idle" or "success"), show "Build Complete" message and transition to "done" step
- If build fails, show error but still allow proceeding to login (builds can be retried from the Builds page)
- "Done" step: show success message with login button

**Definition of Done:**

- [ ] Setup wizard has no "Database" step
- [ ] "Building" step shows live build log
- [ ] Build completion transitions to "Done"
- [ ] `bun tsc --noEmit` passes

**Verify:**

- `bun tsc --noEmit`

---

### Task 2: Auto-Build on Setup Completion

**Objective:** When the admin account is created during setup, automatically trigger a build of the first seeded source.

**Dependencies:** None

**Files:**

- Modify: `src/app/api/setup/complete/route.ts`

**Key Decisions / Notes:**

- After marking setup complete (line 93-98), import and call `startBuild()` directly:
  ```typescript
  const { getAllSources } = await import("@/lib/build-sources-db");
  const { startBuild } = await import("@/lib/build-pipeline");
  const sources = await getAllSources();
  if (sources.length > 0) {
    startBuild(sources[0].sourceId).catch(console.error);
  }
  ```
- This runs server-side — no auth needed (setup/complete is already a privileged endpoint)
- `startBuild` is fire-and-forget — it runs in the background
- Return the `sourceId` being built in the response so the setup page knows what to poll:
  ```json
  { "success": true, "username": "ADMIN", "buildSourceId": "azerothcore-vanilla" }
  ```

**Definition of Done:**

- [ ] Setup completion triggers build of first seeded source
- [ ] Build starts asynchronously (doesn't block the response)
- [ ] Response includes `buildSourceId` for the client to poll
- [ ] `bun tsc --noEmit` passes

**Verify:**

- `bun tsc --noEmit`

---

### Task 3: Public Build Status Endpoint

**Objective:** Create a public endpoint that returns build status during setup, so the unauthenticated setup page can poll build progress.

**Dependencies:** None

**Files:**

- Create: `src/app/api/setup/build-status/route.ts`

**Key Decisions / Notes:**

- GET `/api/setup/build-status?sourceId=xxx` — returns build log and status
- Only works when setup is not yet complete OR was just completed (check `setup_complete` setting)
- Uses `getBuildLog()` from `build-state.ts` and `isSourceBuilding()` from `build-state.ts`
- Response: `{ building: boolean, status: string, log: string[] }`
- Add `/api/setup/build-status` to the `PUBLIC_PATHS` array in `src/middleware.ts` so it bypasses auth
- After setup is fully complete and first login happens, this endpoint returns 403

**Definition of Done:**

- [ ] Endpoint returns build log and status without auth
- [ ] Added to PUBLIC_PATHS in middleware
- [ ] Returns 403 after setup is complete and user has logged in
- [ ] `bun tsc --noEmit` passes

**Verify:**

- `bun tsc --noEmit`

---

### Task 4: Dashboard Realm Start/Stop/Restart Controls

**Objective:** Add Start/Stop/Restart buttons to the dashboard realm tab header area, showing appropriate buttons based on realm online status.

**Dependencies:** None

**Files:**

- Modify: `src/app/dashboard/page.tsx`

**Key Decisions / Notes:**

- Add controls between the realm tab bar and `RealmTabContent`
- Show in a row next to the realm name area:
  - When realm is **offline**: "Start" button (green accent)
  - When realm is **online**: "Stop" button (muted) + "Restart" button (muted)
  - When **action pending**: show spinner, disable all buttons
- Use `realmStatus?.realms?.find(x => x.id === activeRealmId)?.online` for status
- API calls: `POST /api/realms/{id}/start`, `POST /api/realms/{id}/stop`, `POST /api/realms/{id}/restart`
- Add state: `const [realmAction, setRealmAction] = useState<string | null>(null)` for pending state
- After action completes, immediately re-fetch status (`fetchStatus()`)
- Need admin check — use the existing `user.gmlevel` from the session. But the dashboard doesn't have access to user info — it's in the layout. Check if we need to fetch it or pass it.
  - Actually, the NavBar already gets user info. The dashboard page can check admin via the /api/auth/me endpoint, or simpler: just call the API — it returns 403 if not admin, show the error.
  - Simplest: always show the buttons, API returns 403 if not admin. Non-admins rarely see the dashboard anyway (redirected to /my).
- Use Toast component for success/error feedback (import it)

**Definition of Done:**

- [ ] Start button shown for offline realms
- [ ] Stop + Restart buttons shown for online realms
- [ ] Clicking Start calls POST /api/realms/{id}/start
- [ ] Clicking Stop calls POST /api/realms/{id}/stop
- [ ] Clicking Restart calls POST /api/realms/{id}/restart
- [ ] Buttons disabled during pending action
- [ ] Status refreshes after action
- [ ] `bun tsc --noEmit` passes

**Verify:**

- `bun tsc --noEmit`

---

### Task 5: README.md with .env Documentation

**Objective:** Create a README.md documenting how to configure and start RealmManager, with emphasis on .env setup before first docker compose up.

**Dependencies:** None

**Files:**

- Create: `README.md`

**Key Decisions / Notes:**

- Sections:
  1. Overview — what RealmManager is
  2. Quick Start — the 3-step process:
     - Copy `.env.example` to `.env`
     - Edit `.env` — set `DOCKER_DB_ROOT_PASSWORD` and `WEBUI_SECRET_KEY`
     - `docker compose up -d`
  3. Configuration — full .env reference table
  4. First-Run Setup — what happens when you first visit the UI (setup wizard creates admin account, auto-builds vanilla source)
  5. Managing Realms — brief overview of build sources, building, creating realms
  6. Source Manifests — link to `docs/manifests.md`
  7. Development — how to run locally outside Docker
- Keep it concise — link to `docs/manifests.md` for manifest details
- Highlight security: "Change DOCKER_DB_ROOT_PASSWORD and WEBUI_SECRET_KEY before running in production"

**Definition of Done:**

- [ ] README.md covers .env configuration with security warnings
- [ ] Quick start section is clear and actionable
- [ ] Links to docs/manifests.md for manifest details
- [ ] Markdown renders correctly

**Verify:**

- Manual review

---

## Open Questions

1. Should the build status endpoint allow polling even after the first login, or strictly only during setup? (Plan says: allow during setup period only, return 403 after)

## Deferred Ideas

- Build progress WebSocket for real-time updates without polling
- Post-build auto-create a realm from the built source
- Dashboard build status indicator (show when a build is in progress)
