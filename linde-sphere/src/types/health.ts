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
};
