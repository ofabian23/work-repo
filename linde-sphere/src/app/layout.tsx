import type { Metadata, Viewport } from "next";
import { LanguageProvider } from "@/lib/i18n/language-provider";
import { appConfig } from "@/lib/config/app-config";
import { brandConfig, brandCssVariables } from "@/lib/config/brand-config";
import { es } from "@/data/i18n/es";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: brandConfig.productName,
  description: es.meta.description,
  robots: { index: false, follow: false },
};

/**
 * Viewport (ADR-058, amends ADR-022): browser zoom stays available for visitors who need it (WCAG 1.4.4).
 * Accidental gestures are handled in CSS instead: no double-tap zoom anywhere (`touch-action:
 * manipulation`) and no pinch on the hospital scene, where zooming would hide its points.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: brandConfig.colors.surface,
};

/**
 * Root layout: document, global styles, brand variables and language. The kiosk shell lives in
 * `(kiosk)/layout.tsx`; the local administration utility has its own plain layout (ADR-056).
 */
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang={appConfig.defaultLanguage} style={brandCssVariables()} className="h-full antialiased">
      <body className="min-h-full">
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}
