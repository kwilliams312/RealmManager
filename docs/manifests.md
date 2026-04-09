# RealmManager Source Manifests

Source manifests are YAML files that describe everything RealmManager needs to build and run an AzerothCore fork. Think of them like Helm charts — a declarative recipe that covers building the Docker image, creating databases, injecting environment variables, cloning extra modules, and running custom setup steps.

---

## Overview

Without a manifest, RealmManager assumes a standard AzerothCore setup: one world database, one characters database, and no extra configuration. This works for vanilla AzerothCore but breaks for forks that need extra databases (like the playerbots database) or extra repos cloned into the source tree.

A manifest solves this by declaring:

- **Build config** — Dockerfile path, build targets, build args, whether to clone submodules
- **Modules** — extra Git repos to clone into the source tree before building
- **Databases** — extra databases to create per realm
- **Environment** — extra env vars injected into the worldserver and db-import containers
- **Paths** — container paths (only needed if the fork uses non-standard paths)
- **Steps** — shell commands to run at specific points in the build lifecycle

---

## Quick Start

### Using a Preset

The easiest way to get started is with a built-in preset.

1. Go to **Manifests** in the navigation
2. Select your source from the left panel
3. Click **Load preset** and choose `vanilla` or `playerbots`
4. Click **Save**

The preset will be applied on the next build and realm start.

### Using a Custom Manifest

1. Go to **Manifests**, select your source
2. Write your manifest in the YAML editor (see schema below)
3. Click **Validate** to check for errors
4. Click **Save**

### Auto-Detection

If your repository contains a `realmmanager.yaml` file at the root, RealmManager will automatically import it as the source manifest on the **first build**. Subsequent builds use the stored manifest — edit it in the UI if you want to change it.

---

## Schema Reference

```yaml
apiVersion: v1          # required — must be "v1"
kind: RealmSource       # required — must be "RealmSource"

metadata:
  name: string          # required — short identifier (e.g., "playerbots")
  description: string   # optional — human-readable description

build:
  dockerfile: string    # optional — path to Dockerfile (default: "apps/docker/Dockerfile")
  targets:
    worldserver: string # optional — Docker build target for worldserver (default: "worldserver")
    dbImport: string    # optional — Docker build target for db-import (default: "db-import")
  submodules: boolean   # optional — init git submodules during clone (default: false)
  args:                 # optional — Docker build arguments
    KEY: value

modules:                # optional — extra repos to clone before building
  - name: string        # required — display name
    url: string         # required — Git clone URL
    path: string        # required — destination path relative to source root
    branch: string      # optional — branch to checkout (default: repo default)
    useToken: boolean   # optional — use source's GitHub token for auth (default: false)

databases:              # optional — extra databases to create per realm
  - name: string        # required — base name; becomes acore_{name}_{realmId} in MySQL

environment:            # optional — extra env vars for containers
  worldserver:          # env vars added to the worldserver container
    KEY: value
  dbImport:             # env vars added to the db-import container
    KEY: value

paths:                  # optional — container paths (only override if fork uses non-standard paths)
  config: string        # default: /azerothcore/env/dist/etc
  refConfig: string     # default: /azerothcore/env/ref/etc
  data: string          # default: /azerothcore/env/dist/data
  logs: string          # default: /azerothcore/env/dist/logs

steps:                  # optional — shell commands at lifecycle points
  preBuild:             # before Docker build starts
    - run: string
  postBuild:            # after Docker build completes
    - run: string
  postImport:           # (informational — for documentation; executed externally)
    - run: string
```

---

## Placeholder Variables

Environment variable values and step commands support placeholders that are resolved at realm start time:

| Placeholder | Resolves to | Example |
|---|---|---|
| `{realmId}` | Realm's numeric ID | `5` |
| `{dbHost}` | Database host | `ac-database` |
| `{dbPort}` | Database port | `3306` |
| `{dbPass}` | Database root password | `password` |
| `{sourceId}` | Source slug | `my-playerbot-fork` |

**Example:**
```yaml
environment:
  worldserver:
    AC_PLAYERBOTS_DATABASE_INFO: "{dbHost};{dbPort};root;{dbPass};acore_playerbots_{realmId}"
```

For realm 5 with `dbHost=ac-database`, `dbPort=3306`, `dbPass=password`, this resolves to:
```
AC_PLAYERBOTS_DATABASE_INFO: "ac-database;3306;root;password;acore_playerbots_5"
```

---

