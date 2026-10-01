import { connection } from "next/server";
import { KioskExperience } from "@/features/kiosk/kiosk-experience";
import { getPublicContent } from "@/server/content/public-content";
import { visitorFollowUp } from "@/domain/follow-up/follow-up-mode";
import { getServerEnv } from "@/server/env";
import { kioskTiming } from "@/server/kiosk-timing";

/** The single kiosk route (ADR-004): server loads visible content, the client runs the experience. */
export default async function KioskPage() {
  await connection();
  const env = getServerEnv();
  const content = getPublicContent(env.CONTENT_MODE, {
    previewPlaceholders: env.CONTENT_PREVIEW_PLACEHOLDERS,
  });
  const timing = kioskTiming(env);
  return (
    <KioskExperience
      content={content}
      idle={timing.idle}
      confirmationResetMs={timing.completionMs}
      followUp={visitorFollowUp(env.FOLLOW_UP_MODE)}
    />
  );
}
