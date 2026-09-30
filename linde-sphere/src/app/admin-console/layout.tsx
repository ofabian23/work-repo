import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { secondaryButton } from "@/features/admin/admin-ui";
import { getAdminContext } from "@/server/admin";
import { ADMIN_COOKIE } from "@/server/admin/admin-session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Administración local", robots: { index: false, follow: false } };

/**
 * Local administration utility (ADR-056). Reached only through the configured ADMIN_PATH (the proxy
 * rewrites it here and answers 404 for this internal path); never linked from visitor screens.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const ctx = getAdminContext();
  if (!ctx.config.enabled) notFound();
  const base = ctx.config.basePath;
  const signedIn = ctx.sessions.validate((await cookies()).get(ADMIN_COOKIE)?.value);
  return (
    <div className="bg-background min-h-screen" data-testid="admin-layout">
      <header className="border-line bg-surface border-b">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <p className="text-lead text-ink font-bold">Linde Sphere · Administración local</p>
          {signedIn && (
            <nav aria-label="Administración" className="flex flex-wrap items-center gap-4">
              <a className="text-primary text-label font-semibold underline" href={base}>
                Leads
              </a>
              <a className="text-primary text-label font-semibold underline" href={`${base}/exports`}>
                Exportaciones y respaldo
              </a>
              <a className="text-primary text-label font-semibold underline" href={`${base}/content`}>
                Contenido pendiente
              </a>
              <form method="post" action={`${base}/api/logout`}>
                <button type="submit" className={secondaryButton} data-testid="admin-logout">
                  Cerrar sesión
                </button>
              </form>
            </nav>
          )}
        </div>
        <p className="bg-notice-surface text-notice text-caption px-6 py-2 text-center">
          Herramienta local del MVP protegida con una frase de acceso. No es autenticación empresarial: un uso
          en producción requiere autenticación aprobada y una revisión de seguridad.
        </p>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
