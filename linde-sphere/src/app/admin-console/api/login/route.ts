import { getAdminContext } from "@/server/admin";
import { handleLogin } from "@/server/admin/admin-http";

export const dynamic = "force-dynamic";

/** Local administration action (ADR-056): POST only, same origin, signed in. */
export function POST(request: Request) {
  return handleLogin(request, getAdminContext());
}
