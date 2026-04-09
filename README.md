# RealmManager

A web-based management dashboard for AzerothCore WoW private servers. Build server images from source, create and manage multiple realms, and monitor your server — all from one UI.

## Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/kwilliams312/RealmManager.git
cd RealmManager
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and set these values **before your first `docker compose up`**:

| Variable | Default | Description |
|---|---|---|
| `DOCKER_DB_ROOT_PASSWORD` | `password` | MySQL root password. **Change this for production.** |
| `WEBUI_SECRET_KEY` | `realmmanager-default-secret...` | Session encryption key. **Must be at least 32 characters. Change this for production.** |

### 3. Start the Stack

```bash
docker compose up -d
```

This starts:
- **MySQL** database
- **AzerothCore Auth Server** (login server)
- **RealmManager Web UI** on port 5555

### 4. First-Run Setup

Visit `http://localhost:5555` — the setup wizard will guide you through:

1. **Create Admin Account** — username and password for the game server and web UI
2. **Server Build** — the vanilla AzerothCore source is built automatically. This takes several minutes on first run.

After setup, log in and create your first realm from the **Realms** page.

## Configuration Reference

All configuration is via `.env` file in the project root.

| Variable | Default | Description |
|---|---|---|
| `DOCKER_DB_ROOT_PASSWORD` | `password` | MySQL root password |
| `DOCKER_DB_EXTERNAL_PORT` | `3306` | External MySQL port |
| `AC_AUTHSERVER_IMAGE` | `acore/ac-wotlk-authserver:master` | Auth server Docker image |
| `AC_DB_IMPORT_IMAGE` | `acore/ac-wotlk-db-import:master` | DB import Docker image |
| `AC_CLIENT_DATA_IMAGE` | `acore/ac-wotlk-client-data:master` | Client data (maps/dbc) image |
| `WEBUI_SECRET_KEY` | *(insecure default)* | Session encryption key (>=32 chars) |
| `DOCKER_WEBUI_EXTERNAL_PORT` | `5555` | Web UI port |
| `DOCKER_AUTH_EXTERNAL_PORT` | `3724` | Auth server port |
| `REALM_HOST_DIR` | `./data/realms` | Host path for realm data |
| `COMPOSE_PROJECT_NAME` | `realmmanager` | Docker compose project name |

## Managing Realms

### Build Sources

RealmManager ships with two pre-configured sources:

- **AzerothCore (Vanilla)** — standard AzerothCore WotLK
- **AzerothCore + Playerbots** — AzerothCore with the mod-playerbots module

Go to **Builds** to trigger a build, then create a realm from **Realms** using the built image.

### Source Manifests

Each source has a YAML manifest that declares its build recipe: extra databases, environment variables, module repositories, and build steps. See [Source Manifests Documentation](docs/manifests.md) for details.

Manage manifests from the **Manifests** page in the UI.

### Realm Controls

Start, stop, and restart realms from the **Dashboard** — controls appear in the realm tab header when you select a realm.

## Architecture

```
docker compose up -d
├── ac-database      (MySQL 8.4)
├── ac-db-import     (schema import, runs once)
├── ac-authserver    (AzerothCore login server)
└── ac-webui         (RealmManager Next.js app)
    ├── /setup       → first-run wizard
    ├── /dashboard   → server overview + realm controls
    ├── /realms      → realm management
    ├── /builds      → build sources + build history
    ├── /manifests   → YAML manifest editor
    └── /settings    → configuration
```

Each realm runs as a separate set of Docker containers (`ac-worldserver-N`, `ac-db-import-N`) managed by RealmManager.

## Development

### Prerequisites

- Node.js 22+
- Bun (package manager)
- Docker with Compose

### Local Development

```bash
bun install
bun dev
```

The dev server runs on `http://localhost:3000`. You'll need a MySQL instance with AzerothCore databases — set `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS` environment variables.

## License

See [LICENSE](LICENSE) for details.
