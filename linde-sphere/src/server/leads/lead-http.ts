import "server-only";
import { clientKey, isSameOrigin, type RateLimiter } from "@/server/http/request-guards";
import type { Logger } from "@/server/logging/logger";
import type { LeadService } from "./lead-service";

/**
 * HTTP mapping for the lead routes, separated from the route files so API tests can call it with a
 * service backed by a temporary database. Responses never echo submitted values.
 */
const MAX_BODY_BYTES = 16 * 1024;
const NO_STORE = { "Cache-Control": "no-store" };

const json = (body: unknown, status: number, headers: Record<string, string> = {}) =>
  Response.json(body, { status, headers: { ...NO_STORE, ...headers } });

/** Optional protections the route files enable (tests exercise the handlers with and without them). */
export type LeadHttpGuards = { limiter?: RateLimiter; requireSameOrigin?: boolean };

const tooMany = (retryAfterSeconds: number) =>
  json({ error: "rate_limited" }, 429, { "Retry-After": String(retryAfterSeconds) });

export async function handleCreateLead(
  request: Request,
  service: LeadService,
  logger: Logger,
  { limiter, requireSameOrigin = false }: LeadHttpGuards = {},
) {
  // Only the kiosk page (same origin) may submit leads.
  if (requireSameOrigin && !isSameOrigin(request)) return json({ error: "forbidden" }, 403);
  if (limiter) {
    const slot = limiter.take(clientKey(request));
    if (!slot.allowed) {
      logger.warn("lead.rate_limited", { retryAfterSeconds: slot.retryAfterSeconds });
      return tooMany(slot.retryAfterSeconds);
    }
  }
  if (!(request.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) {
    return json({ error: "unsupported_media_type" }, 415);
  }
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) return json({ error: "payload_too_large" }, 413);

  let body: unknown;
  try {
    const text = await request.text();
    if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) {
      return json({ error: "payload_too_large" }, 413);
    }
    body = JSON.parse(text);
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  try {
    const result = await service.submitLead(body);
    switch (result.outcome) {
      case "created":
        return json(result.response, 201);
      case "replayed":
        return json(result.response, 200);
      case "conflict":
        return json({ error: "idempotency_conflict" }, 409);
      case "invalid":
        return json({ error: "validation_failed", issues: result.issues }, 422);
    }
  } catch (error) {
    // The error object may carry query parameters (personal data); log its name and code only.
    const e = error as { name?: unknown; code?: unknown };
    logger.error("lead.store_failed", { errorName: String(e?.name ?? "Error"), errorCode: e?.code ?? null });
    return json({ error: "server_error" }, 500);
  }
}

export async function handleSubmissionStatus(
  token: string,
  service: LeadService,
  logger: Logger,
  { limiter, request }: { limiter?: RateLimiter; request?: Request } = {},
) {
  if (limiter && request) {
    const slot = limiter.take(clientKey(request));
    if (!slot.allowed) return tooMany(slot.retryAfterSeconds);
  }
  try {
    const status = await service.getSubmissionStatus(token);
    // Unknown and malformed tokens get the same answer, so the endpoint cannot be used to probe for leads.
    return status ? json(status, 200) : json({ error: "not_found" }, 404);
  } catch (error) {
    const e = error as { name?: unknown; code?: unknown };
    logger.error("lead.status_failed", { errorName: String(e?.name ?? "Error"), errorCode: e?.code ?? null });
    return json({ error: "server_error" }, 500);
  }
}
