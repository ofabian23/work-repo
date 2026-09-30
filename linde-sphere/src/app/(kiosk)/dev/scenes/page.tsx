import path from "node:path";
import type { Metadata } from "next";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { visibleContent } from "@/domain/content/visibility";
import { SceneCalibrator } from "@/features/explorer/scene-calibrator";
import { loadContentFromDirectory } from "@/server/content/load-content";
import { isSceneCalibrationEnabled } from "@/server/dev-tools";
import { getServerEnv } from "@/server/env";

export const metadata: Metadata = {
  title: "Scene calibration · Linde Sphere",
  robots: { index: false, follow: false },
};

/**
 * Private, development-only scene coordinate calibration (never linked from the kiosk).
 * Returns 404 in production unless ENABLE_SCENE_CALIBRATION=true (checked per request, and by the proxy).
 */
export default async function SceneCalibrationPage() {
  await connection();
  if (!isSceneCalibrationEnabled(getServerEnv())) notFound();

  const loaded = loadContentFromDirectory(path.join(/*turbopackIgnore: true*/ process.cwd(), "content"));
  if (!loaded.bundle) notFound();
  // Every scene, including placeholder content, so any scene can be calibrated.
  return (
    <SceneCalibrator scenes={visibleContent(loaded.bundle, "demo", { previewPlaceholders: true }).scenes} />
  );
}
