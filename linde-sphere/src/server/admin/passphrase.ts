import "server-only";
import { randomBytes, scrypt as scryptCallback, timingSafeEqual, type ScryptOptions } from "node:crypto";

/**
 * Admin passphrase hashing (ADR-056). Only the hash is configured (`ADMIN_PASSPHRASE_HASH`):
 * `scrypt:<N>:<r>:<p>:<salt base64url>:<hash base64url>`. `:` separators keep the value safe in .env files
 * (no `$` expansion). This is simple MVP protection, not enterprise authentication.
 */
export const MIN_PASSPHRASE_LENGTH = 12;
const KEY_LENGTH = 32;
const DEFAULTS = { N: 2 ** 15, r: 8, p: 1 };

const scrypt = (password: string, salt: Buffer, keylen: number, options: ScryptOptions) =>
  new Promise<Buffer>((resolve, reject) =>
    scryptCallback(password, salt, keylen, options, (error, key) => (error ? reject(error) : resolve(key))),
  );
// scrypt needs 128·N·r bytes; allow twice that.
const maxmem = (N: number, r: number) => 256 * N * r + 1024 * 1024;

export async function hashPassphrase(passphrase: string, params = DEFAULTS): Promise<string> {
  if (passphrase.length < MIN_PASSPHRASE_LENGTH) {
    throw new Error(`The passphrase must have at least ${MIN_PASSPHRASE_LENGTH} characters`);
  }
  const salt = randomBytes(16);
  const key = await scrypt(passphrase.normalize("NFC"), salt, KEY_LENGTH, {
    ...params,
    maxmem: maxmem(params.N, params.r),
  });
  return ["scrypt", params.N, params.r, params.p, salt.toString("base64url"), key.toString("base64url")].join(
    ":",
  );
}

export async function verifyPassphrase(passphrase: string, stored: string): Promise<boolean> {
  const [scheme, n, r, p, salt, hash] = stored.split(":");
  const N = Number(n);
  const R = Number(r);
  const P = Number(p);
  if (scheme !== "scrypt" || !salt || !hash || ![N, R, P].every((v) => Number.isInteger(v) && v > 0))
    return false;
  // Refuse absurd parameters from a tampered value (they would exhaust memory or CPU).
  if (N > 2 ** 20 || R > 32 || P > 16) return false;
  const expected = Buffer.from(hash, "base64url");
  const actual = await scrypt(passphrase.normalize("NFC"), Buffer.from(salt, "base64url"), expected.length, {
    N,
    r: R,
    p: P,
    maxmem: maxmem(N, R),
  });
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
