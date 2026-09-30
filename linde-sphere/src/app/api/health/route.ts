import { getHealthReport } from "@/server/health";

export const dynamic = "force-dynamic";

/**
 * GET /api/health — application, configuration, content and database readiness.
 * 200 for ok/degraded (serving), 503 for error. Never cached; contains no secrets.
 */
export function GET() {
  const report = getHealthReport();
  return Response.json(report, {
    status: report.status === "error" ? 503 : 200,
    headers: { "Cache-Control": "no-store" },
  });
}
