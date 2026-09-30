import { getLeadService, logger } from "@/server/leads";
import { handleSubmissionStatus } from "@/server/leads/lead-http";

export const dynamic = "force-dynamic";

/** GET /api/leads/status/:token — report-delivery state for an opaque status token. No personal data. */
export async function GET(_request: Request, ctx: RouteContext<"/api/leads/status/[token]">) {
  const { token } = await ctx.params;
  return handleSubmissionStatus(token, getLeadService(), logger);
}
