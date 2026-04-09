/**
 * RealmManager source manifests — YAML-based installation recipes for AzerothCore forks.
 *
 * Each source can declare a realmmanager.yaml that specifies extra databases,
 * environment variables, module repos to clone, and pre/post-build steps.
 */

import { dump, load } from "js-yaml";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ManifestModule {
  name: string;
  url: string;
  path: string;
  branch?: string;
  /** Inherit the source's configured GitHub token for this clone */
  useToken?: boolean;
}

export interface ManifestStep {
  run: string;
}

export interface RealmManifest {
  apiVersion: string;
  kind: string;
  metadata: {
    name: string;
    description?: string;
  };
  build?: {
    dockerfile?: string;
    targets?: {
      worldserver?: string;
      dbImport?: string;
    };
    submodules?: boolean;
    args?: Record<string, string>;
  };
  modules?: ManifestModule[];
  databases?: Array<{
    name: string;
    /** SQL directory inside the db-import image to import into this database on first start.
     *  e.g. "/azerothcore/modules/mod-playerbots/data/sql/playerbots/base"
     */
    importSqlFrom?: string;
  }>;
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
    preBuild?: ManifestStep[];
    postBuild?: ManifestStep[];
    postImport?: ManifestStep[];
  };
}

export interface PlaceholderContext {
  realmId: number;
  dbHost: string;
  dbPort: string;
  dbPass: string;
  sourceId: string;
}

// ─── Validation ───────────────────────────────────────────────────────────────

export function validateManifest(raw: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (typeof raw !== "object" || raw === null) {
    return { valid: false, errors: ["Manifest must be a YAML object"] };
  }

  const obj = raw as Record<string, unknown>;

  if (!obj.apiVersion || obj.apiVersion !== "v1") {
    errors.push('apiVersion must be "v1"');
  }
  if (!obj.kind || obj.kind !== "RealmSource") {
    errors.push('kind must be "RealmSource"');
  }
  if (!obj.metadata || typeof obj.metadata !== "object") {
    errors.push("metadata is required");
  } else {
    const meta = obj.metadata as Record<string, unknown>;
    if (!meta.name || typeof meta.name !== "string") {
      errors.push("metadata.name is required and must be a string");
    }
  }

  if (obj.modules !== undefined) {
    if (!Array.isArray(obj.modules)) {
      errors.push("modules must be an array");
    } else {
      (obj.modules as unknown[]).forEach((m, i) => {
        if (typeof m !== "object" || m === null) {
          errors.push(`modules[${i}] must be an object`);
          return;
        }
        const mod = m as Record<string, unknown>;
        if (!mod.name) errors.push(`modules[${i}].name is required`);
        if (!mod.url) errors.push(`modules[${i}].url is required`);
        if (!mod.path) errors.push(`modules[${i}].path is required`);
      });
    }
  }

  if (obj.databases !== undefined) {
    if (!Array.isArray(obj.databases)) {
      errors.push("databases must be an array");
    } else {
      (obj.databases as unknown[]).forEach((d, i) => {
        if (typeof d !== "object" || d === null) {
          errors.push(`databases[${i}] must be an object`);
          return;
        }
        const db = d as Record<string, unknown>;
        if (!db.name || typeof db.name !== "string") {
          errors.push(`databases[${i}].name is required and must be a string`);
        } else if (!/^[a-z][a-z0-9_]*$/.test(db.name as string)) {
          errors.push(`databases[${i}].name must be lowercase alphanumeric with underscores`);
        }
      });
    }
  }

  return { valid: errors.length === 0, errors };
}

// ─── Parse / Serialize ────────────────────────────────────────────────────────

/** Parse a YAML string into a RealmManifest. Throws on invalid YAML or schema. */
export function parseManifest(yaml: string): RealmManifest {
  const raw = load(yaml);
  const { valid, errors } = validateManifest(raw);
  if (!valid) {
    throw new Error(`Invalid manifest: ${errors.join("; ")}`);
  }
  return raw as RealmManifest;
}

/** Convert a RealmManifest to a YAML string. */
export function serializeManifest(manifest: RealmManifest): string {
  return dump(manifest, { lineWidth: 120, quotingType: '"', forceQuotes: false });
}

