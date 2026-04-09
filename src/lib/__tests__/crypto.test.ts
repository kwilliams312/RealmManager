import { describe, expect, test } from "bun:test";
import { encrypt, decrypt } from "../crypto";

describe("crypto", () => {
  test("encrypt returns iv:authTag:ciphertext format", () => {
    const result = encrypt("hello");
    const parts = result.split(":");
    expect(parts).toHaveLength(3);
    // Each part should be valid hex
    for (const part of parts) {
      expect(/^[0-9a-f]+$/.test(part)).toBe(true);
    }
  });

  test("decrypt roundtrips with encrypt", () => {
    const plaintext = "secret-token-value";
    const encrypted = encrypt(plaintext);
    expect(decrypt(encrypted)).toBe(plaintext);
  });

  test("decrypt handles empty string", () => {
    const encrypted = encrypt("");
    expect(decrypt(encrypted)).toBe("");
  });

  test("decrypt handles unicode", () => {
    const plaintext = "hello world 123 special chars: <>&\"'";
    const encrypted = encrypt(plaintext);
    expect(decrypt(encrypted)).toBe(plaintext);
  });

  test("encrypt produces different ciphertexts for same input (random IV)", () => {
    const a = encrypt("same-input");
    const b = encrypt("same-input");
    expect(a).not.toBe(b); // Different IVs
  });

  test("decrypt returns null for corrupted data", () => {
    expect(decrypt("not-valid-format")).toBeNull();
    expect(decrypt("aa:bb")).toBeNull();
    expect(decrypt("")).toBeNull();
  });

  test("decrypt returns null for tampered ciphertext", () => {
    const encrypted = encrypt("test");
    const parts = encrypted.split(":");
    // Flip a byte in the ciphertext
    const tampered = parts[0] + ":" + parts[1] + ":ff" + parts[2].slice(2);
    expect(decrypt(tampered)).toBeNull();
  });
});
