import { describe, expect, test } from "bun:test";
import {
  validateManifest,
  parseManifest,
  serializeManifest,
  resolveEnvPlaceholders,
  extraDbName,
  getPreset,
  getPresetList,
} from "../manifest";

// ─── validateManifest ────────────────────────────────────────────────────────

describe("validateManifest", () => {
  const minimal = {
    apiVersion: "v1",
    kind: "RealmSource",
    metadata: { name: "test" },
  };

  test("accepts minimal valid manifest", () => {
    const { valid, errors } = validateManifest(minimal);
    expect(valid).toBe(true);
    expect(errors).toHaveLength(0);
  });

  test("rejects null", () => {
    const { valid, errors } = validateManifest(null);
    expect(valid).toBe(false);
    expect(errors).toContain("Manifest must be a YAML object");
  });

  test("rejects non-object", () => {
    expect(validateManifest("string").valid).toBe(false);
    expect(validateManifest(42).valid).toBe(false);
  });

  test("rejects wrong apiVersion", () => {
    const { valid, errors } = validateManifest({ ...minimal, apiVersion: "v2" });
    expect(valid).toBe(false);
    expect(errors).toContain('apiVersion must be "v1"');
  });

  test("rejects missing apiVersion", () => {
    const { apiVersion, ...rest } = minimal;
    const { valid } = validateManifest(rest);
    expect(valid).toBe(false);
  });

  test("rejects wrong kind", () => {
    const { valid, errors } = validateManifest({ ...minimal, kind: "Other" });
    expect(valid).toBe(false);
    expect(errors).toContain('kind must be "RealmSource"');
  });

  test("rejects missing metadata", () => {
    const { metadata, ...rest } = minimal;
    const { valid } = validateManifest({ ...rest, apiVersion: "v1", kind: "RealmSource" });
    expect(valid).toBe(false);
  });

  test("rejects metadata without name", () => {
    const { valid } = validateManifest({ ...minimal, metadata: { description: "no name" } });
    expect(valid).toBe(false);
  });

  test("validates modules array entries", () => {
    const withModules = {
      ...minimal,
      modules: [{ name: "mod", url: "https://example.com", path: "modules/mod" }],
    };
    expect(validateManifest(withModules).valid).toBe(true);
  });

  test("rejects module missing required fields", () => {
    const { errors } = validateManifest({ ...minimal, modules: [{ name: "mod" }] });
    expect(errors.some((e) => e.includes("modules[0].url"))).toBe(true);
    expect(errors.some((e) => e.includes("modules[0].path"))).toBe(true);
  });

  test("rejects modules as non-array", () => {
    const { errors } = validateManifest({ ...minimal, modules: "bad" });
    expect(errors).toContain("modules must be an array");
  });

  test("validates database name format", () => {
    expect(
      validateManifest({ ...minimal, databases: [{ name: "playerbots" }] }).valid
    ).toBe(true);
    expect(
      validateManifest({ ...minimal, databases: [{ name: "my_db_2" }] }).valid
    ).toBe(true);
  });

  test("rejects invalid database name", () => {
    const { valid } = validateManifest({
      ...minimal,
      databases: [{ name: "Invalid-Name" }],
    });
    expect(valid).toBe(false);
  });

  test("rejects database name starting with number", () => {
    const { valid } = validateManifest({
      ...minimal,
      databases: [{ name: "1bad" }],
    });
    expect(valid).toBe(false);
  });

  test("rejects databases as non-array", () => {
    const { errors } = validateManifest({ ...minimal, databases: "bad" });
    expect(errors).toContain("databases must be an array");
  });
});

// ─── parseManifest / serializeManifest ───────────────────────────────────────

describe("parseManifest", () => {
  const yamlStr = `apiVersion: v1
kind: RealmSource
metadata:
  name: test-source
  description: A test source
`;

  test("parses valid YAML into RealmManifest", () => {
    const manifest = parseManifest(yamlStr);
    expect(manifest.apiVersion).toBe("v1");
    expect(manifest.kind).toBe("RealmSource");
    expect(manifest.metadata.name).toBe("test-source");
    expect(manifest.metadata.description).toBe("A test source");
  });

  test("throws on invalid YAML schema", () => {
    expect(() => parseManifest("apiVersion: v2\nkind: Other\n")).toThrow("Invalid manifest");
  });

  test("throws on non-YAML content", () => {
    expect(() => parseManifest("not: valid: yaml: [")).toThrow();
  });
});

