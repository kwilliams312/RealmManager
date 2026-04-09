# Source Manifests Implementation Plan

Created: 2026-04-09
Status: VERIFIED
Approved: Yes
Iterations: 1
Worktree: No
Type: Feature

## Summary

**Goal:** Build a YAML manifest system (like Helm charts) for AzerothCore source configurations. Each source declares its full installation recipe — extra databases, environment variables, module repos to clone, and pre/post-build steps — so any fork works out of the box.

**Architecture:** A `realmmanager.yaml` manifest defines everything needed to build and run a source. Manifests ship as bundled presets (vanilla, playerbots) and can be auto-detected from the repo root during builds. The manifest is stored as a JSON column on `build_sources` and parsed by the build pipeline, compose generator, and start route. A YAML editor in the UI allows full customization.

**Tech Stack:** TypeScript, Next.js, MySQL, `js-yaml` for YAML parsing, CodeMirror or textarea for YAML editing

## Scope

### In Scope

- YAML manifest schema with: metadata, build config, modules, databases, environment, paths, steps
- Bundled presets for vanilla AzerothCore and mod-playerbots
- Auto-detection: if repo contains `realmmanager.yaml`, use it during build
- Build pipeline: module cloning, submodule init, pre/post-build steps
- Realm compose: extra databases, extra env vars from manifest
- Start route: extra database creation
- Manifest editor UI page
- User documentation (`docs/manifests.md`)

### Out of Scope

- Manifest marketplace / remote manifest registry
- Auto-detection of manifest requirements from Dockerfile analysis
- MySQL tuning from manifests (my.cnf changes)
- Manifest versioning / migration between schema versions

## Approach

**Chosen:** YAML manifests stored as JSON in `build_sources.source_manifest` column

**Why:** YAML is human-readable and familiar from Helm/Docker. Storing as JSON in the DB avoids filesystem state management. Presets provide starting points. Auto-detection from repo root means forks can ship their own manifest.

**Alternatives considered:**
- JSON column without YAML layer — rejected: YAML is more readable for users editing manifests
- Separate files on disk — rejected: complicates backup, multi-instance, and Docker volume management
- Separate `source_manifests` table — rejected: 1:1 relationship with sources, no reuse benefit

## Manifest Schema

```yaml
apiVersion: v1
kind: RealmSource
metadata:
  name: mod-playerbots
  description: AzerothCore with Playerbots module

build:
  dockerfile: apps/docker/Dockerfile
  targets:
    worldserver: worldserver
    dbImport: db-import
  submodules: true
  args:
    CTYPE: RelWithDebInfo

# Extra repos to clone into the source tree before building
modules:
  - name: mod-playerbots
    url: https://github.com/mod-playerbots/mod-playerbots.git
    path: modules/mod-playerbots
    branch: main

# Extra databases created per realm (becomes acore_{name}_{realmId})
databases:
  - name: playerbots

# Extra environment variables injected into containers
environment:
  worldserver:
    AC_PLAYERBOTS_DATABASE_INFO: "{dbHost};{dbPort};root;{dbPass};acore_playerbots_{realmId}"
  dbImport:
    AC_PLAYERBOTS_DATABASE_INFO: "{dbHost};{dbPort};root;{dbPass};acore_playerbots_{realmId}"

# Container paths (defaults shown — only override if the fork uses different paths)
paths:
  config: /azerothcore/env/dist/etc
  refConfig: /azerothcore/env/ref/etc
  data: /azerothcore/env/dist/data
  logs: /azerothcore/env/dist/logs

# Shell commands run at specific lifecycle points
steps:
  preBuild:
    - run: echo "Starting build"
  postBuild:
    - run: echo "Build complete"
  postImport:
    - run: echo "DB import complete"
```

### Placeholder Variables

Env var values and step commands support these placeholders, resolved at compose generation or execution time:

| Placeholder | Resolves to |
|---|---|
| `{realmId}` | Realm numeric ID |
| `{dbHost}` | Database host (e.g., `ac-database`) |
| `{dbPort}` | Database port (e.g., `3306`) |
| `{dbPass}` | Database root password |
| `{sourceId}` | Source slug identifier |

## Context for Implementer

> Write for an implementer who has never seen the codebase.

