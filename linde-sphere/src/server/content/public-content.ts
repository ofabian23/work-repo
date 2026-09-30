import "server-only";
import path from "node:path";
import type { ContentMode } from "@/domain/content/primitives";
import { visibleContent, type PublicContentBundle } from "@/domain/content/visibility";
import { loadContentFromDirectory } from "./load-content";

const cache = new Map<string, PublicContentBundle>();

export class InvalidContentError extends Error {
  constructor(readonly errorCount: number) {
    super(`Content is invalid (${errorCount} error(s)). Run \`npm run content:check\` for details.`);
    this.name = "InvalidContentError";
  }
}

/**
 * Visible content for the kiosk in the given mode (internal fields stripped). Cached per process in
 * production; re-read on every request in development so content edits show up without a restart.
 * Throws InvalidContentError instead of serving partial content.
 */
export function getPublicContent(
  mode: ContentMode,
  { previewPlaceholders = false, cacheEnabled = process.env.NODE_ENV === "production" } = {},
): PublicContentBundle {
  const key = `${mode}:${previewPlaceholders}`;
  const cached = cacheEnabled ? cache.get(key) : undefined;
  if (cached) return cached;

  const loaded = loadContentFromDirectory(path.join(/*turbopackIgnore: true*/ process.cwd(), "content"));
  const errors = loaded.issues.filter((i) => i.severity === "error");
  if (!loaded.bundle || errors.length > 0) throw new InvalidContentError(errors.length);

  const bundle = visibleContent(loaded.bundle, mode, { previewPlaceholders });
  if (cacheEnabled) cache.set(key, bundle);
  return bundle;
}
