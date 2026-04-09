import { describe, expect, test } from "bun:test";
import { computeSRP6Verifier, verifySRP6Password } from "../srp6";

describe("SRP6", () => {
  const knownSalt = Buffer.alloc(32, 0xab);

  test("computeSRP6Verifier returns 32-byte salt and verifier", () => {
    const { salt, verifier } = computeSRP6Verifier("TestUser", "TestPass");
    expect(salt.length).toBe(32);
    expect(verifier.length).toBe(32);
  });

  test("computeSRP6Verifier is deterministic with same salt", () => {
    const a = computeSRP6Verifier("Admin", "Secret123", knownSalt);
    const b = computeSRP6Verifier("Admin", "Secret123", knownSalt);
    expect(a.verifier.equals(b.verifier)).toBe(true);
    expect(a.salt.equals(b.salt)).toBe(true);
  });

  test("computeSRP6Verifier uppercases username and password", () => {
    const lower = computeSRP6Verifier("admin", "secret", knownSalt);
    const upper = computeSRP6Verifier("ADMIN", "SECRET", knownSalt);
    const mixed = computeSRP6Verifier("AdMiN", "SeCrEt", knownSalt);
    expect(lower.verifier.equals(upper.verifier)).toBe(true);
    expect(lower.verifier.equals(mixed.verifier)).toBe(true);
  });

  test("different passwords produce different verifiers", () => {
    const a = computeSRP6Verifier("User", "Pass1", knownSalt);
    const b = computeSRP6Verifier("User", "Pass2", knownSalt);
    expect(a.verifier.equals(b.verifier)).toBe(false);
  });

  test("different usernames produce different verifiers", () => {
    const a = computeSRP6Verifier("User1", "Pass", knownSalt);
    const b = computeSRP6Verifier("User2", "Pass", knownSalt);
    expect(a.verifier.equals(b.verifier)).toBe(false);
  });

  test("generates random salt when none provided", () => {
    const a = computeSRP6Verifier("User", "Pass");
    const b = computeSRP6Verifier("User", "Pass");
    // Extremely unlikely to collide
    expect(a.salt.equals(b.salt)).toBe(false);
  });

  test("verifySRP6Password returns true for correct password", () => {
    const { salt, verifier } = computeSRP6Verifier("Player", "MyPass", knownSalt);
    expect(verifySRP6Password("Player", "MyPass", salt, verifier)).toBe(true);
  });

  test("verifySRP6Password returns false for wrong password", () => {
    const { salt, verifier } = computeSRP6Verifier("Player", "MyPass", knownSalt);
    expect(verifySRP6Password("Player", "WrongPass", salt, verifier)).toBe(false);
  });

  test("verifySRP6Password is case-insensitive", () => {
    const { salt, verifier } = computeSRP6Verifier("PLAYER", "MYPASS", knownSalt);
    expect(verifySRP6Password("player", "mypass", salt, verifier)).toBe(true);
  });
});
