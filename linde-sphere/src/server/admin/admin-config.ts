import "server-only";
import type { ServerEnv } from "@/server/env";

/** Internal App Router segment for the admin pages; only reachable through the configured ADMIN_PATH. */
export const ADMIN_INTERNAL_PATH = "/admin-console";

export type AdminConfig = {
  enabled: boolean;
  /** Public path, e.g. "/admin-local". All links and cookies use it. */
  basePath: string;
  passphraseHash: string | null;
  sessionMinutes: number;
};

export function adminConfig(env: ServerEnv): AdminConfig {
  return {
    enabled: env.ADMIN_ENABLED && env.ADMIN_PASSPHRASE_HASH !== undefined,
    basePath: env.ADMIN_PATH,
    passphraseHash: env.ADMIN_PASSPHRASE_HASH ?? null,
    sessionMinutes: env.ADMIN_SESSION_MINUTES,
  };
}

/** Maps a request path to the internal admin segment, or null when it is not an admin path. */
export function toInternalAdminPath(pathname: string, basePath: string): string | null {
  if (pathname !== basePath && !pathname.startsWith(`${basePath}/`)) return null;
  return `${ADMIN_INTERNAL_PATH}${pathname.slice(basePath.length)}`;
}

export function isInternalAdminPath(pathname: string): boolean {
  return pathname === ADMIN_INTERNAL_PATH || pathname.startsWith(`${ADMIN_INTERNAL_PATH}/`);
}