## Modules

The `modules` section clones extra Git repositories into the source tree **before** `docker build` runs. This means the cloned code is available to `COPY` instructions in the Dockerfile.

```yaml
modules:
  - name: mod-playerbots
    url: https://github.com/mod-playerbots/mod-playerbots.git
    path: modules/mod-playerbots
    branch: master
```

This is equivalent to running `git clone --depth=1 --branch master <url> modules/mod-playerbots` inside the source checkout before building.

**Private module repos:**
```yaml
modules:
  - name: my-private-module
    url: https://github.com/myorg/private-module.git
    path: modules/private-module
    useToken: true    # uses the GitHub token configured on the source
```

**On subsequent builds:** If the module directory already exists, RealmManager runs `git fetch` + `git reset --hard origin/<branch>` to update it.

---

## Steps

Steps execute shell commands at specific points in the build pipeline. All commands run in the source checkout directory.

```yaml
steps:
  preBuild:
    - run: cp my-custom-config.conf env/dist/etc/
    - run: bash scripts/prepare.sh
  postBuild:
    - run: echo "Build complete at $(date)"
```

**Lifecycle order:**
1. Git clone / update source
2. Auto-detect `realmmanager.yaml`
3. Clone modules
4. **preBuild steps**
5. `docker build` worldserver
6. `docker build` db-import
7. **postBuild steps**
8. Extract config template

**Security note:** Steps run inside the build container with access to the source checkout. Do not include sensitive credentials in step commands — use placeholder variables in environment instead.

**Failure handling:** Step failures are logged as warnings but do not abort the build.

---

## Extra Databases

Databases declared in the manifest are created automatically when a realm is created or started.

```yaml
databases:
  - name: playerbots
```

This creates `acore_playerbots_{realmId}` (e.g., `acore_playerbots_5` for realm 5) using `CREATE DATABASE IF NOT EXISTS`. The database is created empty — the db-import container populates it from the SQL files in the source.

**Naming pattern:** `acore_{name}_{realmId}` — always per-realm, always prefixed with `acore_`.

---

## Environment Variables

Environment variables are injected into the compose file for each realm.

```yaml
environment:
  worldserver:
    AC_PLAYERBOTS_DATABASE_INFO: "{dbHost};{dbPort};root;{dbPass};acore_playerbots_{realmId}"
    AC_AI_PLAYERBOT_RANDOM_BOT_AUTOLOGIN: "1"
  dbImport:
    AC_PLAYERBOTS_DATABASE_INFO: "{dbHost};{dbPort};root;{dbPass};acore_playerbots_{realmId}"
```

These are added to the generated `docker-compose.yml` for each realm alongside the standard AzerothCore environment variables.

---

## Auto-Detection

If your repository contains `realmmanager.yaml` at its root, RealmManager imports it automatically during the first build:

1. Source is cloned
2. RealmManager checks for `realmmanager.yaml`
3. If found and source has no stored manifest: parses and saves it
4. If found and source already has a stored manifest: logs "Using stored manifest (repo manifest ignored)"

This means you can ship your fork with a `realmmanager.yaml` at the root and users get automatic setup when they add your repo as a source and trigger a build.

**Example `realmmanager.yaml` to commit to your fork:**
```yaml
apiVersion: v1
kind: RealmSource
metadata:
  name: my-fork
  description: My custom AzerothCore fork

build:
  submodules: true

databases:
  - name: myextradb

environment:
  worldserver:
    AC_MY_EXTRA_DB_INFO: "{dbHost};{dbPort};root;{dbPass};acore_myextradb_{realmId}"
  dbImport:
    AC_MY_EXTRA_DB_INFO: "{dbHost};{dbPort};root;{dbPass};acore_myextradb_{realmId}"
```

---

## Examples

### Vanilla AzerothCore (no extras)

```yaml
apiVersion: v1
kind: RealmSource
metadata:
  name: vanilla
  description: Vanilla AzerothCore — standard setup

build:
  dockerfile: apps/docker/Dockerfile
  targets:
    worldserver: worldserver
    dbImport: db-import
  submodules: false
```

### AzerothCore + Playerbots (submodule fork)

For forks like `kwilliams312/azerothcore-playerbot_vanilla` where mod-playerbots is already a submodule:

