import "server-only";
import { getPublicContent } from "@/server/content/public-content";
import { getDatabase } from "@/server/db/client";
import { getEmailOutbox } from "@/server/email";
import { getServerEnv } from "@/server/env";
import { createRateLimiter, type RateLimiter } from "@/server/http/request-guards";
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

/**
 * Rate limits for a single convention kiosk (ADR-057): a visitor submits once; the page checks the status a
 * few times. Generous per client, with a global cap because client addresses can be spoofed on a LAN.
 */
const globalForLimits = globalThis as unknown as {
  lindeSphereLimits?: { leads: RateLimiter; status: RateLimiter };
};
export function getLeadRateLimits() {
  if (!globalForLimits.lindeSphereLimits) {
    const perClient = getServerEnv().LEAD_RATE_LIMIT_PER_MINUTE;
    globalForLimits.lindeSphereLimits = {
      leads: createRateLimiter({ windowMs: 60_000, perClient, global: perClient * 6 }),
      status: createRateLimiter({ windowMs: 60_000, perClient: perClient * 12, global: perClient * 60 }),
    };
  }
  return globalForLimits.lindeSphereLimits;
}
