import "server-only";
import { getPublicContent } from "@/server/content/public-content";
import { getDatabase } from "@/server/db/client";
import { getServerEnv } from "@/server/env";
import { logger } from "@/server/logging/logger";
import { createPrismaLeadRepository } from "./lead-repository";
import { createLeadService, type LeadService } from "./lead-service";

/** Composition root for route handlers: wires the lead service to the process database and content. */
let service: LeadService | undefined;

export function getLeadService(): LeadService {
  if (service) return service;
  const env = getServerEnv();
  service = createLeadService({
    leads: createPrismaLeadRepository(getDatabase()),
    content: () =>
      getPublicContent(env.CONTENT_MODE, { previewPlaceholders: env.CONTENT_PREVIEW_PLACEHOLDERS }),
    emailProvider: env.EMAIL_PROVIDER,
    // The email outbox worker arrives with report delivery (Phase 8); until then deliveries stay pending.
    onDeliveryQueued: undefined,
    logger,
  });
  return service;
}

export { logger };
