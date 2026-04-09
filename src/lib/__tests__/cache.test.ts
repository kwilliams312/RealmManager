import { describe, expect, test } from "bun:test";
import { getCache, setCache, invalidateCache } from "../cache";

describe("cache", () => {
  // Use unique keys per test to avoid cross-test interference
  let keyCounter = 0;
  function uniqueKey(): string {
    return `test-key-${++keyCounter}-${Date.now()}`;
  }

  test("getCache returns null for missing key", () => {
    expect(getCache(uniqueKey())).toBeNull();
  });

  test("setCache and getCache roundtrip", () => {
    const key = uniqueKey();
    setCache(key, { hello: "world" });
    expect(getCache<{ hello: string }>(key)).toEqual({ hello: "world" });
  });

  test("setCache overwrites existing value", () => {
    const key = uniqueKey();
    setCache(key, "first");
    setCache(key, "second");
    expect(getCache<string>(key)).toBe("second");
  });

  test("invalidateCache removes entry", () => {
    const key = uniqueKey();
    setCache(key, "data");
    invalidateCache(key);
    expect(getCache(key)).toBeNull();
  });

  test("invalidateCache is safe on missing key", () => {
    invalidateCache(uniqueKey()); // should not throw
  });

  test("expired entries return null", async () => {
    const key = uniqueKey();
    setCache(key, "ephemeral", 1); // 1ms TTL
    await new Promise((r) => setTimeout(r, 10));
    expect(getCache(key)).toBeNull();
  });

  test("entries within TTL are returned", () => {
    const key = uniqueKey();
    setCache(key, "durable", 60_000); // 60s TTL
    expect(getCache<string>(key)).toBe("durable");
  });

  test("stores different types", () => {
    const k1 = uniqueKey();
    const k2 = uniqueKey();
    setCache<number>(k1, 42);
    setCache<number[]>(k2, [1, 2, 3]);
    expect(getCache<number>(k1)).toBe(42);
    expect(getCache<number[]>(k2)).toEqual([1, 2, 3]);
  });
});