```yaml
apiVersion: v1
kind: RealmSource
metadata:
  name: playerbots
  description: AzerothCore with mod-playerbots (submodule fork)

build:
  dockerfile: apps/docker/Dockerfile
  targets:
    worldserver: worldserver
    dbImport: db-import
  submodules: true

databases:
  - name: playerbots

environment:
  worldserver:
    AC_PLAYERBOTS_DATABASE_INFO: "{dbHost};{dbPort};root;{dbPass};acore_playerbots_{realmId}"
  dbImport:
    AC_PLAYERBOTS_DATABASE_INFO: "{dbHost};{dbPort};root;{dbPass};acore_playerbots_{realmId}"
```

### Vanilla AzerothCore + Playerbots module (separate clone)

For vanilla AzerothCore with mod-playerbots added as a separate module (not a submodule):

```yaml
apiVersion: v1
kind: RealmSource
metadata:
  name: playerbots-vanilla
  description: Vanilla AzerothCore + mod-playerbots module

build:
  dockerfile: apps/docker/Dockerfile
  targets:
    worldserver: worldserver
    dbImport: db-import
  submodules: false

modules:
  - name: mod-playerbots
    url: https://github.com/mod-playerbots/mod-playerbots.git
    path: modules/mod-playerbots
    branch: master

databases:
  - name: playerbots

environment:
  worldserver:
    AC_PLAYERBOTS_DATABASE_INFO: "{dbHost};{dbPort};root;{dbPass};acore_playerbots_{realmId}"
  dbImport:
    AC_PLAYERBOTS_DATABASE_INFO: "{dbHost};{dbPort};root;{dbPass};acore_playerbots_{realmId}"
```

### Custom fork with extra databases and pre-build steps

```yaml
apiVersion: v1
kind: RealmSource
metadata:
  name: my-custom-fork
  description: Custom fork with extra databases and setup scripts

build:
  dockerfile: docker/Dockerfile
  targets:
    worldserver: worldserver
    dbImport: db-import
  submodules: true
  args:
    CTYPE: RelWithDebInfo

modules:
  - name: my-module
    url: https://github.com/myorg/my-module.git
    path: modules/my-module
    branch: main
    useToken: true

databases:
  - name: mymod
  - name: mymod_global

environment:
  worldserver:
    AC_MYMOD_DATABASE_INFO: "{dbHost};{dbPort};root;{dbPass};acore_mymod_{realmId}"
    AC_MYMOD_GLOBAL_DATABASE_INFO: "{dbHost};{dbPort};root;{dbPass};acore_mymod_global_{realmId}"
  dbImport:
    AC_MYMOD_DATABASE_INFO: "{dbHost};{dbPort};root;{dbPass};acore_mymod_{realmId}"
    AC_MYMOD_GLOBAL_DATABASE_INFO: "{dbHost};{dbPort};root;{dbPass};acore_mymod_global_{realmId}"

paths:
  config: /azerothcore/env/dist/etc
  refConfig: /azerothcore/env/ref/etc
  data: /azerothcore/env/dist/data
  logs: /azerothcore/env/dist/logs

steps:
  preBuild:
    - run: bash scripts/pre-build.sh
  postBuild:
    - run: echo "Build complete for {sourceId}"
```

---

## Troubleshooting

### "charsections_dbc doesn't exist" on realm start

The worldserver expects a `charsections_dbc` table that the db-import didn't create. This usually means the module SQL files weren't present during the Docker build.

**Fix:** Add the module to `modules` in the manifest and rebuild.

If the module is a git submodule of the main repo, set `build.submodules: true` instead.

### Module clone fails

Check the error in the build log. Common causes:
- Private repo without a GitHub token configured on the source
- Wrong branch name
- Network issue

For private modules, set `useToken: true` on the module entry and make sure the source has a GitHub token configured in Settings → GitHub Tokens.

### Extra database not created

Extra databases are created when a realm is **started**, not when it's created. If the database is missing:

1. Check the manifest is saved (Manifests page → source → verify YAML is correct)
2. Stop and start the realm — the start route creates databases before launching containers

### Realm compose doesn't have the extra env vars

The compose is regenerated on each realm start. After saving a manifest, stop and start the realm to apply it.

### "Using stored manifest (repo manifest ignored)"

Your repo has a `realmmanager.yaml` but the source already has a stored manifest. If you want to use the repo's version, clear the stored manifest in the Manifests editor (empty the editor and save), then trigger a new build.

### Pre-build steps not running

Steps only run on git-source builds (not image-source pulls). They also only run when `manifest.steps.preBuild` is set. Check the build log for `Running pre-build steps...`.
