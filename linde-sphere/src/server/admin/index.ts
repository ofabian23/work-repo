import "server-only";
import path from "node:path";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { loadContentFromDirectory } from "@/server/content/load-content";
import { resolveSqlitePath } from "@/server/database-probe";
import { getDatabase } from "@/server/db/client";
import { getEmailOutbox } from "@/server/email";
import { getServerEnv } from "@/server/env";
import { logger } from "@/server/logging/logger";
import { adminConfig } from "./admin-config";
import type { AdminHttpContext } from "./admin-http";
import { createAdminRepository } from "./admin-repository";
import { createAdminService } from "./admin-service";
import { ADMIN_COOKIE, createAdminSessions, createLoginThrottle } from "./admin-session";

/** Composition root for the admin utility; sessions live on globalThis so every route shares them. */
const globalForAdmin = globalThis as unknown as { lindeSphereAdmin?: AdminHttpContext };

export function getAdminContext(): AdminHttpContext {
  if (globalForAdmin.lindeSphereAdmin) return globalForAdmin.lindeSphereAdmin;
  const env = getServerEnv();
  const config = adminConfig(env);
  globalForAdmin.lindeSphereAdmin = {
    config,
    sessions: createAdminSessions({ idleMs: config.sessionMinutes * 60_000 }),
    throttle: createLoginThrottle(),
    logger,
    service: createAdminService({
      repo: createAdminRepository(getDatabase()),
      outbox: getEmailOutbox(),
      loadContent: () => {
        const loaded = loadContentFromDirectory(
          path.join(/*turbopackIgnore: true*/ process.cwd(), "content"),
        );
        if (!loaded.bundle) throw new Error("Content failed to load");
        return loaded.bundle;
      },
      databaseFile: resolveSqlitePath(env.DATABASE_URL),
      logger,
    }),
  };
  return globalForAdmin.lindeSphereAdmin;
}

/** For admin pages: 404 when disabled, sign-in page when there is no valid session. */
export async function requireAdmin(): Promise<AdminHttpContext> {
  const ctx = getAdminContext();
  if (!ctx.config.enabled) notFound();
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!ctx.sessions.validate(token)) redirect(`${ctx.config.basePath}/login`);
  return ctx;
}
