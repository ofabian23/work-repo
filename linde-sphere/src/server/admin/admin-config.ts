import "server-only";
import type { FollowUpMode } from "@/domain/follow-up/follow-up-mode";
import type { ServerEnv } from "@/server/env";

/** Internal App Router segment for the admin pages; only reachable through the configured ADMIN_PATH. */
export const ADMIN_INTERNAL_PATH = "/admin-console";

export type AdminConfig = {
  enabled: boolean;
  /** Public path, e.g. "/admin-local". All links and cookies use it. */
  basePath: string;
  passphraseHash: string | null;
  sessionMinutes: number;
  /** Current follow-up strategy, read from FOLLOW_UP_MODE (ADR-062); shown in the admin header. */
  followUpMode: FollowUpMode;
  /** Email transport the email modes would use (EMAIL_PROVIDER). */
  emailProvider: ServerEnv["EMAIL_PROVIDER"];
};

export function adminConfig(env: ServerEnv): AdminConfig {
  return {
    enabled: env.ADMIN_ENABLED && env.ADMIN_PASSPHRASE_HASH !== undefined,
    basePath: env.ADMIN_PATH,
    passphraseHash: env.ADMIN_PASSPHRASE_HASH ?? null,
    sessionMinutes: env.ADMIN_SESSION_MINUTES,
    followUpMode: env.FOLLOW_UP_MODE,
    emailProvider: env.EMAIL_PROVIDER,
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
