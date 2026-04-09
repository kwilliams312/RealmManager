# Migrating from Monorepo to Standalone RealmManager

If you've been running RealmManager from inside the AzerothCore repo (`docker-compose.yml`
at the repo root), follow these steps to switch to the standalone setup.

## Prerequisites

- Docker and Docker Compose v2+
- Your existing RealmManager data (realms, builds, database)

## Migration Steps

### 1. Stop existing services

```bash
cd /path/to/azerothcore-wotlk
docker compose stop ac-webui
```

### 2. Set up standalone directory

```bash
# The webui/ directory IS the standalone project.
cd webui/

# Copy the example env file and customize
cp .env.example .env
# Edit .env — set DOCKER_DB_ROOT_PASSWORD to match your existing DB password
```

### 3. Point at your existing database

If your MySQL database is already running from the monorepo compose:

```bash
# In .env, set:
# DOCKER_DB_EXTERNAL_PORT=3307  (use a different port to avoid conflicts)
```

Or, to reuse the existing database container, add to `docker-compose.override.yml`:

```yaml
services:
  ac-database:
    # Use the existing database volume from the monorepo
    volumes:
      - azerothcore-wotlk_ac-database:/var/lib/mysql
volumes:
  azerothcore-wotlk_ac-database:
    external: true
```

### 4. Migrate realm data

```bash
# Copy realm data to the standalone layout
mkdir -p data/realms
cp -r ../realms/* data/realms/

# Update REALM_HOST_DIR in .env to point to the absolute path:
# REALM_HOST_DIR=/absolute/path/to/webui/data/realms
```

### 5. Start standalone RealmManager

```bash
docker compose up -d
```

### 6. Verify

- Open `http://your-server:5555` in a browser
- Log in with your existing admin account
- Check that realms appear and can be started/stopped

### 7. Clean up monorepo (optional)

Once verified, remove the `ac-webui` service from the monorepo's `docker-compose.yml`
or simply stop using the monorepo compose for the webui:

```bash
cd /path/to/azerothcore-wotlk
docker compose stop ac-webui
docker compose rm ac-webui
```

## Key Differences

| Setting | Monorepo | Standalone |
|---------|----------|------------|
| Compose project | `azerothcore-wotlk` | `realmmanager` |
| Realm data | `./realms/` | `./data/realms/` |
| Auth config | `/azerothcore/env/dist/etc` | `/data/etc` |
| Auth server | Built from source | Pre-built Docker Hub image |
| Client data volume | `azerothcore-wotlk_ac-client-data` | `realmmanager_ac-client-data` (created on first realm start) |

## Existing Realm Compose Files

Per-realm `docker-compose.yml` files reference the network and client-data volume by
compose project name. After migration, you'll need to rebuild/regenerate realm compose
files (stop and start each realm from the UI) so they reference `realmmanager_ac-network`
and `realmmanager_ac-client-data` instead of `azerothcore-wotlk_*`.
