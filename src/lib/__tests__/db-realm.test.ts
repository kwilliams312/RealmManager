import { describe, expect, test } from "bun:test";
import {
  charDb,
  worldDb,
  extraDbName,
  ALLIANCE_RACES,
  HORDE_RACES,
  CLASS_NAMES,
  RACE_NAMES,
} from "../db-realm";

describe("charDb", () => {
  test("realm 1 returns default characters DB", () => {
    // Without DB_CHARACTERS env var, falls back to "acore_characters"
    expect(charDb(1)).toBe("acore_characters");
  });

  test("realm 2+ returns suffixed name", () => {
    expect(charDb(2)).toBe("acore_characters_2");
    expect(charDb(10)).toBe("acore_characters_10");
  });
});

describe("worldDb", () => {
  test("realm 1 returns default world DB", () => {
    expect(worldDb(1)).toBe("acore_world");
  });

  test("realm 2+ returns suffixed name", () => {
    expect(worldDb(2)).toBe("acore_world_2");
    expect(worldDb(10)).toBe("acore_world_10");
  });
});

describe("extraDbName", () => {
  test("formats with realm ID suffix", () => {
    expect(extraDbName("playerbots", 1)).toBe("acore_playerbots_1");
    expect(extraDbName("playerbots", 5)).toBe("acore_playerbots_5");
    expect(extraDbName("custom", 3)).toBe("acore_custom_3");
  });
});

describe("race/class constants", () => {
  test("alliance and horde races are disjoint", () => {
    for (const race of ALLIANCE_RACES) {
      expect(HORDE_RACES.has(race)).toBe(false);
    }
  });

  test("all race IDs have names", () => {
    for (const race of [...ALLIANCE_RACES, ...HORDE_RACES]) {
      expect(RACE_NAMES[race]).toBeTruthy();
    }
  });

  test("WotLK has 10 classes (no Monk/DH)", () => {
    expect(Object.keys(CLASS_NAMES)).toHaveLength(10);
  });

  test("class IDs include all WotLK classes", () => {
    const expectedClasses = [
      "Warrior", "Paladin", "Hunter", "Rogue", "Priest",
      "Death Knight", "Shaman", "Mage", "Warlock", "Druid",
    ];
    const classValues = Object.values(CLASS_NAMES);
    for (const cls of expectedClasses) {
      expect(classValues).toContain(cls);
    }
  });
});
