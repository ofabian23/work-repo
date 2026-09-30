import type { Metadata, Viewport } from "next";
import { connection } from "next/server";
import { AppShell } from "@/components/shell/app-shell";
import { LanguageProvider } from "@/lib/i18n/language-provider";
import { appConfig } from "@/lib/config/app-config";
import { brandConfig, brandCssVariables } from "@/lib/config/brand-config";
import { es } from "@/data/i18n/es";
import { getServerEnv } from "@/server/env";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: brandConfig.productName,
  description: es.meta.description,
  robots: { index: false, follow: false },
};

/** Kiosk viewport: page zoom is disabled on the shared touchscreen (ADR-022). */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: brandConfig.colors.surface,
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Render per request so CONTENT_MODE is read from the running server's environment, not the build.
  await connection();
  const env = getServerEnv();

  return (
    <html lang={appConfig.defaultLanguage} style={brandCssVariables()} className="h-full antialiased">
      <body className="min-h-full">
        <LanguageProvider>
          <AppShell contentMode={env.CONTENT_MODE}>{children}</AppShell>
        </LanguageProvider>
      </body>
    </html>
  );
}
