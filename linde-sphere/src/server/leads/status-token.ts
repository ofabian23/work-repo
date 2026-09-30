import "server-only";
import { createHash, createHmac } from "node:crypto";

/**
 * Opaque submission-status tokens (ADR-052).
 *
 * token = base64url(HMAC-SHA256(key = the request's idempotency key, message = "lead-status:v1:" + leadId))
 *
 * - Unguessable: the idempotency key is a random v4 UUID known only to the kiosk that sent the request.
 * - Re-derivable: a replayed request (double tap, retry after a lost response) gets the same token back
 *   without the server ever storing the token itself.
 * - Separate from the request token: status tokens travel in URLs (which proxies may log); leaking one
 *   reveals only a delivery state, never the idempotency key or any personal data.
 * Only the SHA-256 hash of the token is stored, and lookups compare hashes.
 */
export function deriveStatusToken(idempotencyKey: string, leadId: string): string {
  return createHmac("sha256", idempotencyKey).update(`lead-status:v1:${leadId}`).digest("base64url");
}

export function hashStatusToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
