import "server-only";
import { createHash, randomBytes } from "node:crypto";

/**
 * In-memory admin sessions (ADR-056): a random 256-bit token in an HttpOnly cookie; only its SHA-256 is
 * kept, with an idle and an absolute expiry. A server restart signs everyone out, which is acceptable for a
 * single-laptop MVP.
 */
export const ADMIN_COOKIE = "ls_admin_session";

type Entry = { expiresAt: number; absoluteExpiresAt: number };

export function createAdminSessions({
  idleMs,
  absoluteMs = 8 * 60 * 60_000,
  now = () => Date.now(),
}: {
  idleMs: number;
  absoluteMs?: number;
  now?: () => number;
}) {
  const sessions = new Map<string, Entry>();
  const key = (token: string) => createHash("sha256").update(token).digest("hex");
  const prune = () => {
    const t = now();
    for (const [k, e] of sessions) if (e.expiresAt <= t || e.absoluteExpiresAt <= t) sessions.delete(k);
  };

  return {
    create(): string {
      prune();
      const token = randomBytes(32).toString("base64url");
      const t = now();
      sessions.set(key(token), { expiresAt: t + idleMs, absoluteExpiresAt: t + absoluteMs });
      return token;
    },
    /** True for a live session; extends the idle expiry (sliding window). */
    validate(token: string | undefined | null): boolean {
      if (!token || token.length > 128) return false;
      const entry = sessions.get(key(token));
      const t = now();
      if (!entry || entry.expiresAt <= t || entry.absoluteExpiresAt <= t) {
        if (entry) sessions.delete(key(token));
        return false;
      }
      entry.expiresAt = Math.min(t + idleMs, entry.absoluteExpiresAt);
      return true;
    },
    revoke(token: string | undefined | null) {
      if (token) sessions.delete(key(token));
    },
    size: () => sessions.size,
  };
}

export type AdminSessions = ReturnType<typeof createAdminSessions>;

/**
 * Consecutive failed sign-ins lock the form: 5 failures → 1 min, doubling up to 15 min. Global (not per
 * address): the admin is one person on one laptop, and a lock only delays guessing.
 */
export function createLoginThrottle({ now = () => Date.now(), freeAttempts = 5 } = {}) {
  let failures = 0;
  let lockedUntil = 0;
  return {
    check(): { allowed: boolean; retryAfterMs: number } {
      const wait = lockedUntil - now();
      return wait > 0 ? { allowed: false, retryAfterMs: wait } : { allowed: true, retryAfterMs: 0 };
    },
    fail() {
      failures += 1;
      if (failures >= freeAttempts) {
        const lockMs = Math.min(60_000 * 2 ** (failures - freeAttempts), 15 * 60_000);
        lockedUntil = now() + lockMs;
      }
    },
    succeed() {
      failures = 0;
      lockedUntil = 0;
    },
  };
}

export type LoginThrottle = ReturnType<typeof createLoginThrottle>;
