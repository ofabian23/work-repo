import path from "node:path";
import type { Metadata } from "next";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { visibleContent } from "@/domain/content/visibility";
import { ComponentGallery } from "@/features/dev-gallery/component-gallery";
import { loadContentFromDirectory } from "@/server/content/load-content";
import { isComponentGalleryEnabled } from "@/server/dev-tools";
import { getServerEnv } from "@/server/env";

export const metadata: Metadata = {
  title: "Component gallery · Linde Sphere",
  robots: { index: false, follow: false },
};

/**
 * Private, development-only design-system gallery (never linked from the kiosk).
 * Returns 404 in production unless ENABLE_COMPONENT_GALLERY=true (checked per request).
 */
export default async function ComponentGalleryPage() {
  await connection();
  if (!isComponentGalleryEnabled(getServerEnv())) notFound();

  const loaded = loadContentFromDirectory(path.join(/*turbopackIgnore: true*/ process.cwd(), "content"));
  if (!loaded.bundle) notFound();
  return <ComponentGallery content={visibleContent(loaded.bundle, "demo")} />;
}
