/**
 * AzerothCore SRP6 authentication helpers.
 *
 * AzerothCore uses a non-standard SRP6 variant:
 *   h1 = SHA1(UPPER(username) + ":" + UPPER(password))
 *   h2 = SHA1(salt || h1)                  # salt bytes then h1 bytes
 *   h2_int = int.from_bytes(h2, 'little')  # little-endian
 *   verifier_int = g^h2_int mod N          # g=7, N=large prime
 *   verifier = verifier_int.to_bytes(32, 'little')
 *
 * Ref: azerothcore_webui/app.py:84-108
 */

import { createHash, randomBytes } from "node:crypto";

// SRP6 constants from AzerothCore
const SRP6_N = BigInt(
  "0x894B645E89E1535BBDAD5B8B290650530801B18EBFBF5E8FAB3C82872A3E9BB7"
);
const SRP6_g = 7n;

function sha1(...bufs: Buffer[]): Buffer {
  const h = createHash("sha1");
  for (const b of bufs) h.update(b);
  return h.digest();
}

/** Read a Buffer as a little-endian unsigned BigInt. */
function bufferToLE(buf: Buffer): bigint {
  let result = 0n;
  for (let i = buf.length - 1; i >= 0; i--) {
    result = (result << 8n) | BigInt(buf[i]);
  }
  return result;
}

/** Write a BigInt as a little-endian Buffer of exactly `length` bytes. */
function leToBuf(value: bigint, length: number): Buffer {
  const buf = Buffer.alloc(length);
  let v = value;
  for (let i = 0; i < length; i++) {
    buf[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return buf;
}

export interface SRP6Result {
  salt: Buffer;
  verifier: Buffer;
}

/**
 * Compute an AzerothCore SRP6 salt and verifier.
 * @param username - account username (will be uppercased)
 * @param password - account password (will be uppercased)
 * @param salt - optional 32-byte salt; random if not provided
 */
export function computeSRP6Verifier(
  username: string,
  password: string,
  salt?: Buffer
): SRP6Result {
  const s = salt ?? randomBytes(32);
  const h1 = sha1(Buffer.from(`${username.toUpperCase()}:${password.toUpperCase()}`));
  const h2 = sha1(s, h1);
  const h2Int = bufferToLE(h2);
  const verifierInt = modPow(SRP6_g, h2Int, SRP6_N);
  const verifier = leToBuf(verifierInt, 32);
  return { salt: s, verifier };
}

/**
 * Verify a password against stored SRP6 salt and verifier.
 */
export function verifySRP6Password(
  username: string,
  password: string,
  salt: Buffer,
  storedVerifier: Buffer
): boolean {
  const { verifier } = computeSRP6Verifier(username, password, salt);
  return verifier.equals(storedVerifier);
}

/** Fast modular exponentiation for BigInt. */
function modPow(base: bigint, exp: bigint, mod: bigint): bigint {
  let result = 1n;
  let b = base % mod;
  let e = exp;
  while (e > 0n) {
    if (e & 1n) result = (result * b) % mod;
    b = (b * b) % mod;
    e >>= 1n;
  }
  return result;
}
