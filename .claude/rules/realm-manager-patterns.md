# RealmManager Patterns

## Auth & Sessions

- **Guards:** Every API route starts with `requireLogin()` or `requireAdmin()` from `src/lib/auth.ts`
- **Pattern:** Discriminated union return — check `auth.ok` before accessing `auth.session` or `auth.response`
- **Levels:** Regular user (gmlevel 0-2), Admin (gmlevel >= 3), Super-admin (username "ADMIN")
- **Session:** iron-session with `SessionData { userId, username, gmlevel }` — cookie `realmmanager_session`, 7-day TTL
- **Middleware:** `src/middleware.ts` protects all routes except `PUBLIC_PATHS` — add new public routes there
- **Passwords:** SRP6 hashing (`src/lib/srp6.ts`) — AzerothCore-compatible, NOT bcrypt

```ts
// Standard API route pattern
export async function GET() {
  const auth = await requireLogin(); // or requireAdmin()
  if (!auth.ok) return auth.response;
  // ... use auth.session.userId, auth.session.username
}
```

## Database

- **Auth DB pool:** `query()` / `executeDb(DB_REALMD, ...)` — shared connection pool in `src/lib/db.ts`
- **Per-realm DBs:** `queryDb(database, sql, params)` — temporary connection, auto-closed
- **Naming:** `acore_characters_N`, `acore_world_N`, `acore_playerbots_N` (N = realm ID)
- **Helpers:** `charDb(realmId)` / `worldDb(realmId)` from `src/lib/db-realm.ts`
- **Settings priority:** `settings.json` > env vars > hardcoded defaults (via `src/lib/settings.ts`)
- **Migrations:** `sql/NNN_description.sql` — numbered, applied manually or at setup

```ts
// Auth DB (pooled)
const rows = await query<RealmRow>("SELECT * FROM realmlist WHERE id = ?", [id]);

// Realm-specific DB (temp connection)
const chars = await queryDb<CharRow>(charDb(realmId), "SELECT * FROM characters", []);
```

**IMPORTANT:** Always use parameterized queries. DB names from `charDb()`/`worldDb()` are safe (computed from realm ID integer), but user input must NEVER be concatenated into SQL.

## Docker & Realm Compose

- **Realm containers:** `ac-worldserver-N`, `ac-db-import-N`, `ac-client-data-init-N`
- **Port mapping:** World `8085+N-1`, RA `3443+N-1`, SOAP `7878+N-1` — see `src/lib/realm-compose.ts`
- **Compose generation:** `generateRealmCompose()` produces per-realm `docker-compose.yml` in `data/realms/N/`
- **Docker socket:** WebUI mounts `/var/run/docker.sock` — all Docker operations via CLI subprocess
- **Network:** All containers share `{COMPOSE_PROJECT}_ac-network` (external network)
- **Volumes:** `ac-client-data` shared read-only across realms, per-realm `etc/` and `logs/` on host

```
data/realms/N/
  docker-compose.yml    # Auto-generated — do NOT edit
  etc/                  # Worldserver config files
    modules/            # Module configs
  logs/                 # Worldserver logs
```

- **Start flow:** Create extra DBs from manifest -> generate compose -> `docker compose up -d`
- **Image tags:** Worldserver `ac-worldserver:source-branch-timestamp`, DB import derived via `dbImportImageTag()`

## Manifest System

- **Schema:** `docs/manifests.md` is the canonical reference — keep it updated with any changes
- **Parsing:** `src/lib/manifest.ts` — validates `apiVersion: v1`, `kind: RealmSource`
- **Storage:** Manifest YAML stored in `realm_sources_config` table per source
- **Placeholders:** `{realmId}`, `{dbHost}`, `{dbPort}`, `{dbPass}`, `{sourceId}` — resolved at realm start via `resolveEnvPlaceholders()`
- **Modules:** Git repos cloned into source tree before `docker build` — managed in build pipeline
- **Extra databases:** `databases[].name` -> `acore_{name}_{realmId}` created on realm start
- **Auto-detection:** `realmmanager.yaml` at repo root imported on first build
- **Presets:** Built-in `vanilla` and `playerbots` presets served from API

**Build lifecycle:**
1. Clone/update source repo
2. Auto-detect `realmmanager.yaml`
3. Clone modules from manifest
4. Run `preBuild` steps
5. `docker build` worldserver + db-import
6. Run `postBuild` steps
7. Extract config template
