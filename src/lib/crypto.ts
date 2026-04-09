/**
 * AES-256-GCM encryption for sensitive settings (e.g., GitHub tokens).
 * Key derived from SECRET_KEY env var via scrypt, cached in memory.
 */

import { randomBytes, createCipheriv, createDecipheriv, scryptSync } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT = "realmmanager-settings-v1";

let cachedKey: Buffer | null = null;

function getDerivedKey(): Buffer {
  if (cachedKey) return cachedKey;
  const secret =
    process.env.SECRET_KEY ??
    "change-this-in-production-must-be-at-least-32-chars!";
  cachedKey = scryptSync(secret, SALT, KEY_LENGTH);
  return cachedKey;
}

/**
 * Encrypt a plaintext string.
 * Returns `iv:authTag:ciphertext` as hex.
 */
export function encrypt(plaintext: string): string {
  const key = getDerivedKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Decrypt a previously encrypted string.
 * Returns null if decryption fails (wrong key, corrupted data).
 */
export function decrypt(encrypted: string): string | null {
  try {
    const parts = encrypted.split(":");
    if (parts.length !== 3) return null;
    const iv = Buffer.from(parts[0], "hex");
    const authTag = Buffer.from(parts[1], "hex");
    const ciphertext = Buffer.from(parts[2], "hex");
    const key = getDerivedKey();
    const decipher = createDecipheriv(ALGORITHM, key, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  } catch {
    return null;
  }
}
