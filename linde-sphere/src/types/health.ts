import type { FollowUpMode } from "@/domain/follow-up/follow-up-mode";

/** Public shape of GET /api/health. Contains no secrets, paths, or personal data. */
export type DatabaseStatus = "ready" | "not_initialized" | "unavailable";

export type HealthReport = {
  status: "ok" | "degraded" | "error";
  /** True only when every dependency is ready to serve visitors and store leads. */
  ready: boolean;
  timestamp: string;
  app: {
    name: string;
    version: string;
    environment: string;
    contentMode: string | null;
    uptimeSeconds: number;
  };
  configuration: { status: "valid" | "invalid"; invalidVariables: string[] };
  content: { status: "valid" | "invalid" | "unknown"; version: string | null; errorCount: number };
  database: { status: DatabaseStatus; engine: "sqlite"; reason: string | null };
  /**
   * Follow-up strategy (FOLLOW_UP_MODE, ADR-062). `deliversExternally` is true only for an email mode with a
   * real transport; LOCAL_PACKAGE never sends anything.
   */
  followUp: { mode: FollowUpMode | null; deliversExternally: boolean | null };
  /**
   * Configured email transport, used only by the email follow-up modes; "preview" never sends outside this
   * computer. `deliversExternally` is false whenever the follow-up mode does not send email.
   */
  email: { provider: "preview" | "smtp" | "graph" | null; deliversExternally: boolean | null };
};
