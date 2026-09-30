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