- **Patterns to follow:** The `build_sources` table uses ALTER TABLE for schema evolution (`src/lib/build-sources-db.ts:33-68`). JSON columns use the `build_args` parse pattern (line 162-163). API routes use `requireAdmin()` guard.
- **Conventions:** DB layer returns `Row` types, converted to camelCase via `rowToSource()`. UI uses inline styles with CSS variables. Pages live under `src/app/{name}/page.tsx` with a `layout.tsx` for auth guards.
- **Key files:**
  - `src/lib/build-sources-db.ts` — source CRUD, `BuildSource` interface
  - `src/lib/realm-compose.ts` — generates per-realm docker-compose.yml
  - `src/lib/build-pipeline.ts` — git clone + Docker build
  - `src/app/api/realms/[realmId]/start/route.ts` — realm start (DB creation, compose regen)
  - `src/app/api/builds/sources/route.ts` — source create API
  - `src/app/api/builds/sources/[sourceId]/route.ts` — source update/delete API
  - `src/app/builds/page.tsx` — builds UI (537 lines)
  - `src/types/realm.ts` — client-side types
  - `src/lib/db-realm.ts` — per-realm DB naming
  - `src/components/NavBar.tsx` — sidebar navigation (line 224: builds link)
- **Gotchas:**
  - `ensureTable()` runs ALTER TABLE idempotently — errors silently caught
  - Build pipeline runs inside `ac-webui` Docker container with Docker socket access
  - `REALM_HOST_DIR` (host paths for bind mounts) vs `REALM_DATA_DIR` (container-internal paths)
  - `generateRealmCompose()` has 3 call sites: start route, realm create route, realm update route
  - The db-import handles module SQL via `COPY modules modules` in Dockerfile — modules must be present in the checkout before Docker build

## Runtime Environment

- **Start:** `docker compose up -d` (from project root)
- **Port:** 5555 (webui)
- **Health:** `curl http://localhost:5555/api/server-info`
- **Rebuild:** `docker compose up -d --build ac-webui`

## Assumptions

- The db-import binary handles SQL files from cloned modules when they're present in the source tree before `docker build`. Supported by: Dockerfile `COPY modules modules`. Tasks 2, 3 depend on this.
- Extra databases (like `acore_playerbots`) just need to be created empty — the db-import populates them. Supported by: mod-playerbots installation guide. Task 4 depends on this.
- `playerbots.conf.dist` is extracted alongside `worldserver.conf.dist` during config template extraction. Supported by: `build-pipeline.ts:407-419` copies all from `refConfigPath`. Task 3 depends on this.

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Invalid YAML in manifest crashes build | Medium | Medium | Validate YAML on save with clear error messages; wrap parse in try/catch during build |
| Module clone fails (network, auth) | Medium | High | Log clear error with URL; support `useToken: true` flag to inherit source's GitHub token |
| Pre/post-build steps run arbitrary shell commands | Low | High | Steps run inside the build container (not host); document security implications |
| Manifest schema changes break existing sources | Low | Medium | All fields optional with defaults; unknown fields ignored |

## Goal Verification

### Truths

1. A source with the "playerbots" preset manifest creates realms that start successfully with `acore_playerbots_N` database and `AC_PLAYERBOTS_DATABASE_INFO` in the compose
2. A source with the "vanilla" preset manifest creates realms with only standard databases
3. Editing a manifest via the YAML editor persists and affects subsequent builds/starts
4. A repo with `realmmanager.yaml` at its root gets auto-detected during build
5. Module repos declared in the manifest are cloned before Docker build
6. Pre/post-build steps execute during the build pipeline
7. User documentation explains the manifest schema and how to create custom manifests

### Artifacts

- `src/lib/manifest.ts` — manifest types, parsing, validation, presets
- `src/lib/build-sources-db.ts` — extended with `source_manifest` column
- `src/lib/build-pipeline.ts` — module cloning, step execution, auto-detection
- `src/lib/realm-compose.ts` — extra databases and env vars from manifest
- `src/lib/db-realm.ts` — extra DB naming helper
- `src/app/api/realms/[realmId]/start/route.ts` — extra DB creation
- `src/app/api/builds/sources/` — manifest in API
- `src/app/manifests/page.tsx` — manifest editor UI
- `src/types/realm.ts` — extended types
- `docs/manifests.md` — user documentation

## Progress Tracking

- [x] Task 1: Manifest types, parsing, validation, and presets
- [x] Task 2: DB layer — source_manifest column
- [x] Task 3: Build pipeline — modules, submodules, steps, auto-detect
- [x] Task 4: Realm compose and start route — extra DBs and env vars
- [x] Task 5: API — manifest in source create/update
- [x] Task 6: Manifest editor UI
- [x] Task 7: User documentation

**Total Tasks:** 7 | **Completed:** 7 | **Remaining:** 0

## Implementation Tasks

