import "server-only";
import type { ServerEnv } from "./env";

/**
 * The component gallery is a development tool (ADR-045): available in `next dev`, and in production
 * only when ENABLE_COMPONENT_GALLERY=true is set explicitly (e.g. for a design review on a staging laptop).
 */
export function isComponentGalleryEnabled(
  env: Pick<ServerEnv, "NODE_ENV" | "ENABLE_COMPONENT_GALLERY">,
): boolean {
  return env.NODE_ENV !== "production" || env.ENABLE_COMPONENT_GALLERY;
}

/**
 * Scene coordinate calibration (/dev/scenes, ADR-049) follows the same rule as the gallery, with its own
 * flag: always in development, in production only with ENABLE_SCENE_CALIBRATION=true.
 */
export function isSceneCalibrationEnabled(
  env: Pick<ServerEnv, "NODE_ENV" | "ENABLE_SCENE_CALIBRATION">,
): boolean {
  return env.NODE_ENV !== "production" || env.ENABLE_SCENE_CALIBRATION;
}

/** Which development tool, if any, a /dev path belongs to, and whether it is enabled. */
export function isDevToolPathEnabled(
  pathname: string,
  env: Pick<ServerEnv, "NODE_ENV" | "ENABLE_COMPONENT_GALLERY" | "ENABLE_SCENE_CALIBRATION">,
): boolean {
  if (pathname === "/dev/scenes" || pathname.startsWith("/dev/scenes/"))
    return isSceneCalibrationEnabled(env);
  return isComponentGalleryEnabled(env);
}
