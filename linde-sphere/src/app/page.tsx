import { connection } from "next/server";
import { KioskExperience } from "@/features/kiosk/kiosk-experience";
import { getPublicContent } from "@/server/content/public-content";
import { getServerEnv } from "@/server/env";

/** The single kiosk route (ADR-004): server loads visible content, the client runs the experience. */
export default async function KioskPage() {
  await connection();
  const env = getServerEnv();
  const content = getPublicContent(env.CONTENT_MODE, {
    previewPlaceholders: env.CONTENT_PREVIEW_PLACEHOLDERS,
  });
  return <KioskExperience content={content} />;
}
