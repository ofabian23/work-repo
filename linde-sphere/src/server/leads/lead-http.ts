import "server-only";
import type { Logger } from "@/server/logging/logger";
import type { LeadService } from "./lead-service";

/**
 * HTTP mapping for the lead routes, separated from the route files so API tests can call it with a
 * service backed by a temporary database. Responses never echo submitted values.
 */
const MAX_BODY_BYTES = 16 * 1024;
const NO_STORE = { "Cache-Control": "no-store" };

const json = (body: unknown, status: number) => Response.json(body, { status, headers: NO_STORE });

export async function handleCreateLead(request: Request, service: LeadService, logger: Logger) {
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

export async function handleSubmissionStatus(token: string, service: LeadService, logger: Logger) {
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