// ─── Placeholder Resolution ───────────────────────────────────────────────────

/** Replace {realmId}, {dbHost}, {dbPort}, {dbPass}, {sourceId} in all values. */
export function resolveEnvPlaceholders(
  vars: Record<string, string>,
  ctx: PlaceholderContext
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(vars)) {
    result[key] = value
      .replace(/\{realmId\}/g, String(ctx.realmId))
      .replace(/\{dbHost\}/g, ctx.dbHost)
      .replace(/\{dbPort\}/g, ctx.dbPort)
      .replace(/\{dbPass\}/g, ctx.dbPass)
      .replace(/\{sourceId\}/g, ctx.sourceId);
  }
  return result;
}

// ─── DB Naming ────────────────────────────────────────────────────────────────

/** Returns the per-realm database name for an extra database entry.
 *  e.g. extraDbName("playerbots", 5) → "acore_playerbots_5"
 *  Realm 1 still gets suffix _1 (unlike world/char DBs) to keep naming consistent.
 */
export function extraDbName(baseName: string, realmId: number): string {
  return `acore_${baseName}_${realmId}`;
}

// ─── Presets ──────────────────────────────────────────────────────────────────

const VANILLA_PRESET: RealmManifest = {
  apiVersion: "v1",
  kind: "RealmSource",
  metadata: {
    name: "vanilla",
    description: "Vanilla AzerothCore — standard setup, no extras",
  },
  build: {
    dockerfile: "apps/docker/Dockerfile",
    targets: {
      worldserver: "worldserver",
      dbImport: "db-import",
    },
    submodules: false,
  },
  paths: {
    config: "/azerothcore/env/dist/etc",
    refConfig: "/azerothcore/env/ref/etc",
    data: "/azerothcore/env/dist/data",
    logs: "/azerothcore/env/dist/logs",
  },
};

const PLAYERBOTS_PRESET: RealmManifest = {
  apiVersion: "v1",
  kind: "RealmSource",
  metadata: {
    name: "playerbots",
    description: "AzerothCore with mod-playerbots — requires extra database and submodule clone",
  },
  build: {
    dockerfile: "apps/docker/Dockerfile",
    targets: {
      worldserver: "worldserver",
      dbImport: "db-import",
    },
    submodules: true,
  },
  modules: [
    {
      name: "mod-playerbots",
      url: "https://github.com/mod-playerbots/mod-playerbots.git",
      path: "modules/mod-playerbots",
      branch: "master",
    },
  ],
  databases: [
    {
      name: "playerbots",
      importSqlFrom: "/azerothcore/modules/mod-playerbots/data/sql/playerbots/base",
    },
  ],
  environment: {
    worldserver: {
      AC_PLAYERBOTS_DATABASE_INFO: "{dbHost};{dbPort};root;{dbPass};acore_playerbots_{realmId}",
      AC_PLAYERBOTS_UPDATES_ENABLE_DATABASES: "0",
      AC_PLAYERBOTS_DATABASE_WORKER_THREADS: "1",
      AC_PLAYERBOTS_DATABASE_SYNCH_THREADS: "1",
    },
    dbImport: {
      AC_PLAYERBOTS_DATABASE_INFO: "{dbHost};{dbPort};root;{dbPass};acore_playerbots_{realmId}",
    },
  },
  paths: {
    config: "/azerothcore/env/dist/etc",
    refConfig: "/azerothcore/env/ref/etc",
    data: "/azerothcore/env/dist/data",
    logs: "/azerothcore/env/dist/logs",
  },
};

const PRESETS: Record<string, RealmManifest> = {
  vanilla: VANILLA_PRESET,
  playerbots: PLAYERBOTS_PRESET,
};

export type PresetName = keyof typeof PRESETS;

/** Get a bundled preset manifest by name. */
export function getPreset(name: string): RealmManifest | null {
  return PRESETS[name] ?? null;
}

/** List all available presets with name and description. */
export function getPresetList(): Array<{ name: string; description: string; yaml: string }> {
  return Object.entries(PRESETS).map(([name, manifest]) => ({
    name,
    description: manifest.metadata.description ?? name,
    yaml: serializeManifest(manifest),
  }));
}
