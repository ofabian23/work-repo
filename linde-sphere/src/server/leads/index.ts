import "server-only";
import { getPublicContent } from "@/server/content/public-content";
import { getDatabase } from "@/server/db/client";
import { getEmailOutbox } from "@/server/email";
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
    // Delivery is attempted right after the response; the periodic worker handles retries (ADR-054).
    onDeliveryQueued: (deliveryId) => getEmailOutbox().schedule(deliveryId),
    logger,
  });
  return service;
}

export { logger };
