/**
 * Safe development seed: two clearly synthetic leads, stored through the real lead service (same
 * validation, transaction and idempotency path as the kiosk).
 *
 *   npm run db:seed
 *
 * Safety rules:
 * - Refuses to run when NODE_ENV=production (the event laptop must never contain invented leads).
 * - Synthetic data only: reserved `.test` email domain, "(ficticio)" organizations, no real people.
 * - Idempotent: fixed request tokens, so running it again stores nothing new.
 */
import { createDatabase } from "../src/server/db/client";
import { getPublicContent } from "../src/server/content/public-content";
import { createPrismaLeadRepository } from "../src/server/leads/lead-repository";
import { createLeadService } from "../src/server/leads/lead-service";
import { createLogger } from "../src/server/logging/logger";

export const SEED_EMAIL_DOMAIN = "example.test";

async function main() {
  if (process.env.NODE_ENV === "production") {
    console.error("Refusing to seed: NODE_ENV=production. The seed only creates synthetic development data.");
    process.exit(1);
  }
  const databaseUrl = process.env.DATABASE_URL?.trim() || "file:./data/linde-sphere.db";
  const db = createDatabase(databaseUrl);
  const content = getPublicContent("demo", { cacheEnabled: false });
  const service = createLeadService({
    leads: createPrismaLeadRepository(db),
    content: () => content,
    emailProvider: "preview",
    logger: createLogger({ minLevel: "warn" }),
  });

  // Fixed timestamps keep the payload identical between runs, so a re-run is recognized as a replay.
  const now = "2026-01-15T14:00:00.000Z";
  const base = {
    sessionStartedAt: now,
    preferredLanguage: "es",
    phone: null,
    consentVersion: content.consent.version,
    submittedAt: now,
  } as const;
  const leads = [
    {
      ...base,
      sessionId: "3f0b9c1e-1d2a-4c3b-8e4f-5a6b7c8d9e01",
      idempotencyKey: "7c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e01",
      firstName: "Ana",
      lastName: "Ejemplo",
      organization: "Hospital de Demostración (ficticio)",
      jobFunctionId: content.personas[0]!.id,
      email: `ana.ejemplo@${SEED_EMAIL_DOMAIN}`,
      selectedInterestIds: content.challenges.slice(0, 1).map((c) => c.id),
      consents: { reportDelivery: true, salesFollowUp: false },
      signals: {
        personaId: content.personas[0]!.id,
        challengeIds: content.challenges.slice(0, 2).map((c) => c.id),
        facilityTypeId: null,
        visitedSceneIds: content.scenes.slice(0, 1).map((s) => s.id),
        openedHotspotIds: [],
        engagedHotspotIds: [],
        explicitInterestIds: [],
      },
    },
    {
      ...base,
      sessionId: "3f0b9c1e-1d2a-4c3b-8e4f-5a6b7c8d9e02",
      idempotencyKey: "7c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e02",
      firstName: "Luis",
      lastName: "Prueba",
      organization: "Clínica Modelo (ficticio)",
      jobFunctionId: content.personas[1]!.id,
      email: `luis.prueba@${SEED_EMAIL_DOMAIN}`,
      selectedInterestIds: [],
      consents: { reportDelivery: true, salesFollowUp: true },
      signals: {
        personaId: null,
        challengeIds: [],
        facilityTypeId: null,
        visitedSceneIds: content.scenes.slice(0, 2).map((s) => s.id),
        openedHotspotIds: content.scenes[0]!.hotspots.slice(0, 2).map((h) => h.id),
        engagedHotspotIds: [],
        explicitInterestIds: [],
      },
    },
  ];

  try {
    for (const lead of leads) {
      const result = await service.submitLead(lead);
      if (result.outcome === "invalid" || result.outcome === "conflict") {
        throw new Error(`Seed lead rejected (${result.outcome}); check the content files.`);
      }
      console.log(`Seed lead ${result.outcome}.`);
    }
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(`Seed failed: ${error instanceof Error ? error.name : "Error"}`);
  process.exit(1);
});
