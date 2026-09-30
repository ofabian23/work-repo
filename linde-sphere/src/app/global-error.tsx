"use client";

import { useEffect } from "react";
import { brandConfig, brandCssVariables } from "@/lib/config/brand-config";
import { translate } from "@/lib/i18n/translate";
import "@/styles/globals.css";

/**
 * Last-resort boundary for errors in the root layout. It replaces the whole document, so it cannot use
 * the language context: both languages are shown.
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error("Linde Sphere root error", error.digest ?? "(no digest)");
  }, [error]);

  return (
    <html lang="es" style={brandCssVariables()}>
      <body className="bg-canvas text-ink flex min-h-dvh items-center justify-center p-8">
        <title>{brandConfig.productName}</title>
        <main className="bg-surface flex w-full max-w-3xl flex-col items-center gap-6 rounded-3xl p-10 text-center">
          <p className="text-2xl font-bold">{brandConfig.productName}</p>
          <h1 className="text-4xl font-bold">{translate("es", "status.errorTitle")}</h1>
          <p lang="en" className="text-ink-muted text-2xl">
            {translate("en", "status.errorTitle")}
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <button
              type="button"
              onClick={() => retry()}
              className="bg-primary text-on-primary min-h-16 rounded-2xl px-8 text-xl font-semibold"
            >
              {translate("es", "status.retry")} / <span lang="en">{translate("en", "status.retry")}</span>
            </button>
            <button
              type="button"
              onClick={() => window.location.replace("/")}
              className="border-primary text-primary min-h-16 rounded-2xl border-2 px-8 text-xl font-semibold"
            >
              {translate("es", "status.backHome")} /{" "}
              <span lang="en">{translate("en", "status.backHome")}</span>
            </button>
          </div>
          {error.digest && (
            <p className="text-ink-muted text-base">
              {translate("es", "status.errorReference", { digest: error.digest })}
            </p>
          )}
        </main>
      </body>
    </html>
  );
}
