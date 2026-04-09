import { describe, expect, test } from "bun:test";
import {
  worldPort,
  raPort,
  soapPort,
  dbImportImageTag,
  generateRealmCompose,
  buildManifestEnv,
} from "../realm-compose";

describe("port calculations", () => {
  test("worldPort: realm 1 = 8085, realm 2 = 8086", () => {
    expect(worldPort(1)).toBe(8085);
    expect(worldPort(2)).toBe(8086);
    expect(worldPort(5)).toBe(8089);
  });

  test("raPort: realm 1 = 3443, realm 2 = 3444", () => {
    expect(raPort(1)).toBe(3443);
    expect(raPort(2)).toBe(3444);
    expect(raPort(5)).toBe(3447);
  });

  test("soapPort: realm 1 = 7878, realm 2 = 7879", () => {
    expect(soapPort(1)).toBe(7878);
    expect(soapPort(2)).toBe(7879);
    expect(soapPort(5)).toBe(7882);
  });
});

describe("dbImportImageTag", () => {
  test("replaces ac-worldserver with ac-db-import", () => {
    expect(dbImportImageTag("ac-worldserver:azerothcore-wotlk-20260408-120000")).toBe(
      "ac-db-import:azerothcore-wotlk-20260408-120000"
    );
  });

  test("only replaces first occurrence", () => {
    expect(dbImportImageTag("ac-worldserver:ac-worldserver-test")).toBe(
      "ac-db-import:ac-worldserver-test"
    );
  });
});

describe("generateRealmCompose", () => {
  const imageTag = "ac-worldserver:test-20260408";

  test("generates valid YAML with correct realm ID", () => {
    const yaml = generateRealmCompose(3, imageTag);
    expect(yaml).toContain("ac-worldserver-3:");
    expect(yaml).toContain("ac-db-import-3:");
    expect(yaml).toContain("ac-client-data-init-3:");
    expect(yaml).toContain(`image: ${imageTag}`);
    expect(yaml).toContain("image: ac-db-import:test-20260408");
  });

  test("uses correct port mappings", () => {
    const yaml = generateRealmCompose(2, imageTag);
    expect(yaml).toContain('"8086:8085"'); // worldPort(2) = 8086
    expect(yaml).toContain('"7879:7878"'); // soapPort(2) = 7879
    expect(yaml).toContain('"3444:3443"'); // raPort(2) = 3444
  });

  test("includes realm-specific database names", () => {
    const yaml = generateRealmCompose(3, imageTag);
    expect(yaml).toContain("acore_characters_3");
    expect(yaml).toContain("acore_world_3");
  });

  test("realm 1 uses default database names", () => {
    const yaml = generateRealmCompose(1, imageTag);
    expect(yaml).toContain("acore_characters");
    expect(yaml).toContain("acore_world");
  });

  test("includes shared network", () => {
    const yaml = generateRealmCompose(1, imageTag);
    expect(yaml).toContain("ac-network:");
    expect(yaml).toContain("external: true");
  });

  test("uses custom paths when provided", () => {
    const yaml = generateRealmCompose(1, imageTag, {
      configPath: "/custom/etc",
      dataPath: "/custom/data",
      logsPath: "/custom/logs",
    });
    expect(yaml).toContain("/custom/etc");
    expect(yaml).toContain("/custom/data");
    expect(yaml).toContain("/custom/logs");
  });

  test("injects manifest env vars into worldserver service", () => {
    const yaml = generateRealmCompose(1, imageTag, undefined, {
      worldserver: { CUSTOM_VAR: "custom_value" },
    });
    expect(yaml).toContain("CUSTOM_VAR");
    expect(yaml).toContain("custom_value");
  });

  test("injects manifest env vars into db-import service", () => {
    const yaml = generateRealmCompose(1, imageTag, undefined, {
      dbImport: { DB_CUSTOM: "db_val" },
    });
    expect(yaml).toContain("DB_CUSTOM");
    expect(yaml).toContain("db_val");
  });

  test("header comment includes realm ID", () => {
    const yaml = generateRealmCompose(7, imageTag);
    expect(yaml).toContain("# Realm 7");
  });
});

describe("buildManifestEnv", () => {
  test("returns empty object for null manifest", () => {
    expect(buildManifestEnv(null, 1, "src-1")).toEqual({});
  });

  test("returns empty object for manifest without environment", () => {
    const manifest = {
      apiVersion: "v1",
      kind: "RealmSource",
      metadata: { name: "test" },
    };
    expect(buildManifestEnv(manifest, 1, "src-1")).toEqual({});
  });
});