### Task 1: Manifest Types, Parsing, Validation, and Presets

**Objective:** Create the manifest module with TypeScript types, YAML parsing/serialization, schema validation, and bundled presets for vanilla and playerbots.

**Dependencies:** None

**Files:**

- Create: `src/lib/manifest.ts`

**Key Decisions / Notes:**

- Install `js-yaml` (`bun add js-yaml @types/js-yaml`)
- Define `RealmManifest` interface matching the YAML schema:

```typescript
interface RealmManifest {
  apiVersion: string;  // "v1"
  kind: string;        // "RealmSource"
  metadata: { name: string; description?: string };
  build?: {
    dockerfile?: string;
    targets?: { worldserver?: string; dbImport?: string };
    submodules?: boolean;
    args?: Record<string, string>;
  };
  modules?: Array<{
    name: string;
    url: string;
    path: string;
    branch?: string;
    useToken?: boolean;  // inherit source's GitHub token
  }>;
  databases?: Array<{ name: string }>;
  environment?: {
    worldserver?: Record<string, string>;
    dbImport?: Record<string, string>;
  };
  paths?: {
    config?: string;
    refConfig?: string;
    data?: string;
    logs?: string;
  };
  steps?: {
    preBuild?: Array<{ run: string }>;
    postBuild?: Array<{ run: string }>;
    postImport?: Array<{ run: string }>;
  };
}
```

- Export functions:
  - `parseManifest(yaml: string): RealmManifest` — parse YAML, validate required fields, return typed object
  - `serializeManifest(manifest: RealmManifest): string` — convert to YAML string
  - `validateManifest(manifest: unknown): { valid: boolean; errors: string[] }` — validate schema
  - `getPreset(name: "vanilla" | "playerbots"): RealmManifest` — return bundled preset
  - `getPresetList(): Array<{ name: string; description: string }>` — for UI dropdown
  - `resolveEnvPlaceholders(vars: Record<string, string>, context: { realmId: number; dbHost: string; dbPort: string; dbPass: string; sourceId: string }): Record<string, string>` — replace `{realmId}` etc.
  - `extraDbName(baseName: string, realmId: number): string` — returns `acore_{baseName}_{realmId}`

- Vanilla preset: minimal — no modules, no extra databases, no extra env vars, submodules false
- Playerbots preset: full — modules section with mod-playerbots, playerbots database, `AC_PLAYERBOTS_DATABASE_INFO` env var, submodules true, correct paths

**Definition of Done:**

- [ ] `RealmManifest` interface covers full schema
- [ ] YAML parse/serialize roundtrips correctly
- [ ] Validation catches missing apiVersion, invalid structure
- [ ] Vanilla and playerbots presets are correct
- [ ] Placeholder resolution works for all supported placeholders
- [ ] `bun tsc --noEmit` passes

**Verify:**

- `bun tsc --noEmit`

---

### Task 2: DB Layer — source_manifest Column

**Objective:** Add `source_manifest` JSON column to `build_sources` and wire it through the row mapping, interfaces, and CRUD functions.

**Dependencies:** Task 1

**Files:**

- Modify: `src/lib/build-sources-db.ts`
- Modify: `src/types/realm.ts`

**Key Decisions / Notes:**

- Add column via ALTER TABLE in `ensureTable()`: `["source_manifest", "JSON DEFAULT NULL"]` — append to existing `buildColumns` array (line 54-63)
- Add `source_manifest: string | null` to `BuildSourceRow`
- Add `sourceManifest: RealmManifest | null` to `BuildSource`
- Parse in `rowToSource()` using same pattern as `build_args` (line 162-163): `JSON.parse` then `parseManifest()`... actually, store as JSON in DB, so parse JSON then validate as manifest
- Add to `updateSource()` params: `sourceManifest?: RealmManifest | null` — serialize to JSON for storage
- Add to `createSource()` — accept optional manifest
- Update `BuildSource` type in `src/types/realm.ts` to include `sourceManifest`
- Seed: update the default "AzerothCore WotLK (Vanilla)" source seed to include the vanilla manifest

**Definition of Done:**

- [ ] `source_manifest` column created on first access
- [ ] `BuildSource.sourceManifest` populated from DB
- [ ] `updateSource()` persists manifest changes
- [ ] Existing sources without manifest get null (treated as vanilla defaults in code)
- [ ] Client type updated
- [ ] `bun tsc --noEmit` passes

**Verify:**

- `bun tsc --noEmit`

---

### Task 3: Build Pipeline — Modules, Submodules, Steps, Auto-detect