describe("serializeManifest", () => {
  test("roundtrips through parse and serialize", () => {
    const original = {
      apiVersion: "v1" as const,
      kind: "RealmSource" as const,
      metadata: { name: "roundtrip", description: "test" },
    };
    const yaml = serializeManifest(original);
    const parsed = parseManifest(yaml);
    expect(parsed.metadata.name).toBe("roundtrip");
    expect(parsed.metadata.description).toBe("test");
  });
});

// ─── resolveEnvPlaceholders ──────────────────────────────────────────────────

describe("resolveEnvPlaceholders", () => {
  const ctx = {
    realmId: 5,
    dbHost: "db.local",
    dbPort: "3307",
    dbPass: "s3cret",
    sourceId: "src-42",
  };

  test("replaces all placeholders", () => {
    const vars = {
      DB_INFO: "{dbHost};{dbPort};root;{dbPass};acore_playerbots_{realmId}",
      SOURCE: "source-{sourceId}",
    };
    const result = resolveEnvPlaceholders(vars, ctx);
    expect(result.DB_INFO).toBe("db.local;3307;root;s3cret;acore_playerbots_5");
    expect(result.SOURCE).toBe("source-src-42");
  });

  test("handles multiple occurrences of same placeholder", () => {
    const result = resolveEnvPlaceholders(
      { DOUBLE: "{realmId}-{realmId}" },
      ctx
    );
    expect(result.DOUBLE).toBe("5-5");
  });

  test("passes through strings without placeholders", () => {
    const result = resolveEnvPlaceholders({ PLAIN: "no-placeholders" }, ctx);
    expect(result.PLAIN).toBe("no-placeholders");
  });

  test("handles empty input", () => {
    expect(resolveEnvPlaceholders({}, ctx)).toEqual({});
  });
});

// ─── extraDbName ─────────────────────────────────────────────────────────────

describe("extraDbName", () => {
  test("formats database name with realm ID", () => {
    expect(extraDbName("playerbots", 1)).toBe("acore_playerbots_1");
    expect(extraDbName("playerbots", 5)).toBe("acore_playerbots_5");
  });
});

// ─── Presets ─────────────────────────────────────────────────────────────────

describe("presets", () => {
  test("getPreset returns vanilla preset", () => {
    const vanilla = getPreset("vanilla");
    expect(vanilla).not.toBeNull();
    expect(vanilla!.apiVersion).toBe("v1");
    expect(vanilla!.kind).toBe("RealmSource");
    expect(vanilla!.metadata.name).toBe("vanilla");
  });

  test("getPreset returns playerbots preset with modules and databases", () => {
    const pb = getPreset("playerbots");
    expect(pb).not.toBeNull();
    expect(pb!.modules).toHaveLength(1);
    expect(pb!.modules![0].name).toBe("mod-playerbots");
    expect(pb!.databases).toHaveLength(1);
    expect(pb!.databases![0].name).toBe("playerbots");
  });

  test("getPreset returns null for unknown preset", () => {
    expect(getPreset("nonexistent")).toBeNull();
  });

  test("getPresetList returns all presets with YAML", () => {
    const list = getPresetList();
    expect(list.length).toBeGreaterThanOrEqual(2);
    const names = list.map((p) => p.name);
    expect(names).toContain("vanilla");
    expect(names).toContain("playerbots");
    for (const preset of list) {
      expect(preset.yaml).toContain("apiVersion");
      expect(preset.description).toBeTruthy();
    }
  });

  test("preset YAML is parseable", () => {
    for (const preset of getPresetList()) {
      const manifest = parseManifest(preset.yaml);
      expect(manifest.apiVersion).toBe("v1");
    }
  });
});
