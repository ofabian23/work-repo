import { getLeadService, logger } from "@/server/leads";
import { handleCreateLead } from "@/server/leads/lead-http";

export const dynamic = "force-dynamic";

/**
 * POST /api/leads — store a lead after server-side validation (ADR-052). Idempotent per request token.
 * Only POST is exported: there is deliberately no endpoint that lists leads (GET answers 405).
 */
export function POST(request: Request) {
  return handleCreateLead(request, getLeadService(), logger);
}