**Objective:** Extend the build pipeline to clone modules, handle submodules conditionally, execute pre/post-build steps, and auto-detect `realmmanager.yaml` from the repo.

**Dependencies:** Task 1, Task 2

**Files:**

- Modify: `src/lib/build-pipeline.ts`

**Key Decisions / Notes:**

- In `startBuild()` (line 209): load source, read `sourceManifest`
- Pass manifest down to `buildSource()` via extended `SourceBuildConfig`
- **Module cloning** (after git clone, before Docker build):
  - For each module in `manifest.modules`: `git clone --depth=1 --branch {branch} {url} {srcDir}/{path}`
  - If `useToken: true` and source has a GitHub token, inject token into module URL
  - Log each module clone
- **Submodule handling** (replace the unconditional `--recurse-submodules` from earlier fix):
  - If `manifest.build.submodules` is true: add `--recurse-submodules --shallow-submodules` to clone, and `git submodule update --init --recursive --depth=1` to update
  - If false or no manifest: skip submodules (faster for vanilla)
- **Pre-build steps** (after clone + modules, before Docker build):
  - For each step in `manifest.steps.preBuild`: run `sh -c "{command}"` in srcDir
  - Log each step
- **Post-build steps** (after Docker build completes):
  - For each step in `manifest.steps.postBuild`: run in srcDir
- **Auto-detection** (after clone, before applying manifest):
  - Check if `{srcDir}/realmmanager.yaml` exists
  - If yes and source has no stored manifest: parse it, save to source via `updateSource()`
  - If yes and source already has a manifest: log "Using stored manifest (repo manifest ignored)"
  - This means first build auto-imports the manifest, subsequent builds use the stored one

**Definition of Done:**

- [ ] Modules are cloned into correct paths before Docker build
- [ ] Submodules are conditional on manifest setting
- [ ] Pre-build steps execute in source directory
- [ ] Post-build steps execute after Docker build
- [ ] Auto-detection reads `realmmanager.yaml` from repo on first build
- [ ] All operations are logged to the build log
- [ ] `bun tsc --noEmit` passes

**Verify:**

- `bun tsc --noEmit`

---

### Task 4: Realm Compose and Start Route — Extra DBs and Env Vars

**Objective:** Extend compose generation to inject extra databases and environment variables from the manifest, and create extra databases on realm start.

**Dependencies:** Task 1, Task 2

**Files:**

- Modify: `src/lib/realm-compose.ts`
- Modify: `src/lib/db-realm.ts`
- Modify: `src/app/api/realms/[realmId]/start/route.ts`
- Modify: `src/app/api/realms/route.ts` (realm create)
- Modify: `src/app/api/realms/[realmId]/route.ts` (realm update/PUT)

**Key Decisions / Notes:**

- **db-realm.ts:** Add `extraDbName(baseName: string, realmId: number): string` that returns `acore_{baseName}_{realmId}` (or just `acore_{baseName}` for realmId 1, matching existing charDb/worldDb pattern)
- **realm-compose.ts:** Extend `generateRealmCompose()` to accept manifest-derived config:
  - New optional parameter: `manifest?: { extraWorldserverEnv?: Record<string, string>; extraDbImportEnv?: Record<string, string> }`
  - Inject resolved env vars into both worldserver and db-import services
  - Use `resolveEnvPlaceholders()` from manifest.ts to fill in `{realmId}`, `{dbHost}`, etc.
- **start/route.ts:** After creating world/char databases (line 29-34), loop through `manifest.databases` and create each via `CREATE DATABASE IF NOT EXISTS`
- **realms/route.ts:** Same — create extra DBs during realm creation (line 155-193)
- **realms/[realmId]/route.ts:** Pass manifest config when regenerating compose on PUT

**Definition of Done:**

- [ ] Generated compose includes extra env vars on worldserver and db-import
- [ ] Placeholder values resolved with actual realm context
- [ ] Extra databases created on realm start and realm creation
- [ ] All 3 `generateRealmCompose()` call sites updated
- [ ] `bun tsc --noEmit` passes

**Verify:**

- `bun tsc --noEmit`

---

### Task 5: API — Manifest in Source Create/Update

**Objective:** Expose manifest through the source API endpoints. Accept manifest YAML or preset name on create/update. Add manifest presets endpoint.

**Dependencies:** Task 1, Task 2

**Files:**

- Modify: `src/app/api/builds/sources/route.ts`
- Modify: `src/app/api/builds/sources/[sourceId]/route.ts`
- Create: `src/app/api/manifests/presets/route.ts`

**Key Decisions / Notes:**

- **POST /api/builds/sources:** Accept optional `manifest` (YAML string) or `manifestPreset` (preset name). If preset provided, load preset. If YAML provided, parse and validate. Store as JSON.
- **PUT /api/builds/sources/{id}:** Accept `manifest` (YAML string) update. Validate before saving.
- **GET /api/manifests/presets:** Return list of available presets with their full YAML content (for UI dropdown/preview)
- Validation errors return 400 with specific messages about what's wrong in the manifest

**Definition of Done:**

- [ ] POST accepts manifest YAML or preset name
- [ ] PUT accepts manifest YAML updates
- [ ] Invalid YAML returns 400 with parse error
- [ ] Invalid schema returns 400 with validation errors
- [ ] GET /api/manifests/presets returns preset list
- [ ] `bun tsc --noEmit` passes

**Verify:**

- `bun tsc --noEmit`

---

### Task 6: Manifest Editor UI

**Objective:** Create a manifest management page with a YAML editor for viewing and editing source manifests.

**Dependencies:** Task 5

**Files:**

- Create: `src/app/manifests/page.tsx`
- Create: `src/app/manifests/layout.tsx`
- Modify: `src/components/NavBar.tsx`

**Key Decisions / Notes:**

- **Page layout:**
  - Left panel: list of sources with preset badges (vanilla/playerbots/custom/none)
  - Right panel: YAML editor for selected source
- **Editor features:**
  - Textarea with monospace font (keep it simple — no CodeMirror dependency)
  - "Load Preset" dropdown to populate editor with a preset YAML
  - "Save" button to persist changes
  - "Validate" button to check YAML without saving
  - Validation errors displayed inline below editor
- **Source list:** Each source shows name, preset badge, and key manifest details (extra DBs count, modules count)
- **NavBar:** Add "Manifests" link to admin items (after "Builds" at line 224)
- Follow existing UI patterns:
  - Inline styles with CSS variables (see builds/page.tsx)
  - Toast notifications for save/error
  - `requireAdmin` via API calls
  - Layout.tsx with session/role check (copy from builds/layout.tsx)

**Definition of Done:**

- [ ] Manifest page lists all sources with manifest status
- [ ] Selecting a source shows its manifest YAML in the editor
- [ ] Preset dropdown loads preset YAML into editor
- [ ] Save persists manifest via PUT API
- [ ] Validation errors shown before save
- [ ] NavBar includes "Manifests" link
- [ ] Page follows existing design system
- [ ] `bun tsc --noEmit` passes

**Verify:**

- `bun tsc --noEmit`

---

### Task 7: User Documentation

**Objective:** Write comprehensive user documentation for the manifest system.

**Dependencies:** Task 1 (for schema reference), Task 3 (for build pipeline behavior), Task 6 (for UI instructions)

**Files:**

- Create: `docs/manifests.md`

**Key Decisions / Notes:**

- **Sections:**
  1. Overview — what manifests are, why they exist
  2. Quick Start — using a preset (vanilla, playerbots)
  3. Schema Reference — every field documented with types, defaults, and examples
  4. Placeholder Variables — table of all supported placeholders
  5. Modules — how to declare extra repos to clone
  6. Steps — pre/post-build command execution, security notes
  7. Extra Databases — how per-realm DB naming works
  8. Environment Variables — how env var injection works for worldserver and db-import
  9. Auto-detection — how `realmmanager.yaml` in a repo gets imported
  10. Examples — complete manifests for common setups:
      - Vanilla AzerothCore
      - AzerothCore + Playerbots (submodule fork)
      - Vanilla AzerothCore + Playerbots module (separate clone)
      - Custom fork with extra databases
  11. Troubleshooting — common issues and solutions

**Definition of Done:**

- [ ] All schema fields documented with types and defaults
- [ ] Placeholder variables documented
- [ ] 4+ complete example manifests
- [ ] Troubleshooting section covers common errors
- [ ] Markdown renders correctly

**Verify:**

- Manual review of rendered markdown

---

## Open Questions

1. Should auto-detected `realmmanager.yaml` from the repo override a previously stored manifest, or should stored manifests always take precedence? (Plan says: first build imports, subsequent builds use stored — user can manually update via UI)

## Deferred Ideas

- Manifest import from URL (paste a GitHub raw URL to a manifest)
- Manifest export/share between RealmManager instances
- Per-template client data image override
- `postImport` steps that run SQL files against specific databases
- Manifest schema versioning (apiVersion: v2 with migration)
